import { NextRequest, NextResponse } from "next/server";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PER_PATH_TIMEOUT_MS = 5000;
const CONCURRENCY = 6;
const TOTAL_DEADLINE_MS = 90_000;

// Built-in wordlist of ~70 common paths that often expose admin panels,
// backups, version-control metadata, configuration files or other sensitive
// resources on a web server.
const WORDLIST: string[] = [
  "/admin/",
  "/admin.php",
  "/admin/login.php",
  "/administrator/",
  "/.git/",
  "/.git/config",
  "/.git/HEAD",
  "/.env",
  "/.env.local",
  "/backup.zip",
  "/backup.tar.gz",
  "/backup.sql",
  "/db.sql",
  "/dump.sql",
  "/robots.txt",
  "/sitemap.xml",
  "/wp-admin/",
  "/wp-login.php",
  "/wp-config.php",
  "/phpinfo.php",
  "/info.php",
  "/config.php",
  "/configuration.php",
  "/api/",
  "/api/v1/",
  "/api/v2/",
  "/.htaccess",
  "/.htpasswd",
  "/server-status",
  "/server-info",
  "/uploads/",
  "/files/",
  "/private/",
  "/test/",
  "/dev/",
  "/staging/",
  "/old/",
  "/tmp/",
  "/logs/",
  "/debug/",
  "/.svn/",
  "/.svn/entries",
  "/.DS_Store",
  "/composer.json",
  "/package.json",
  "/yarn.lock",
  "/web.config",
  "/crossdomain.xml",
  "/clientaccesspolicy.xml",
  "/favicon.ico",
  "/login/",
  "/signin/",
  "/register/",
  "/signup/",
  "/dashboard/",
  "/panel/",
  "/cpanel/",
  "/control/",
  "/manage/",
  "/graphql",
  "/.well-known/security.txt",
  "/status",
  "/health",
  "/metrics",
  "/console/",
  "/phpmyadmin/",
  "/pma/",
  "/mysqladmin/",
  "/vendor/",
  "/node_modules/",
  "/storage/",
  "/cache/",
  "/secret/",
  "/secrets/",
  "/credentials.json",
  "/id_rsa",
];

interface FoundItem {
  path: string;
  status: number;
  location?: string;
}

interface DirBusterResult {
  url: string;
  scanned: number;
  found: FoundItem[];
  notes: string[];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe a single path. Returns a FoundItem for any non-404 response, or null
 * for 404s / network errors / timeouts.
 */
async function checkPath(
  baseUrl: string,
  path: string,
  deadline: number
): Promise<FoundItem | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const timeoutMs = Math.min(PER_PATH_TIMEOUT_MS, remaining);
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}${path}`,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      timeoutMs
    );
    // Drain the body so the underlying socket can be reused.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }

    const status = res.status;
    if (status === 404) return null;
    const location = res.headers.get("location") ?? undefined;
    return { path, status, location };
  } catch {
    // Network error / timeout / abort — treat as "missing".
    return null;
  }
}

/**
 * Simple bounded-concurrency pool.  Up to `size` workers pull indices from a
 * shared counter and call `fn`.  Stops launching new tasks once `deadline`
 * (ms since epoch) is reached.
 */
async function runPool(
  paths: string[],
  size: number,
  deadline: number,
  fn: (path: string) => Promise<FoundItem | null>
): Promise<{ found: FoundItem[]; scanned: number }> {
  const found: FoundItem[] = [];
  let next = 0;
  let scanned = 0;

  async function worker() {
    while (true) {
      if (Date.now() > deadline) return;
      const idx = next;
      next += 1;
      if (idx >= paths.length) return;
      const item = await fn(paths[idx]);
      scanned += 1;
      if (item) found.push(item);
    }
  }

  const workers = Array.from(
    { length: Math.min(size, paths.length) },
    () => worker()
  );
  await Promise.all(workers);
  return { found, scanned };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = String(body?.url ?? "").trim();

    if (!url) {
      return NextResponse.json(
        {
          url: "",
          scanned: 0,
          found: [],
          notes: ["Debes introducir una URL."],
        },
        { status: 200 }
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    // Strip trailing slash(es) so we can append "/admin/" etc. cleanly.
    url = url.replace(/\/+$/, "");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        {
          url,
          scanned: 0,
          found: [],
          notes: ["La URL proporcionada no es válida."],
        },
        { status: 200 }
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        {
          url,
          scanned: 0,
          found: [],
          notes: ["Solo se admiten URLs http:// o https://."],
        },
        { status: 200 }
      );
    }

    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const deadline = Date.now() + TOTAL_DEADLINE_MS;

    const { found, scanned } = await runPool(
      WORDLIST,
      CONCURRENCY,
      deadline,
      (path) => checkPath(baseUrl, path, deadline)
    );

    // Sort found items: 200 first, then 3xx, then 4xx, then others.
    const rank = (s: number): number => {
      if (s === 200) return 0;
      if (s >= 300 && s < 400) return 1;
      if (s === 401 || s === 403) return 2;
      return 3;
    };
    found.sort((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      return a.path.localeCompare(b.path);
    });

    const notes: string[] = [];
    notes.push(
      "Solo escanea sitios de tu propiedad o para los que tienes autorización explícita. Escanear sitios sin permiso puede ser ilegal."
    );
    notes.push(
      `Se sondearon ${scanned} rutas con concurrencia ${CONCURRENCY} y un límite total de ${
        TOTAL_DEADLINE_MS / 1000
      }s.`
    );
    if (scanned < WORDLIST.length) {
      notes.push(
        `El escaneo se detuvo tras alcanzar el límite de tiempo; faltaron por sondear ${
          WORDLIST.length - scanned
        } rutas.`
      );
    }
    if (found.length === 0) {
      notes.push(
        "No se encontraron rutas interesantes (todas respondieron 404 o hubo error de red)."
      );
    } else {
      const redirects = found.filter(
        (f) => f.status >= 300 && f.status < 400
      ).length;
      const protectedCount = found.filter(
        (f) => f.status === 401 || f.status === 403
      ).length;
      const okCount = found.filter((f) => f.status === 200).length;
      notes.push(
        `Resultados: ${okCount} rutas accesibles (200), ${protectedCount} protegidas (401/403), ${redirects} redirecciones (3xx).`
      );
    }
    notes.push(
      "Las redirecciones y los 401/403 también son informativos: indican que el recurso existe pero está protegido o movido."
    );

    const result: DirBusterResult = {
      url: baseUrl,
      scanned,
      found,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        url: "",
        scanned: 0,
        found: [],
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
    tool: "dirbuster",
    description:
      "Escanea rutas comunes (/admin/, /.git/, /backup.zip, /robots.txt, etc.) en una URL para encontrar paneles, copias de seguridad o archivos de configuración expuestos.",
    method: "POST",
    body: { url: "string" },
    wordlistSize: WORDLIST.length,
    concurrency: CONCURRENCY,
    perPathTimeoutMs: PER_PATH_TIMEOUT_MS,
    totalDeadlineMs: TOTAL_DEADLINE_MS,
    ethical:
      "Solo escanea sitios de tu propiedad o para los que tienes autorización explícita.",
  });
}
