import { NextRequest, NextResponse } from "next/server";

// Paste sites we generate Google dork URLs for.
const PASTE_SITES = [
  "pastebin.com",
  "gist.github.com",
  "ghostbin.com",
  "rentry.co",
  "paste.debian.net",
  "paste.ubuntu.com",
  "hastebin.com",
  "0bin.net",
];

interface SearchLink {
  site: string;
  dork: string;
  url: string;
}

interface GithubItem {
  repo: string;
  name: string;
  html_url: string;
  score?: number;
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

interface GithubResponse {
  total_count?: number;
  items?: Array<{
    name?: string;
    html_url?: string;
    repository?: { full_name?: string };
    score?: number;
  }>;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const term = String(body?.term ?? "").trim();

    if (!term) {
      return NextResponse.json(
        { error: "Término de búsqueda requerido" },
        { status: 400 }
      );
    }

    const notes: string[] = [];
    const searchLinks: SearchLink[] = PASTE_SITES.map((site) => {
      const dork = `site:${site} "${term}"`;
      return {
        site,
        dork,
        url: `https://www.google.com/search?q=${encodeURIComponent(dork)}`,
      };
    });

    // GitHub code search (anonymous, heavily rate-limited but works for a few
    // requests per hour). Returns code/gist matches.
    const githubResults: GithubItem[] = [];
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/search/code?q=${encodeURIComponent(term)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "OsintFlow/1.0",
          },
        },
        8000
      );

      if (res.status === 200) {
        const data = (await res.json()) as GithubResponse;
        const items = Array.isArray(data.items) ? data.items : [];
        for (const item of items.slice(0, 10)) {
          githubResults.push({
            repo: item.repository?.full_name ?? "",
            name: item.name ?? "",
            html_url: item.html_url ?? "",
            score: typeof item.score === "number" ? item.score : undefined,
          });
        }
        if (githubResults.length === 0) {
          notes.push(
            "GitHub no devolvió resultados de código para este término."
          );
        } else {
          notes.push(
            `GitHub code search: ${githubResults.length} resultado${
              githubResults.length === 1 ? "" : "s"
            }${
              typeof data.total_count === "number"
                ? ` (de ${data.total_count} totales)`
                : ""
            }.`
          );
        }
      } else if (res.status === 403) {
        notes.push(
          "GitHub respondió 403 (rate limit anónimo superado). Inténtalo más tarde o usa un token OAuth para aumentar el límite."
        );
      } else if (res.status === 422) {
        notes.push(
          "GitHub rechazó la consulta (422). Prueba con un término más simple o entre comillas."
        );
      } else {
        notes.push(`GitHub code search respondió HTTP ${res.status}.`);
      }
    } catch (err) {
      notes.push(
        err instanceof Error && err.name === "AbortError"
          ? "La consulta a GitHub superó el tiempo de espera (>8s)."
          : "No se pudo conectar con la API de GitHub code search."
      );
    }

    notes.push(
      "Los enlaces de Google dork abren una búsqueda en Google con el operador site: ya aplicado; revisa los resultados manualmente."
    );
    notes.push(
      "Pastebin y servicios similares permiten albergar texto de forma efímera: si tu término (email, dominio, frase interna) aparece, puede indicar una fuga de credenciales o datos internos."
    );

    return NextResponse.json(
      { term, searchLinks, githubResults, notes },
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
    tool: "pastebin",
    providers: ["Google (dorks)", "GitHub code search API"],
    sites: PASTE_SITES,
    description:
      "Busca un email, dominio o término en repositorios de texto públicos (Pastebin, GitHub Gists, etc.) mediante Google dorks y la API anónima de GitHub code search.",
  });
}
