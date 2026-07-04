import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024;

// Accept PNG / BMP / JPG.  PNG and BMP are lossless, so their LSB plane is the
// most useful for steganography; JPG is lossy so any payload is usually
// destroyed, but we still accept it for completeness.
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/bmp",
  "image/jpeg",
  "image/jpg",
  "application/octet-stream", // some uploads of .bmp arrive as octet-stream
]);

const ACCEPTED_EXT = [".png", ".bmp", ".jpg", ".jpeg"];

// How many LSB bytes to extract / preview.
const MAX_LSB_BYTES = 2048;
const HEX_PREVIEW_BYTES = 256;
const ASCII_PREVIEW_BYTES = 512;
const MIN_TEXT_RUN = 8;
const MAX_TEXT_FRAGMENTS = 20;

interface PlaneStat {
  channel: string;
  onesPercent: number;
}

interface StegoResult {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  channels: number;
  lsbHexPreview: string;
  lsbAsciiPreview: string;
  detectedSignature: string | null;
  planeStats: PlaneStat[];
  textFragments: string[];
  notes: string[];
}

// File-signature ("magic byte") checks against the first bytes extracted from
// the LSB plane.  If a hidden file was embedded, its header often shows up
// here.
function detectSignature(bytes: number[]): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "PNG (image/png)";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "JPEG (image/jpeg)";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
    return "ZIP / Office Open XML (PK)";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
    return "PDF (application/pdf)";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  )
    return "GIF (image/gif)";
  return null;
}

function isPrintable(b: number): boolean {
  return b >= 0x20 && b <= 0x7e;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          fileName: "",
          fileSize: 0,
          width: 0,
          height: 0,
          channels: 0,
          lsbHexPreview: "",
          lsbAsciiPreview: "",
          detectedSignature: null,
          planeStats: [],
          textFragments: [],
          notes: ["No se ha enviado ningún archivo."],
        },
        { status: 200 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          fileName: file.name,
          fileSize: file.size,
          width: 0,
          height: 0,
          channels: 0,
          lsbHexPreview: "",
          lsbAsciiPreview: "",
          detectedSignature: null,
          planeStats: [],
          textFragments: [],
          notes: [
            `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(
              1
            )} MB). El tamaño máximo es 10 MB.`,
          ],
        },
        { status: 200 }
      );
    }

    const lowerName = file.name.toLowerCase();
    const extOk = ACCEPTED_EXT.some((ext) => lowerName.endsWith(ext));
    const typeOk =
      ACCEPTED_TYPES.has(file.type) ||
      file.type === "" ||
      file.type.startsWith("image/");
    if (!extOk && !typeOk) {
      return NextResponse.json(
        {
          fileName: file.name,
          fileSize: file.size,
          width: 0,
          height: 0,
          channels: 0,
          lsbHexPreview: "",
          lsbAsciiPreview: "",
          detectedSignature: null,
          planeStats: [],
          textFragments: [],
          notes: [
            `Tipo de archivo no admitido ("${file.type}"). Usa PNG, BMP o JPG.`,
          ],
        },
        { status: 200 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Decode into raw RGB pixels.  We force sRGB colorspace and strip alpha so
    // we always get 3 bytes per pixel (R, G, B).
    let raw: { data: Buffer; info: sharp.OutputInfo };
    try {
      raw = await sharp(buffer)
        .toColorspace("srgb")
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch (err) {
      return NextResponse.json(
        {
          fileName: file.name,
          fileSize: file.size,
          width: 0,
          height: 0,
          channels: 0,
          lsbHexPreview: "",
          lsbAsciiPreview: "",
          detectedSignature: null,
          planeStats: [],
          textFragments: [],
          notes: [
            `No se pudo decodificar la imagen: ${
              err instanceof Error ? err.message : "formato no soportado"
            }.`,
          ],
        },
        { status: 200 }
      );
    }

    const { data, info } = raw;
    const ch = Math.max(1, info.channels);
    const width = info.width;
    const height = info.height;

    // ---- Extract the LSB plane (R, then G, then B per pixel, row-major) ----
    const lsbBytes: number[] = [];
    let currentByte = 0;
    let bitCount = 0;
    for (let i = 0; i < data.length && lsbBytes.length < MAX_LSB_BYTES; i++) {
      const pixelChannel = i % ch;
      if (pixelChannel >= 3) continue; // only R, G, B
      const bit = data[i] & 1;
      currentByte = (currentByte << 1) | bit;
      bitCount++;
      if (bitCount === 8) {
        lsbBytes.push(currentByte);
        currentByte = 0;
        bitCount = 0;
      }
    }

    // ---- Hex preview (first 256 bytes) ----
    const hexPreview = lsbBytes
      .slice(0, HEX_PREVIEW_BYTES)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    // ---- ASCII preview (first 512 bytes, non-printable -> ".") ----
    const asciiPreview = lsbBytes
      .slice(0, ASCII_PREVIEW_BYTES)
      .map((b) => (isPrintable(b) ? String.fromCharCode(b) : "."))
      .join("");

    // ---- Detected signature ----
    const detectedSignature = detectSignature(lsbBytes);

    // ---- Per-channel LSB statistics (% of 1 bits) ----
    const channelNames = ["R", "G", "B"];
    const planeStats: PlaneStat[] = [];
    const maxChannels = Math.min(3, ch);
    for (let c = 0; c < maxChannels; c++) {
      let ones = 0;
      let total = 0;
      for (let i = c; i < data.length; i += ch) {
        ones += data[i] & 1;
        total++;
      }
      planeStats.push({
        channel: channelNames[c],
        onesPercent: total > 0 ? (ones / total) * 100 : 0,
      });
    }

    // ---- Printable ASCII runs of length >= MIN_TEXT_RUN ----
    const textFragments: string[] = [];
    let current = "";
    for (let i = 0; i < lsbBytes.length; i++) {
      const b = lsbBytes[i];
      if (isPrintable(b)) {
        current += String.fromCharCode(b);
      } else {
        if (current.length >= MIN_TEXT_RUN) {
          textFragments.push(current);
          if (textFragments.length >= MAX_TEXT_FRAGMENTS) break;
        }
        current = "";
      }
    }
    if (current.length >= MIN_TEXT_RUN && textFragments.length < MAX_TEXT_FRAGMENTS) {
      textFragments.push(current);
    }

    // ---- Notes ----
    const notes: string[] = [];
    notes.push(
      `Se extrajeron ${lsbBytes.length} bytes del plano LSB (R→G→B por píxel, fila a fila).`
    );
    if (detectedSignature) {
      notes.push(
        `Firma detectada al inicio del LSB: ${detectedSignature}. Es probable que exista un archivo incrustado.`
      );
    }
    if (textFragments.length > 0) {
      notes.push(
        `Se detectaron ${textFragments.length} fragmentos de texto ASCII imprimible (≥${MIN_TEXT_RUN} caracteres) en el LSB.`
      );
    }
    planeStats.forEach((p) => {
      const dev = Math.abs(p.onesPercent - 50);
      if (dev < 2) {
        notes.push(
          `El canal ${p.channel} tiene ${p.onesPercent.toFixed(
            2
          )}% de bits a 1 en el LSB, muy cerca del 50% típico de datos aleatorios / cifrados.`
        );
      }
    });
    notes.push(
      "El análisis LSB es heurístico: la ausencia de firmas o fragmentos no garantiza que la imagen esté limpia (el payload puede estar cifrado, comprimido o repartido con un PRNG)."
    );
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      notes.push(
        "Los formatos con compresión con pérdida (JPG) suelen destruir cualquier carga útil incrustada en el LSB; considera usar PNG o BMP."
      );
    }

    const result: StegoResult = {
      fileName: file.name,
      fileSize: file.size,
      width,
      height,
      channels: ch,
      lsbHexPreview: hexPreview,
      lsbAsciiPreview: asciiPreview,
      detectedSignature,
      planeStats,
      textFragments,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        fileName: "",
        fileSize: 0,
        width: 0,
        height: 0,
        channels: 0,
        lsbHexPreview: "",
        lsbAsciiPreview: "",
        detectedSignature: null,
        planeStats: [],
        textFragments: [],
        notes: [
          `Error fatal: ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        ],
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "stego",
    description:
      "Analiza el plano LSB (Least Significant Bit) de una imagen PNG/BMP/JPG para detectar posibles mensajes ocultos.",
    method: "POST (multipart/form-data, field 'file')",
    maxBytes: MAX_BYTES,
    accepted: ACCEPTED_EXT,
    lsbBytes: MAX_LSB_BYTES,
    hexPreviewBytes: HEX_PREVIEW_BYTES,
    asciiPreviewBytes: ASCII_PREVIEW_BYTES,
  });
}
