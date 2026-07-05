import { NextRequest, NextResponse } from "next/server";

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

interface OpenSanctionsResult {
  id: string;
  caption?: string;
  schema?: string;
  properties?: Record<string, unknown>;
  datasets?: string[];
  summary?: string;
}

interface MatchResult {
  caption: string;
  schema: string;
  countries: string[];
  topics: string[];
  datasets: string[];
  summary: string;
  url: string;
}

interface SearchLink {
  label: string;
  url: string;
}

// Normalize an OpenSanctions property value into a list of readable strings.
function asStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          if (typeof obj.name === "string") return obj.name;
          if (typeof obj.q === "string") return obj.q;
          if (typeof obj.caption === "string") return obj.caption;
        }
        return String(v);
      })
      .filter((s) => s.length > 0);
  }
  if (typeof val === "string") return [val];
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const country = String(body?.country ?? "").trim();

    if (!name) {
      return NextResponse.json(
        {
          name: "",
          country,
          matches: [],
          searchLinks: [],
          notes: ["Nombre requerido."],
        },
        { status: 200 }
      );
    }

    const googleBase = "https://www.google.com/search?q=";
    const searchLinks: SearchLink[] = [
      {
        label: `"${name}" + "sanctioned"`,
        url: `${googleBase}${encodeURIComponent(`"${name}" "sanctioned"`)}`,
      },
      {
        label: `"${name}" + "PEP"`,
        url: `${googleBase}${encodeURIComponent(`"${name}" "PEP"`)}`,
      },
    ];
    if (country) {
      searchLinks.push({
        label: `"${name}" + "${country}" + "director"`,
        url: `${googleBase}${encodeURIComponent(
          `"${name}" "${country}" "director"`
        )}`,
      });
    }
    searchLinks.push({
      label: `OpenSanctions · "${name}"`,
      url: `https://www.opensanctions.org/search/?q=${encodeURIComponent(name)}`,
    });

    const notes: string[] = [];
    let matches: MatchResult[] = [];

    try {
      const res = await fetchWithTimeout(
        `https://api.opensanctions.org/search?q=${encodeURIComponent(name)}`,
        { headers: { Accept: "application/json" } },
        10000
      );
      if (!res.ok) {
        notes.push(
          `OpenSanctions API respondió HTTP ${res.status}; no se pudo consultar.`
        );
      } else {
        const data = await res.json();
        const results = (data.results ?? []) as OpenSanctionsResult[];
        matches = results.slice(0, 25).map((r) => {
          const props = r.properties ?? {};
          return {
            caption: r.caption ?? r.id,
            schema: r.schema ?? "",
            countries: asStringArray(props.countries),
            topics: asStringArray(props.topics),
            datasets: r.datasets ?? [],
            summary: r.summary ?? "",
            url: `https://www.opensanctions.org/entities/${r.id}/`,
          };
        });
        if (matches.length === 0) {
          notes.push(
            "No se encontraron coincidencias en OpenSanctions para este nombre."
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        notes.push(
          "OpenSanctions API tardó demasiado en responder (>10s)."
        );
      } else {
        notes.push(
          `No se pudo consultar OpenSanctions: ${
            err instanceof Error ? err.message : "error desconocido"
          }.`
        );
      }
    }

    return NextResponse.json(
      { name, country, matches, searchLinks, notes },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        name: "",
        country: "",
        matches: [],
        searchLinks: [],
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
    tool: "pep",
    description:
      "Busca un nombre en listas públicas de PEP y sanciones (OpenSanctions) y genera dorks de Google para due diligence.",
    method: "POST",
    body: { name: "string", country: "string?" },
    source: "OpenSanctions (api.opensanctions.org)",
  });
}
