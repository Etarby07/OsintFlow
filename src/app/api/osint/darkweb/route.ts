import { NextRequest, NextResponse } from "next/server";

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

interface DarkResult {
  title: string;
  url: string;
  snippet?: string;
}

// Extract .onion URLs (HTTP/HTTPS) from arbitrary text. We intentionally
// accept both v2 (16 chars) and v3 (56 chars) onion addresses.
const ONION_URL_RE =
  /https?:\/\/[a-z0-9]{16,56}\.onion(?:\/[^\s"'<>]*)?/gi;

interface AhmiaApiItem {
  title?: string;
  link?: string;
  url?: string;
  description?: string;
  snippet?: string;
  abstract?: string;
  content?: string;
  id?: string;
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

async function tryAhmiaApi(
  query: string,
  notes: string[]
): Promise<DarkResult[] | null> {
  try {
    const res = await fetchWithTimeout(
      `https://ahmia.fi/api/v3/search/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "OsintFlow/1.0 (+https://github.com/osintflow)",
        },
      },
      10000
    );
    if (!res.ok) {
      notes.push(`Ahmia API v3 respondió HTTP ${res.status}.`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      notes.push(
        "Ahmia API v3 no devolvió JSON; se usará el parser HTML como respaldo."
      );
      return null;
    }
    const json = (await res.json()) as {
      items?: AhmiaApiItem[];
      results?: AhmiaApiItem[];
      content?: AhmiaApiItem[];
    };
    const items = json.items ?? json.results ?? json.content ?? [];
    if (!Array.isArray(items) || items.length === 0) return null;

    const out: DarkResult[] = [];
    for (const item of items) {
      const url = readString(item.link) ?? readString(item.url) ?? readString(item.id);
      if (!url || !/\.onion/i.test(url)) continue;
      out.push({
        title: readString(item.title) || url,
        url,
        snippet:
          readString(item.description) ??
          readString(item.snippet) ??
          readString(item.abstract) ??
          readString(item.content),
      });
    }
    return out;
  } catch (err) {
    notes.push(
      err instanceof Error && err.name === "AbortError"
        ? "La consulta a la API v3 de Ahmia superó el tiempo de espera (>10s)."
        : "No se pudo consultar la API v3 de Ahmia; se intentará el parser HTML."
    );
    return null;
  }
}

async function tryAhmiaHtml(
  query: string,
  notes: string[]
): Promise<DarkResult[]> {
  try {
    const res = await fetchWithTimeout(
      `https://ahmia.fi/search/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (compatible; OsintFlow/1.0; +https://github.com/osintflow)",
        },
      },
      10000
    );
    if (!res.ok) {
      notes.push(`Ahmia (HTML) respondió HTTP ${res.status}.`);
      return [];
    }
    const html = await res.text();

    // Pull every .onion URL out of the page.
    const urlSet = new Map<string, { url: string; contexts: string[] }>();
    for (const match of html.matchAll(ONION_URL_RE)) {
      const url = match[0];
      if (!urlSet.has(url)) urlSet.set(url, { url, contexts: [] });
    }

    // Also try to extract <a href="...onion">Title</a> pairs so we get
    // sensible titles. We look for anchors whose href contains .onion.
    const anchorRe =
      /<a[^>]+href=["'](https?:\/\/[a-z0-9]{16,56}\.onion[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(anchorRe)) {
      const url = m[1];
      const innerHtml = m[2] ?? "";
      const title = innerHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const entry = urlSet.get(url) ?? { url, contexts: [] };
      if (title) entry.contexts.push(title);
      urlSet.set(url, entry);
    }

    // Fallback: capture text around each .onion URL to use as a snippet.
    for (const match of html.matchAll(ONION_URL_RE)) {
      const url = match[0];
      const entry = urlSet.get(url);
      if (!entry) continue;
      const start = Math.max(0, match.index! - 120);
      const end = Math.min(html.length, match.index! + url.length + 120);
      const slice = html
        .slice(start, end)
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (slice) entry.contexts.push(slice);
    }

    const results: DarkResult[] = [];
    for (const entry of urlSet.values()) {
      const title = entry.contexts.find((c) => c.length >= 3 && c.length <= 200) ?? entry.url;
      const snippet = entry.contexts
        .filter((c) => c !== title)
        .sort((a, b) => b.length - a.length)[0];
      results.push({
        title: title.length > 200 ? title.slice(0, 200) + "…" : title,
        url: entry.url,
        snippet: snippet ? (snippet.length > 300 ? snippet.slice(0, 300) + "…" : snippet) : undefined,
      });
    }
    return results.slice(0, 25);
  } catch (err) {
    notes.push(
      err instanceof Error && err.name === "AbortError"
        ? "La consulta a la página HTML de Ahmia superó el tiempo de espera (>10s)."
        : "No se pudo conectar con la página de búsqueda de Ahmia."
    );
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { error: "Consulta requerida" },
        { status: 400 }
      );
    }

    const notes: string[] = [];
    const searchUrl = `https://ahmia.fi/search/?q=${encodeURIComponent(query)}`;

    // 1) Try v3 API first.
    let results = await tryAhmiaApi(query, notes);

    // 2) Fallback: scrape the HTML results page.
    if (results === null || (results && results.length === 0)) {
      const htmlResults = await tryAhmiaHtml(query, notes);
      if (htmlResults.length > 0) {
        results = htmlResults;
        notes.unshift(
          "Resultados obtenidos por scraping del HTML de Ahmia (la API v3 no devolvió resultados utilizables)."
        );
      } else if (results === null) {
        results = [];
      }
    }

    if (results.length === 0) {
      notes.push(
        "No se encontraron resultados .onion para esta consulta, o no se pudo acceder a Ahmia en este momento."
      );
    }

    notes.push(
      "Los enlaces .onion solo se pueden abrir con el navegador Tor Browser: https://www.torproject.org/download/"
    );
    notes.push(
      "OsintFlow no aloja ni proxifica contenido .onion: solo muestra direcciones indexadas por Ahmia."
    );

    return NextResponse.json(
      { query, results, searchUrl, notes },
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
    tool: "darkweb",
    provider: "Ahmia (https://ahmia.fi)",
    description:
      "Busca menciones de un término en la red Tor mediante el motor Ahmia. Devuelve direcciones .onion; se necesita Tor Browser para abrir los enlaces.",
  });
}
