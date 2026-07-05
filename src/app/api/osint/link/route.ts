import { NextRequest, NextResponse } from "next/server";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_HOPS = 15;
const HOP_TIMEOUT_MS = 6000;

interface RedirectStep {
  url: string;
  status: number;
  location?: string;
}

interface WaybackInfo {
  timestamp?: string;
  url?: string;
  status?: string;
  calendarUrl: string;
}

interface LinkResult {
  input: string;
  finalUrl: string;
  title?: string;
  redirects: RedirectStep[];
  wayback?: WaybackInfo;
  notes: string[];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = HOP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

// Follow the redirect chain manually using `redirect: "manual"`, collecting
// every step { url, status, location }. Stop when a non-3xx response is
// reached, when the Location header is missing/invalid, when a network error
// occurs, or when MAX_HOPS is exceeded.
async function followRedirects(
  startUrl: string,
  notes: string[]
): Promise<{ steps: RedirectStep[]; finalUrl: string }> {
  const steps: RedirectStep[] = [];
  let currentUrl = startUrl;

  for (let i = 0; i < MAX_HOPS; i++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      notes.push(
        `Error de red en el salto ${i + 1} (${currentUrl}): ${
          err instanceof Error ? err.message : "desconocido"
        }.`
      );
      steps.push({ url: currentUrl, status: 0 });
      return { steps, finalUrl: currentUrl };
    }

    const location = res.headers.get("location") ?? undefined;
    steps.push({ url: currentUrl, status: res.status, location });

    // Drain the body so the underlying socket can be reused.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }

    if (isRedirectStatus(res.status) && location) {
      try {
        currentUrl = new URL(location, currentUrl).href;
      } catch {
        notes.push(
          `La cabecera Location "${location}" no es una URL válida; se detiene el seguimiento.`
        );
        return { steps, finalUrl: currentUrl };
      }
    } else {
      // Reached a terminal (non-redirect) response.
      return { steps, finalUrl: currentUrl };
    }
  }

  notes.push(
    `Se alcanzó el límite de ${MAX_HOPS} redirecciones; se detiene el seguimiento.`
  );
  return { steps, finalUrl: currentUrl };
}

// Best-effort fetch of the page <title>. 6s timeout, follows redirects.
async function fetchTitle(url: string): Promise<string | undefined> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: "follow",
        headers: { "User-Agent": DESKTOP_UA },
      },
      HOP_TIMEOUT_MS
    );
    if (!res.ok) return undefined;
    const ct = res.headers.get("content-type") ?? "";
    if (
      !ct.includes("text/html") &&
      !ct.includes("application/xhtml") &&
      !ct.includes("text/plain")
    ) {
      return undefined;
    }
    const html = await res.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match && match[1]) {
      const title = match[1]
        .replace(/\s+/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      return title || undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Query the Wayback Machine availability API for the closest snapshot.
async function queryWayback(
  url: string,
  notes: string[]
): Promise<WaybackInfo | undefined> {
  const calendarUrl = `https://web.archive.org/web/*/${url}`;
  try {
    const res = await fetchWithTimeout(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { headers: { Accept: "application/json" } },
      HOP_TIMEOUT_MS
    );
    if (!res.ok) {
      notes.push(
        `Wayback Machine devolvió HTTP ${res.status}; no se pudo comprobar capturas.`
      );
      return { calendarUrl };
    }
    const data = await res.json();
    const closest = data?.archived_snapshots?.closest;
    if (closest && closest.available && closest.url) {
      return {
        timestamp: closest.timestamp,
        url: closest.url,
        status: closest.status != null ? String(closest.status) : undefined,
        calendarUrl,
      };
    }
    notes.push("No hay capturas históricas disponibles en Wayback Machine.");
    return { calendarUrl };
  } catch (err) {
    notes.push(
      `No se pudo consultar Wayback Machine: ${
        err instanceof Error ? err.message : "error desconocido"
      }.`
    );
    return { calendarUrl };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = String(body?.url ?? "").trim();

    if (!url) {
      return NextResponse.json(
        {
          input: "",
          finalUrl: "",
          redirects: [],
          notes: ["URL requerida."],
        },
        { status: 200 }
      );
    }

    // Ensure it has a scheme; if missing, prepend https://.
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // Validate the resulting URL.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        {
          input: url,
          finalUrl: url,
          redirects: [],
          notes: ["La URL proporcionada no es válida."],
        },
        { status: 200 }
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        {
          input: url,
          finalUrl: url,
          redirects: [],
          notes: ["Solo se admiten URLs con esquema http:// o https://."],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];
    const { steps, finalUrl } = await followRedirects(url, notes);

    // Page title (best-effort).
    const title = await fetchTitle(finalUrl);
    if (!title && steps.some((s) => s.status >= 200 && s.status < 300)) {
      notes.push("No se pudo extraer el título de la página final.");
    }

    // Wayback Machine.
    const wayback = await queryWayback(finalUrl, notes);

    const result: LinkResult = {
      input: url,
      finalUrl,
      title,
      redirects: steps,
      wayback,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Only truly fatal errors reach here.
    return NextResponse.json(
      {
        input: "",
        finalUrl: "",
        redirects: [],
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
    tool: "link-analyzer",
    description:
      "Sigue la cadena de redirecciones de una URL (acortadores, etc.) y consulta Wayback Machine para capturas históricas.",
    method: "POST",
    body: { url: "string" },
    maxHops: MAX_HOPS,
    hopTimeoutMs: HOP_TIMEOUT_MS,
  });
}
