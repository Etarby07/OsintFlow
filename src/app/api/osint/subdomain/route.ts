import { NextRequest, NextResponse } from "next/server";

// Basic domain regex — allows multi-label domains with valid TLD.
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

interface CrtShEntry {
  name_value?: string;
  not_before?: string;
  not_after?: string;
  issuer_name?: string;
}

interface SubdomainInfo {
  name: string;
  firstSeen?: string;
  lastSeen?: string;
  certCount: number;
}

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 20000
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawDomain = normalizeDomain(String(body?.domain ?? ""));
    if (!rawDomain) {
      return NextResponse.json(
        { error: "Dominio requerido" },
        { status: 400 }
      );
    }
    if (!DOMAIN_RE.test(rawDomain)) {
      return NextResponse.json(
        {
          domain: rawDomain,
          count: 0,
          subdomains: [],
          notes: [
            "El formato del dominio no es válido. Ejemplo válido: apple.com",
          ],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];
    const query = `%.${rawDomain}`;
    const url = `https://crt.sh/?q=${encodeURIComponent(query)}&output=json`;

    let entries: CrtShEntry[] = [];
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        notes.push(
          `crt.sh respondió con código HTTP ${res.status}; no se pudieron obtener certificados.`
        );
        return NextResponse.json(
          { domain: rawDomain, count: 0, subdomains: [], notes },
          { status: 200 }
        );
      }
      const text = await res.text();
      // crt.sh sometimes returns an empty body when there are no matches.
      if (!text || !text.trim()) {
        notes.push(
          "crt.sh no respondió o no hay certificados registrados para este dominio."
        );
        return NextResponse.json(
          { domain: rawDomain, count: 0, subdomains: [], notes },
          { status: 200 }
        );
      }
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          notes.push(
            "La respuesta de crt.sh no tenía el formato esperado (no es una lista)."
          );
          return NextResponse.json(
            { domain: rawDomain, count: 0, subdomains: [], notes },
            { status: 200 }
          );
        }
        entries = parsed as CrtShEntry[];
      } catch {
        notes.push(
          "crt.sh devolvió una respuesta no JSON; posiblemente esté caído o saturado."
        );
        return NextResponse.json(
          { domain: rawDomain, count: 0, subdomains: [], notes },
          { status: 200 }
        );
      }
    } catch (err) {
      notes.push(
        err instanceof Error && err.name === "AbortError"
          ? "crt.sh tardó demasiado en responder (>20s). Inténtalo de nuevo más tarde."
          : "No se pudo conectar con crt.sh para obtener los certificados."
      );
      return NextResponse.json(
        { domain: rawDomain, count: 0, subdomains: [], notes },
        { status: 200 }
      );
    }

    if (entries.length === 0) {
      notes.push(
        "crt.sh no reportó certificados para este dominio en los registros de transparencia."
      );
      return NextResponse.json(
        { domain: rawDomain, count: 0, subdomains: [], notes },
        { status: 200 }
      );
    }

    const map = new Map<string, SubdomainInfo>();
    const domainSuffix = `.${rawDomain}`;

    for (const entry of entries) {
      const nameValue = entry.name_value;
      if (!nameValue) continue;
      // A certificate can cover multiple names separated by newlines.
      const names = nameValue.split(/\r?\n/);
      for (let rawName of names) {
        rawName = rawName.trim().toLowerCase();
        if (!rawName) continue;
        // Strip wildcard prefix.
        if (rawName.startsWith("*.")) rawName = rawName.slice(2);
        // Keep only names that equal the domain or end with .domain
        if (rawName !== rawDomain && !rawName.endsWith(domainSuffix)) {
          continue;
        }
        const existing = map.get(rawName);
        const notBefore = entry.not_before;
        const notAfter = entry.not_after;
        if (existing) {
          existing.certCount += 1;
          if (notBefore) {
            if (!existing.firstSeen || notBefore < existing.firstSeen) {
              existing.firstSeen = notBefore;
            }
          }
          if (notAfter) {
            if (!existing.lastSeen || notAfter > existing.lastSeen) {
              existing.lastSeen = notAfter;
            }
          }
        } else {
          map.set(rawName, {
            name: rawName,
            firstSeen: notBefore,
            lastSeen: notAfter,
            certCount: 1,
          });
        }
      }
    }

    const subdomains = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (subdomains.length === 0) {
      notes.push(
        "Se recibieron certificados desde crt.sh pero ninguno contenía subdominios válidos para este dominio."
      );
    }

    return NextResponse.json(
      {
        domain: rawDomain,
        count: subdomains.length,
        subdomains,
        notes,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "subdomain",
    provider: "crt.sh",
    description:
      "Consulta los registros de transparencia de certificados (Certificate Transparency Logs) vía crt.sh para descubrir subdominios de un dominio.",
    timeoutMs: 20000,
  });
}
