import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

// Decode common HTML entities + strip tags from a cell's inner HTML.
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Extract rows of <td> cells from every <tr> in the HTML.
function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(rowHtml)) !== null) {
      cells.push(cleanCell(tdMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// Query RDAP for current WHOIS info on the domain.
async function getCurrentWhois(
  domain: string,
  notes: string[]
): Promise<{
  registrar?: string;
  createdDate?: string;
  updatedDate?: string;
  expiryDate?: string;
  nameServers: string[];
  status: string[];
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      { headers: { Accept: "application/rdap+json" } },
      8000
    );
    if (!res.ok) {
      notes.push(`RDAP respondió HTTP ${res.status} para ${domain}.`);
      return null;
    }
    const data = await res.json();
    const events = (data.events ?? []) as {
      eventAction: string;
      eventDate: string;
    }[];
    const getEvent = (action: string) =>
      events.find((e) => e.eventAction === action)?.eventDate;

    const entities = (data.entities ?? []) as unknown as {
      roles?: string[];
      vcardArray?: unknown[];
    }[];
    const registrarEntity = entities.find((e) =>
      (e.roles ?? []).includes("registrar")
    );
    let registrar: string | undefined;
    if (registrarEntity?.vcardArray?.[1]) {
      const vcard = registrarEntity.vcardArray[1] as unknown[][];
      const fn = vcard.find((f) => Array.isArray(f) && f[0] === "fn");
      if (fn && fn[3]) registrar = String(fn[3]);
    }

    const statuses = (data.status ?? []) as string[];
    const nsArray = (data.nameservers ?? []) as { ldhName?: string }[];
    return {
      registrar,
      createdDate: getEvent("registration"),
      updatedDate: getEvent("last changed"),
      expiryDate: getEvent("expiration"),
      nameServers: nsArray
        .map((n) => n.ldhName?.toLowerCase())
        .filter((v): v is string => Boolean(v)),
      status: statuses,
    };
  } catch (err) {
    notes.push(
      `No se pudo consultar RDAP: ${
        err instanceof Error ? err.message : "error desconocido"
      }.`
    );
    return null;
  }
}

// Scrape viewdns.info/iphistory for the historical IP addresses of a domain.
async function getIpHistory(
  domain: string,
  notes: string[]
): Promise<{ ip: string; date: string }[]> {
  try {
    const res = await fetchWithTimeout(
      `https://viewdns.info/iphistory/?domain=${encodeURIComponent(domain)}`,
      {
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      12000
    );
    if (!res.ok) {
      notes.push(`viewdns.info (iphistory) respondió HTTP ${res.status}.`);
      return [];
    }
    const html = await res.text();
    // Detect block pages.
    if (
      /Too many requests|blocked|Cloudflare|access denied|captcha/i.test(
        html
      ) &&
      !/<table[^>]*>[\s\S]*IP Address/i.test(html)
    ) {
      return [];
    }
    const rows = parseHtmlTable(html);
    const out: { ip: string; date: string }[] = [];
    for (const cells of rows) {
      if (cells.length < 4) continue;
      const ip = cells[0];
      const date = cells[3];
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        out.push({ ip, date });
      }
    }
    if (out.length === 0) {
      notes.push(
        "No se pudo parsear la tabla de historial de IPs de viewdns.info."
      );
    }
    return out;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      notes.push(
        "viewdns.info (iphistory) tardó demasiado en responder (>12s)."
      );
    } else {
      notes.push(
        `No se pudo consultar viewdns.info para historial de IPs: ${
          err instanceof Error ? err.message : "error desconocido"
        }.`
      );
    }
    return [];
  }
}

// Scrape viewdns.info/reverseip for the list of domains sharing an IP.
async function getReverseIp(
  ip: string,
  notes: string[]
): Promise<{ domain: string; lastResolved: string }[]> {
  try {
    const res = await fetchWithTimeout(
      `https://viewdns.info/reverseip/?host=${encodeURIComponent(ip)}`,
      {
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      12000
    );
    if (!res.ok) {
      notes.push(`viewdns.info (reverseip) respondió HTTP ${res.status}.`);
      return [];
    }
    const html = await res.text();
    if (
      /Too many requests|blocked|Cloudflare|access denied|captcha/i.test(
        html
      ) &&
      !/<table[^>]*>[\s\S]*Domain/i.test(html)
    ) {
      return [];
    }
    const rows = parseHtmlTable(html);
    const out: { domain: string; lastResolved: string }[] = [];
    for (const cells of rows) {
      if (cells.length < 2) continue;
      const domain = cells[0];
      const lastResolved = cells[1];
      // Skip header rows.
      if (/domain|dominio/i.test(domain)) continue;
      if (DOMAIN_RE.test(domain)) {
        out.push({ domain, lastResolved });
      }
    }
    if (out.length === 0) {
      notes.push(
        "No se pudo parsear la tabla de DNS inversa de viewdns.info."
      );
    }
    return out;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      notes.push(
        "viewdns.info (reverseip) tardó demasiado en responder (>12s)."
      );
    } else {
      notes.push(
        `No se pudo consultar viewdns.info para DNS inversa: ${
          err instanceof Error ? err.message : "error desconocido"
        }.`
      );
    }
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawDomain = normalizeDomain(String(body?.domain ?? ""));

    if (!rawDomain) {
      return NextResponse.json(
        {
          domain: "",
          currentWhois: null,
          ipHistory: [],
          reverseIp: [],
          notes: ["Dominio requerido."],
        },
        { status: 200 }
      );
    }
    if (!DOMAIN_RE.test(rawDomain)) {
      return NextResponse.json(
        {
          domain: rawDomain,
          currentWhois: null,
          ipHistory: [],
          reverseIp: [],
          notes: [
            "El formato del dominio no es válido. Ejemplo válido: example.com",
          ],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];

    // RDAP and IP history can run in parallel.
    const [currentWhois, ipHistory] = await Promise.all([
      getCurrentWhois(rawDomain, notes),
      getIpHistory(rawDomain, notes),
    ]);

    // Resolve the current A record to find an IP for the reverse lookup.
    let reverseIp: { domain: string; lastResolved: string }[] = [];
    let firstIp: string | null = null;
    try {
      const aRecords = await dns.resolve4(rawDomain);
      if (aRecords.length > 0) {
        firstIp = aRecords[0];
        reverseIp = await getReverseIp(firstIp, notes);
      } else {
        notes.push(
          "El dominio no tiene registros A; no se puede hacer DNS inversa."
        );
      }
    } catch (err) {
      notes.push(
        `No se pudo resolver el registro A: ${
          err instanceof Error ? err.message : "error desconocido"
        }.`
      );
    }

    if (ipHistory.length === 0 && reverseIp.length === 0) {
      notes.push(
        "viewdns.info no permitió la consulta; inténtalo más tarde o desde otra IP."
      );
    }

    return NextResponse.json(
      { domain: rawDomain, currentWhois, ipHistory, reverseIp, notes },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        domain: "",
        currentWhois: null,
        ipHistory: [],
        reverseIp: [],
        notes: [
          `Error fatal: ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        ],
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "whoishistory",
    description:
      "Muestra el WHOIS actual (vía RDAP), el historial de IPs y los dominios que comparten la IP actual de un dominio (DNS inversa).",
    method: "POST",
    body: { domain: "string" },
    sources: ["rdap.org", "viewdns.info/iphistory", "viewdns.info/reverseip"],
  });
}
