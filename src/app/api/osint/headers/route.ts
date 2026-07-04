import { NextRequest, NextResponse } from "next/server";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

interface RawHeader {
  key: string;
  value: string;
}

type Severity = "good" | "bad" | "info";

interface SecurityCheck {
  header: string;
  present: boolean;
  value?: string;
  severity: Severity;
  explanation: string;
}

interface HeadersResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: RawHeader[];
  checks: SecurityCheck[];
  notes: string[];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = TIMEOUT_MS
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

// Follow redirects manually, capped at MAX_REDIRECTS. Returns the final
// Response (or null if everything failed). `method` is HEAD or GET.
async function fetchFinal(
  startUrl: string,
  method: "HEAD" | "GET",
  notes: string[]
): Promise<{ res: Response | null; finalUrl: string; hops: number }> {
  let currentUrl = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(currentUrl, {
        method,
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
        `Error de red en ${method} ${currentUrl}: ${
          err instanceof Error ? err.message : "desconocido"
        }.`
      );
      return { res: null, finalUrl: currentUrl, hops: i };
    }
    if (isRedirectStatus(res.status)) {
      const loc = res.headers.get("location");
      // Drain body.
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      if (!loc) {
        notes.push(
          `Redirección ${res.status} sin cabecera Location; se detiene el seguimiento.`
        );
        return { res, finalUrl: currentUrl, hops: i };
      }
      if (i === MAX_REDIRECTS) {
        notes.push(
          `Se alcanzó el límite de ${MAX_REDIRECTS} redirecciones; se detiene el seguimiento.`
        );
        return { res, finalUrl: currentUrl, hops: i };
      }
      try {
        currentUrl = new URL(loc, currentUrl).href;
      } catch {
        notes.push(
          `La cabecera Location "${loc}" no es una URL válida; se detiene el seguimiento.`
        );
        return { res, finalUrl: currentUrl, hops: i };
      }
      continue;
    }
    return { res, finalUrl: currentUrl, hops: i };
  }
  return { res: null, finalUrl: currentUrl, hops: MAX_REDIRECTS };
}

// Build the security analysis array from response headers (case-insensitive).
function analyzeSecurity(headers: Headers): SecurityCheck[] {
  const checks: SecurityCheck[] = [];
  const hsts = headers.get("strict-transport-security");
  checks.push({
    header: "Strict-Transport-Security",
    present: !!hsts,
    value: hsts ?? undefined,
    severity: hsts ? "good" : "bad",
    explanation:
      "Fuerza el uso de HTTPS para que el navegador nunca se conecte por HTTP.",
  });
  const csp = headers.get("content-security-policy");
  checks.push({
    header: "Content-Security-Policy",
    present: !!csp,
    value: csp ?? undefined,
    severity: csp ? "good" : "bad",
    explanation:
      "Restringe qué scripts, estilos y recursos puede cargar la página.",
  });
  const xfo = headers.get("x-frame-options");
  checks.push({
    header: "X-Frame-Options",
    present: !!xfo,
    value: xfo ?? undefined,
    severity: xfo ? "good" : "bad",
    explanation:
      "Evita que la página sea embebida en un iframe (protección contra clickjacking).",
  });
  const xcto = headers.get("x-content-type-options");
  checks.push({
    header: "X-Content-Type-Options",
    present: !!xcto,
    value: xcto ?? undefined,
    severity: xcto ? "good" : "bad",
    explanation:
      "Impide al navegador adivinar el tipo MIME de los recursos (MIME sniffing).",
  });
  const rp = headers.get("referrer-policy");
  checks.push({
    header: "Referrer-Policy",
    present: !!rp,
    value: rp ?? undefined,
    severity: rp ? "good" : "bad",
    explanation:
      "Controla cuánta información del Referer se envía al navegar a otros sitios.",
  });
  const pp = headers.get("permissions-policy");
  checks.push({
    header: "Permissions-Policy",
    present: !!pp,
    value: pp ?? undefined,
    severity: pp ? "good" : "bad",
    explanation:
      "Deshabilita o restringe APIs del navegador (cámara, geolocalización, micrófono...).",
  });
  const coop = headers.get("cross-origin-opener-policy");
  checks.push({
    header: "Cross-Origin-Opener-Policy",
    present: !!coop,
    value: coop ?? undefined,
    severity: coop ? "good" : "bad",
    explanation:
      "Aísla el contexto de navegación para dificultar ataques cross-origin.",
  });
  const coep = headers.get("cross-origin-embedder-policy");
  checks.push({
    header: "Cross-Origin-Embedder-Policy",
    present: !!coep,
    value: coep ?? undefined,
    severity: coep ? "good" : "bad",
    explanation:
      "Exige que todos los recursos cross-origin se carguen con CORS explícito.",
  });
  const xxp = headers.get("x-xss-protection");
  checks.push({
    header: "X-XSS-Protection",
    present: !!xxp,
    value: xxp ?? undefined,
    severity: "info",
    explanation:
      "Cabecera legacy del filtro XSS de IE; hoy se considera obsoleta y se recomienda usar CSP en su lugar.",
  });
  return checks;
}

// Convert a Headers object to a sorted array of { key, value } with lowercase
// keys, deduplicated (the last value wins for repeated headers, except
// set-cookie which is joined).
function headersToArray(headers: Headers): RawHeader[] {
  const out: RawHeader[] = [];
  const seen = new Set<string>();
  // First, handle set-cookie specially (multiple values).
  try {
    const cookies = (headers as Headers & {
      getSetCookie?: () => string[];
    }).getSetCookie?.();
    if (cookies && cookies.length > 0) {
      out.push({ key: "set-cookie", value: cookies.join("\n") });
      seen.add("set-cookie");
    }
  } catch {
    /* ignore */
  }
  // Then iterate the rest.
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "set-cookie" && seen.has("set-cookie")) return;
    out.push({ key: k, value });
    seen.add(k);
  });
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = String(body?.url ?? "").trim();

    if (!url) {
      return NextResponse.json(
        {
          url: "",
          finalUrl: "",
          statusCode: 0,
          headers: [],
          checks: [],
          notes: ["URL requerida."],
        },
        { status: 200 }
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        {
          url,
          finalUrl: url,
          statusCode: 0,
          headers: [],
          checks: [],
          notes: ["La URL proporcionada no es válida."],
        },
        { status: 200 }
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        {
          url,
          finalUrl: url,
          statusCode: 0,
          headers: [],
          checks: [],
          notes: ["Solo se admiten URLs con esquema http:// o https://."],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];

    // 1) Try HEAD.
    let { res, finalUrl } = await fetchFinal(url, "HEAD", notes);

    // 2) Fallback to GET if HEAD is not supported or failed entirely.
    if (!res || res.status === 405 || res.status === 501 || res.status === 403) {
      const reason = !res
        ? "HEAD falló a nivel de red"
        : `HEAD devolvió HTTP ${res.status}`;
      notes.push(`${reason}; reintentando con GET.`);
      const get = await fetchFinal(url, "GET", notes);
      if (get.res) {
        res = get.res;
        finalUrl = get.finalUrl;
      }
    }

    if (!res) {
      return NextResponse.json(
        {
          url,
          finalUrl,
          statusCode: 0,
          headers: [],
          checks: [],
          notes,
        },
        { status: 200 }
      );
    }

    // Drain the body if GET (we don't need it).
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }

    const headersArr = headersToArray(res.headers);
    const checks = analyzeSecurity(res.headers);

    const goodCount = checks.filter((c) => c.severity === "good").length;
    const badCount = checks.filter((c) => c.severity === "bad").length;
    notes.push(
      `${goodCount} de ${checks.length} cabeceras de seguridad presentes; ${badCount} faltantes.`
    );

    const result: HeadersResult = {
      url,
      finalUrl,
      statusCode: res.status,
      headers: headersArr,
      checks,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        url: "",
        finalUrl: "",
        statusCode: 0,
        headers: [],
        checks: [],
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
    tool: "headers",
    description:
      "Extrae y analiza las cabeceras HTTP de seguridad de una URL (HSTS, CSP, X-Frame-Options, etc.) indicando cuáles están activas y cuáles faltan.",
    method: "POST",
    body: { url: "string" },
    timeoutMs: TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    headersChecked: [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
      "permissions-policy",
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "x-xss-protection",
    ],
  });
}
