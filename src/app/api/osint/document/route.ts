import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

const MAX_BYTES = 15 * 1024 * 1024;

// Keys we look for inside the PDF /Info dictionary.
const PDF_KEYS = [
  "Title",
  "Author",
  "Subject",
  "Keywords",
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
  "Trapped",
];

// ---------------------------------------------------------------------------
// Small XML helpers (no DOM lib needed)
// ---------------------------------------------------------------------------

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&amp;/g, "&"); // last to avoid double-decoding
}

/**
 * Extract the inner text of the first XML element whose local name matches.
 * Handles namespaced tags like `<dc:creator>John</dc:creator>` or
 * `<Application>Microsoft Word</Application>`.
 */
function extractXmlTag(xml: string, localName: string): string | null {
  const re = new RegExp(
    `<[a-zA-Z0-9:]*${localName}\\b[^>]*>([\\s\\S]*?)</[a-zA-Z0-9:]*${localName}\\s*>`,
    "i"
  );
  const m = xml.match(re);
  if (m && m[1] && m[1].trim()) {
    return decodeXmlEntities(m[1].trim());
  }
  return null;
}

// ---------------------------------------------------------------------------
// PDF helpers — manual parsing of the /Info dictionary
// ---------------------------------------------------------------------------

/**
 * Read a PDF literal string `( ... )` starting at `start` (the index of the
 * opening parenthesis). Handles escaped `\(`, `\)`, `\\`, octal escapes
 * `\nnn`, line continuations and nested parens. Detects UTF-16BE BOM
 * (`\376\377` => 0xFE 0xFF) and decodes accordingly.
 */
function readPdfLiteralString(buffer: Buffer, start: number): string {
  let i = start + 1;
  let depth = 1;
  const bytes: number[] = [];
  while (i < buffer.length && depth > 0) {
    const b = buffer[i];
    if (b === 0x5c) {
      // backslash escape
      i++;
      if (i >= buffer.length) break;
      const next = buffer[i];
      switch (next) {
        case 0x6e: bytes.push(0x0a); break; // \n
        case 0x72: bytes.push(0x0d); break; // \r
        case 0x74: bytes.push(0x09); break; // \t
        case 0x62: bytes.push(0x08); break; // \b
        case 0x66: bytes.push(0x0c); break; // \f
        case 0x28: bytes.push(0x28); break; // \(
        case 0x29: bytes.push(0x29); break; // \)
        case 0x5c: bytes.push(0x5c); break; // \\
        case 0x0a: break; // line continuation
        case 0x0d:
          if (i + 1 < buffer.length && buffer[i + 1] === 0x0a) i++;
          break;
        default:
          if (next >= 0x30 && next <= 0x37) {
            // octal escape \ddd (1-3 digits)
            let oct = String.fromCharCode(next);
            if (
              i + 1 < buffer.length &&
              buffer[i + 1] >= 0x30 &&
              buffer[i + 1] <= 0x37
            ) {
              oct += String.fromCharCode(buffer[i + 1]);
              i++;
              if (
                i + 1 < buffer.length &&
                buffer[i + 1] >= 0x30 &&
                buffer[i + 1] <= 0x37
              ) {
                oct += String.fromCharCode(buffer[i + 1]);
                i++;
              }
            }
            bytes.push(parseInt(oct, 8) & 0xff);
          } else {
            bytes.push(next);
          }
      }
      i++;
    } else if (b === 0x28) {
      // nested (
      depth++;
      bytes.push(b);
      i++;
    } else if (b === 0x29) {
      // )
      depth--;
      if (depth > 0) bytes.push(b);
      i++;
    } else {
      bytes.push(b);
      i++;
    }
  }

  const buf = Buffer.from(bytes);
  // UTF-16BE BOM detection (PDF Unicode literal strings start with \376\377).
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    let str = "";
    for (let j = 2; j + 1 < buf.length; j += 2) {
      str += String.fromCharCode((buf[j] << 8) | buf[j + 1]);
    }
    return str;
  }
  // Default: treat as Latin-1 / PDFDocEncoding (good enough for ASCII).
  return buf.toString("latin1");
}

/**
 * Read a PDF hex string `< ... >` starting at `start` (the index of the
 * opening angle bracket). Decodes hex pairs; detects UTF-16BE BOM.
 */
function readPdfHexString(buffer: Buffer, start: number): string {
  let i = start + 1;
  let hex = "";
  while (i < buffer.length && buffer[i] !== 0x3e) {
    const b = buffer[i];
    if (
      (b >= 0x30 && b <= 0x39) || // 0-9
      (b >= 0x41 && b <= 0x46) || // A-F
      (b >= 0x61 && b <= 0x66) // a-f
    ) {
      hex += String.fromCharCode(b);
    }
    i++;
  }
  if (hex.length % 2 === 1) hex += "0";
  if (hex.length === 0) return "";
  const buf = Buffer.from(hex, "hex");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    let str = "";
    for (let j = 2; j + 1 < buf.length; j += 2) {
      str += String.fromCharCode((buf[j] << 8) | buf[j + 1]);
    }
    return str;
  }
  return buf.toString("latin1");
}

/**
 * Find the value of a PDF key in the buffer (e.g. `/Title (Hello)` or
 * `/Author <FEFF...>`). Returns the decoded string or null.
 */
function extractPdfKey(buffer: Buffer, key: string): string | null {
  const keyBytes = Buffer.from(`/${key}`);
  let pos = 0;
  while (pos < buffer.length) {
    const idx = buffer.indexOf(keyBytes, pos);
    if (idx === -1) return null;
    // Make sure it's a real dictionary key: preceded by whitespace, `<<`, `/`,
    // `(` close, `>` close, or start of buffer (common between consecutive fields).
    if (idx > 0) {
      const prev = buffer[idx - 1];
      if (
        prev !== 0x20 &&
        prev !== 0x09 &&
        prev !== 0x0a &&
        prev !== 0x0d &&
        prev !== 0x3c &&
        prev !== 0x2f &&
        prev !== 0x29 &&
        prev !== 0x3e
      ) {
        pos = idx + 1;
        continue;
      }
    }
    let i = idx + keyBytes.length;
    // skip whitespace between key and value
    while (
      i < buffer.length &&
      (buffer[i] === 0x20 ||
        buffer[i] === 0x09 ||
        buffer[i] === 0x0a ||
        buffer[i] === 0x0d)
    ) {
      i++;
    }
    if (i < buffer.length && buffer[i] === 0x28) {
      return readPdfLiteralString(buffer, i);
    }
    if (i < buffer.length && buffer[i] === 0x3c) {
      return readPdfHexString(buffer, i);
    }
    // Not a string value (could be `/Trapped /False` or a name reference) —
    // keep looking for another occurrence.
    pos = idx + 1;
  }
  return null;
}

/**
 * Convert a PDF date string like `D:20240115123000+01'00'` into an ISO string.
 * Returns the original string if parsing fails.
 */
function parsePdfDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  let s = dateStr.trim();
  if (s.startsWith("D:")) s = s.slice(2);
  s = s.replace(/'/g, "");
  const m = s.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+\-Z])?(\d{2})?(\d{2})?$/
  );
  if (!m) return dateStr;
  const y = m[1];
  const mo = m[2] || "01";
  const d = m[3] || "01";
  const h = m[4] || "00";
  const mi = m[5] || "00";
  const sec = m[6] || "00";
  const sign = m[7];
  const oh = m[8] || "00";
  const om = m[9] || "00";
  if (sign === "Z") return `${y}-${mo}-${d}T${h}:${mi}:${sec}Z`;
  if (sign === "+" || sign === "-") {
    return `${y}-${mo}-${d}T${h}:${mi}:${sec}${sign}${oh}:${om}`;
  }
  return `${y}-${mo}-${d}T${h}:${mi}:${sec}`;
}

async function extractPdfMetadata(buffer: Buffer): Promise<{
  metadata: Record<string, string>;
  notes: string[];
  format: string;
}> {
  const metadata: Record<string, string> = {};
  const notes: string[] = [];

  for (const key of PDF_KEYS) {
    try {
      const val = extractPdfKey(buffer, key);
      if (val !== null && val !== "") {
        let v = val;
        if (key === "CreationDate" || key === "ModDate") {
          const parsed = parsePdfDate(val);
          if (parsed !== val) v = parsed;
        }
        metadata[key] = v;
      }
    } catch {
      // ignore individual key errors
    }
  }

  return { metadata, notes, format: "PDF" };
}

// ---------------------------------------------------------------------------
// OOXML helpers (DOCX / XLSX / PPTX are ZIP archives with docProps/*.xml)
// ---------------------------------------------------------------------------

async function extractOoxmlMetadata(
  buffer: Buffer,
  ext: string
): Promise<{
  metadata: Record<string, string>;
  notes: string[];
  format: string;
}> {
  const notes: string[] = [];
  const metadata: Record<string, string> = {};

  let format = "OOXML";
  if (ext === "docx") format = "Word (DOCX)";
  else if (ext === "xlsx") format = "Excel (XLSX)";
  else if (ext === "pptx") format = "PowerPoint (PPTX)";

  const zip = await JSZip.loadAsync(buffer);

  // core.xml — Dublin Core + cp: namespace
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    try {
      const xml = await coreFile.async("string");
      const coreMap: [string, string][] = [
        ["creator", "Author"],
        ["lastModifiedBy", "LastModifiedBy"],
        ["title", "Title"],
        ["subject", "Subject"],
        ["keywords", "Keywords"],
        ["description", "Description"],
        ["category", "Category"],
        ["version", "Version"],
        ["revision", "Revision"],
        ["created", "Created"],
        ["modified", "Modified"],
        ["contentStatus", "ContentStatus"],
        ["identifier", "Identifier"],
        ["language", "Language"],
      ];
      for (const [tag, outKey] of coreMap) {
        const v = extractXmlTag(xml, tag);
        if (v) metadata[outKey] = v;
      }
    } catch {
      notes.push("No se pudo leer docProps/core.xml correctamente.");
    }
  } else {
    notes.push("El archivo no contiene docProps/core.xml.");
  }

  // app.xml — extended properties
  const appFile = zip.file("docProps/app.xml");
  if (appFile) {
    try {
      const xml = await appFile.async("string");
      const appMap: [string, string][] = [
        ["Application", "Application"],
        ["AppVersion", "AppVersion"],
        ["Company", "Company"],
        ["Manager", "Manager"],
        ["Template", "Template"],
        ["TotalTime", "TotalTime"],
        ["Pages", "Pages"],
        ["Words", "Words"],
        ["Characters", "Characters"],
        ["CharsWithSpaces", "CharsWithSpaces"],
        ["Lines", "Lines"],
        ["Paragraphs", "Paragraphs"],
        ["Slides", "Slides"],
        ["Notes", "Notes"],
        ["HiddenSlides", "HiddenSlides"],
        ["MMClips", "MMClips"],
        ["ScaleCrop", "ScaleCrop"],
        ["LinksUpToDate", "LinksUpToDate"],
        ["SharedDoc", "SharedDoc"],
        ["HyperlinksChanged", "HyperlinksChanged"],
        ["Worksheets", "Worksheets"],
        ["PresentationFormat", "PresentationFormat"],
      ];
      for (const [tag, outKey] of appMap) {
        const v = extractXmlTag(xml, tag);
        if (v) metadata[outKey] = v;
      }
    } catch {
      notes.push("No se pudo leer docProps/app.xml correctamente.");
    }
  }

  return { metadata, notes, format };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se ha enviado ningún archivo." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo de 15 MB." },
        { status: 400 }
      );
    }

    const name = (file.name || "").toLowerCase();
    const ext = name.split(".").pop() || "";
    const mime = file.type || "";

    const isPdf =
      ext === "pdf" ||
      mime === "application/pdf" ||
      mime === "application/x-pdf";
    const isDocx =
      ext === "docx" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isXlsx =
      ext === "xlsx" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const isPptx =
      ext === "pptx" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    if (!isPdf && !isDocx && !isXlsx && !isPptx) {
      return NextResponse.json(
        {
          error: "Formato no soportado. Use PDF, DOCX, XLSX o PPTX.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parseNotes: string[] = [];
    const metadata: Record<string, string> = {};
    let format = "";

    try {
      if (isPdf) {
        const r = await extractPdfMetadata(buffer);
        Object.assign(metadata, r.metadata);
        format = r.format;
        parseNotes.push(...r.notes);
      } else {
        const ooxmlExt = isDocx ? "docx" : isXlsx ? "xlsx" : "pptx";
        const r = await extractOoxmlMetadata(buffer, ooxmlExt);
        Object.assign(metadata, r.metadata);
        format = r.format;
        parseNotes.push(...r.notes);
      }
    } catch (err) {
      parseNotes.push(
        `Error al procesar el documento: ${
          err instanceof Error ? err.message : "desconocido"
        }`
      );
    }

    // OSINT-relevant highlights first.
    const osintNotes: string[] = [];
    const author =
      metadata.Author || metadata.LastModifiedBy || metadata.Creator;
    if (author) osintNotes.push(`Autor original: ${author}`);
    const software =
      metadata.Producer ||
      metadata.Creator ||
      metadata.Application ||
      metadata.AppVersion;
    if (software) osintNotes.push(`Software usado: ${software}`);
    if (metadata.Company) osintNotes.push(`Empresa: ${metadata.Company}`);
    if (metadata.Manager) osintNotes.push(`Manager: ${metadata.Manager}`);

    const allNotes = [...osintNotes, ...parseNotes];
    if (Object.keys(metadata).length === 0) {
      allNotes.push("No se encontraron metadatos en este documento");
    }

    // Sort metadata keys alphabetically.
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(metadata).sort()) {
      sorted[k] = metadata[k];
    }

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      fileType: mime || ext,
      format,
      metadata: sorted,
      notes: allNotes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "document-metadata",
    description:
      "Extrae metadatos ocultos de documentos PDF, DOCX, XLSX y PPTX.",
    formats: ["PDF", "DOCX", "XLSX", "PPTX"],
    maxSize: "15MB",
    fields: [
      "Author / LastModifiedBy",
      "Title",
      "Subject",
      "Keywords",
      "Creator / Producer (PDF)",
      "Application / AppVersion (Office)",
      "Company / Manager (Office)",
      "CreationDate / Created",
      "ModDate / Modified",
      "Revision",
      "Pages / Slides / Worksheets / Words / Characters",
    ],
  });
}
