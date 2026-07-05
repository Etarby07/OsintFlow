import { NextRequest, NextResponse } from "next/server";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 512 * 1024; // ~500KB

interface Technology {
  category: string;
  name: string;
  version?: string;
  evidence: string;
}

interface TechStackResult {
  url: string;
  finalUrl: string;
  technologies: Technology[];
  title?: string;
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

// Case-insensitive header lookup.
function getHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name.toLowerCase()) ?? undefined;
}

// Extract <title> from HTML (best-effort).
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1]) {
    return m[1]
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
  return undefined;
}

// Decode HTML entities in a generator meta content value.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Extract version number from a string like "nginx/1.25.3" or "WordPress 6.4".
function extractVersion(s: string): string | undefined {
  const m = s.match(/(\d+(?:\.\d+){0,3}(?:[.-]?[a-z0-9]+)?)/i);
  if (m && m[1]) {
    // Sanity: require at least one digit
    if (/\d/.test(m[1])) return m[1];
  }
  return undefined;
}

// Parse the <meta name="generator" content="..."> tags from the HTML.
function parseGenerators(html: string): string[] {
  const out: string[] = [];
  const re = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(decodeEntities(m[1]));
  }
  // Also handle the inverse order: content before name
  const re2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/gi;
  while ((m = re2.exec(html)) !== null) {
    out.push(decodeEntities(m[1]));
  }
  return out;
}

interface DetectContext {
  html: string;
  headers: Headers;
  setCookie: string;
  generators: string[];
  technologies: Technology[];
  notes: string[];
}

function addTech(
  ctx: DetectContext,
  category: string,
  name: string,
  evidence: string,
  version?: string
) {
  // Avoid duplicate (same category + name).
  if (ctx.technologies.some((t) => t.category === category && t.name === name)) {
    return;
  }
  ctx.technologies.push({ category, name, evidence, version });
}

function detectWebServers(ctx: DetectContext) {
  const server = getHeader(ctx.headers, "server");
  if (!server) return;
  const lower = server.toLowerCase();
  const map: { name: string; needle: string }[] = [
    { name: "Nginx", needle: "nginx" },
    { name: "Apache", needle: "apache" },
    { name: "LiteSpeed", needle: "litespeed" },
    { name: "Caddy", needle: "caddy" },
    { name: "Microsoft-IIS", needle: "microsoft-iis" },
    { name: "openresty", needle: "openresty" },
  ];
  for (const { name, needle } of map) {
    if (lower.includes(needle)) {
      const v = extractVersion(server.split(needle)[1] ?? server);
      addTech(ctx, "Servidor web", name, `Cabecera Server: ${server}`, v);
      return;
    }
  }
  // Unknown server: still record it.
  addTech(ctx, "Servidor web", server, `Cabecera Server: ${server}`);
}

function detectLanguages(ctx: DetectContext) {
  const powered = getHeader(ctx.headers, "x-powered-by");
  if (powered) {
    const lower = powered.toLowerCase();
    if (lower.includes("php")) {
      const v = extractVersion(lower.split("php")[1] ?? powered);
      addTech(ctx, "Lenguaje / Runtime", "PHP", `X-Powered-By: ${powered}`, v);
    } else if (lower.includes("asp.net") || lower.includes("asp .net")) {
      addTech(ctx, "Lenguaje / Runtime", "ASP.NET", `X-Powered-By: ${powered}`);
    } else if (lower.includes("jsp") || lower.includes("servlet")) {
      addTech(ctx, "Lenguaje / Runtime", "Java/JSP", `X-Powered-By: ${powered}`);
    } else if (lower.includes("express")) {
      addTech(
        ctx,
        "Lenguaje / Runtime",
        "Node.js (Express)",
        `X-Powered-By: ${powered}`
      );
    } else {
      // Record any other powered-by as a runtime hint.
      addTech(ctx, "Lenguaje / Runtime", powered, `X-Powered-By: ${powered}`);
    }
  }
  // Session-cookie based detection.
  const sc = ctx.setCookie.toLowerCase();
  if (sc.includes("phpsessid")) {
    addTech(ctx, "Lenguaje / Runtime", "PHP", "Cookie de sesión PHPSESSID");
  }
  if (sc.includes("asp.net_sessionid") || sc.includes("aspnetsession")) {
    addTech(ctx, "Lenguaje / Runtime", "ASP.NET", "Cookie ASP.NET_SessionId");
  }
  if (sc.includes("jsessionid")) {
    addTech(ctx, "Lenguaje / Runtime", "Java/JSP", "Cookie JSESSIONID");
  }
}

function detectCMS(ctx: DetectContext) {
  const html = ctx.html;
  const gens = ctx.generators;

  // From <meta name="generator">
  for (const g of gens) {
    const gl = g.toLowerCase();
    if (gl.includes("wordpress")) {
      addTech(ctx, "CMS", "WordPress", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("drupal")) {
      addTech(ctx, "CMS", "Drupal", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("joomla")) {
      addTech(ctx, "CMS", "Joomla", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("ghost")) {
      addTech(ctx, "CMS", "Ghost", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("hugo")) {
      addTech(ctx, "CMS", "Hugo", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("jekyll")) {
      addTech(ctx, "CMS", "Jekyll", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("hexo")) {
      addTech(ctx, "CMS", "Hexo", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("wix")) {
      addTech(ctx, "CMS", "Wix", `Meta generator: ${g}`);
    } else if (gl.includes("squarespace")) {
      addTech(ctx, "CMS", "Squarespace", `Meta generator: ${g}`);
    } else if (gl.includes("typo3")) {
      addTech(ctx, "CMS", "TYPO3", `Meta generator: ${g}`, extractVersion(g));
    } else if (gl.includes("contao")) {
      addTech(ctx, "CMS", "Contao", `Meta generator: ${g}`, extractVersion(g));
    }
  }

  // HTML-based fallbacks.
  if (/wp-content|wp-includes/i.test(html)) {
    addTech(ctx, "CMS", "WordPress", "Rutas wp-content / wp-includes en el HTML");
  }
  if (/Drupal\.settings/i.test(html)) {
    addTech(ctx, "CMS", "Drupal", "Objeto Drupal.settings en el HTML");
  }
  if (/\/media\/system\/js\//i.test(html) || /joomla/i.test(html)) {
    addTech(ctx, "CMS", "Joomla", "Rutas típicas de Joomla en el HTML");
  }
}

function detectJSFrameworks(ctx: DetectContext) {
  const html = ctx.html;
  if (/__NEXT_DATA__|__next_f|_next\/static/i.test(html)) {
    const m = html.match(/"version"\s*:\s*"([^"]+)"/);
    const v = m ? m[1] : undefined;
    addTech(
      ctx,
      "Framework JS",
      "Next.js",
      "Marcador __NEXT_DATA__ / _next/static en el HTML",
      v
    );
  }
  if (/__NUXT__|_nuxt\//i.test(html)) {
    addTech(ctx, "Framework JS", "Nuxt", "Marcador __NUXT__ en el HTML");
  }
  if (/data-reactroot|data-react-helmet|react\.production/i.test(html)) {
    addTech(ctx, "Framework JS", "React", "Atributos data-reactroot en el HTML");
  }
  if (/data-v-[0-9a-f]{8}|window\.Vue|vue\.runtime/i.test(html)) {
    addTech(ctx, "Framework JS", "Vue", "Atributos data-v-* / window.Vue");
  }
  const ng = html.match(/ng-version=["']([^"']+)["']/i);
  if (ng) {
    addTech(
      ctx,
      "Framework JS",
      "Angular",
      `Atributo ng-version="${ng[1]}"`,
      ng[1]
    );
  } else if (/ng-app|ng-controller|angular/i.test(html)) {
    addTech(ctx, "Framework JS", "Angular", "Directivas ng-app / ng-controller");
  }
  if (/__svelte|svelte-[a-z0-9]+/i.test(html)) {
    addTech(ctx, "Framework JS", "Svelte", "Marcador __svelte / svelte-*");
  }
  if (/jquery\.js|jquery-\d|jQuery v\d|jQuery JavaScript Library/i.test(html)) {
    const m = html.match(/jquery[^\d]*(\d+(?:\.\d+){1,3})/i);
    addTech(
      ctx,
      "Framework JS",
      "jQuery",
      "Inclusión de jQuery detectada en el HTML",
      m ? m[1] : undefined
    );
  }
  if (/x-data=|alpinejs|@alpinejs\//i.test(html)) {
    addTech(ctx, "Framework JS", "Alpine.js", "Directiva x-data en el HTML");
  }
}

function detectUI(ctx: DetectContext) {
  const html = ctx.html;
  if (/bootstrap(?:\.min)?\.css|bootstrap(?:\.min)?\.js|class="[^"]*\b(container|row|col-)\b/i.test(html)) {
    const m = html.match(/bootstrap[^\d]*(\d+(?:\.\d+){1,3})/i);
    addTech(
      ctx,
      "UI / CSS",
      "Bootstrap",
      "Hoja/script de Bootstrap en el HTML",
      m ? m[1] : undefined
    );
  }
  if (/cdn\.tailwindcss\.com|tailwind\.css|class="[^"]*\b(flex|grid|gap-|p-[0-9]|m-[0-9])\b/i.test(html)) {
    addTech(
      ctx,
      "UI / CSS",
      "Tailwind CSS",
      "Clases utilitarias de Tailwind / cdn.tailwindcss"
    );
  }
  if (/bulma(?:\.min)?\.css/i.test(html)) {
    addTech(ctx, "UI / CSS", "Bulma", "Hoja de Bulma en el HTML");
  }
  if (/mui|MuiButton|material-ui|@material-ui\//i.test(html)) {
    addTech(ctx, "UI / CSS", "Material-UI", "Marcadores de MUI / Material-UI");
  }
}

function detectAnalytics(ctx: DetectContext) {
  const html = ctx.html;
  if (/gtag\(|googletagmanager\.com\/gtag\/js|google-analytics\.com\/(ga|analytics|collect)/i.test(html)) {
    addTech(ctx, "Analítica", "Google Analytics", "Snippet gtag() / google-analytics");
  }
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{6,}/i.test(html)) {
    addTech(ctx, "Analítica", "Google Tag Manager", "Contenedor GTM detectado");
  }
  if (/plausible\.io\/js|data-domain=|plausible\.io\/api\/event/i.test(html)) {
    addTech(ctx, "Analítica", "Plausible", "Script de Plausible Analytics");
  }
  if (/matomo\.js|_paq\.push|matomo\.org|\/piwik\.js/i.test(html)) {
    addTech(ctx, "Analítica", "Matomo", "Script _paq / matomo.js");
  }
}

function detectCDN(ctx: DetectContext) {
  const headers = ctx.headers;
  const cfRay = getHeader(headers, "cf-ray");
  const setCookie = ctx.setCookie.toLowerCase();
  if (cfRay || setCookie.includes("__cf_bm") || setCookie.includes("cf_")) {
    addTech(ctx, "CDN / Hosting", "Cloudflare", `Cabecera cf-ray: ${cfRay ?? "(cookie __cf_bm)"}`);
  }
  const servedBy = getHeader(headers, "x-served-by");
  if (servedBy && /cache-|fastly/i.test(servedBy)) {
    addTech(ctx, "CDN / Hosting", "Fastly", `Cabecera x-served-by: ${servedBy}`);
  }
  if (getHeader(headers, "x-vercel-id") || getHeader(headers, "x-vercel-cache")) {
    const v = getHeader(headers, "x-vercel-id") ?? "";
    addTech(ctx, "CDN / Hosting", "Vercel", `Cabecera x-vercel-id: ${v}`);
  }
  if (getHeader(headers, "x-nf-request-id") || /netlify/i.test(ctx.html)) {
    addTech(ctx, "CDN / Hosting", "Netlify", "Cabecera x-nf-request-id");
  }
  if (getHeader(headers, "x-amz-cf-id") || getHeader(headers, "x-amz-cf-pop")) {
    addTech(ctx, "CDN / Hosting", "Amazon CloudFront", "Cabecera x-amz-cf-id");
  }
}

function detectEcommerce(ctx: DetectContext) {
  const html = ctx.html;
  if (/cdn\.shopify\.com|Shopify\.theme|window\.Shopify/i.test(html)) {
    addTech(ctx, "E-commerce", "Shopify", "Marcadores de Shopify en el HTML");
  }
  if (/magento|Mage\.cookies|skin\/frontend/i.test(html)) {
    addTech(ctx, "E-commerce", "Magento", "Marcadores de Magento en el HTML");
  }
  if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(html)) {
    addTech(ctx, "E-commerce", "WooCommerce", "Plugin WooCommerce sobre WordPress");
  }
  if (/prestashop|var prestashop/i.test(html)) {
    addTech(ctx, "E-commerce", "PrestaShop", "Marcadores de PrestaShop en el HTML");
  }
}

function detectDatabases(ctx: DetectContext) {
  const sc = ctx.setCookie.toLowerCase();
  if (sc.includes("redis") || sc.includes("sess_")) {
    addTech(ctx, "Base de datos / Caché", "Redis (posible)", "Cookie de sesión compatible con Redis");
  }
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
          technologies: [],
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
          technologies: [],
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
          technologies: [],
          notes: ["Solo se admiten URLs con esquema http:// o https://."],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];
    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        redirect: "follow",
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      notes.push(
        `No se pudo descargar la página: ${
          err instanceof Error ? err.message : "error desconocido"
        }.`
      );
      return NextResponse.json(
        { url, finalUrl: url, technologies: [], notes },
        { status: 200 }
      );
    }

    const finalUrl = res.url || url;
    const headers = res.headers;
    const statusCode = res.status;

    // Collect Set-Cookie (Node's fetch exposes all via getSetCookie when available).
    let setCookie = "";
    try {
      const cookies = (headers as Headers & {
        getSetCookie?: () => string[];
      }).getSetCookie?.();
      if (cookies && cookies.length > 0) setCookie = cookies.join("; ");
      else setCookie = getHeader(headers, "set-cookie") ?? "";
    } catch {
      setCookie = "";
    }

    // Read up to ~500KB of the body.
    let html = "";
    const ct = getHeader(headers, "content-type") ?? "";
    if (
      res.body &&
      (ct.includes("text/html") ||
        ct.includes("xhtml") ||
        ct.includes("text/plain") ||
        ct === "")
    ) {
      try {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < MAX_BODY_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.byteLength;
          }
        }
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
        html = buf.toString("utf8");
      } catch (err) {
        notes.push(
          `No se pudo leer el cuerpo de la respuesta: ${
            err instanceof Error ? err.message : "error desconocido"
          }.`
        );
      }
    } else {
      notes.push(
        `El Content-Type (${ct || "desconocido"}) no es HTML; análisis limitado a cabeceras.`
      );
    }

    const generators = parseGenerators(html);
    const title = extractTitle(html);

    const ctx: DetectContext = {
      html,
      headers,
      setCookie,
      generators,
      technologies: [],
      notes,
    };

    detectWebServers(ctx);
    detectLanguages(ctx);
    detectCMS(ctx);
    detectJSFrameworks(ctx);
    detectUI(ctx);
    detectAnalytics(ctx);
    detectCDN(ctx);
    detectEcommerce(ctx);
    detectDatabases(ctx);

    if (ctx.technologies.length === 0) {
      notes.push(
        "No se detectaron tecnologías concretas. La página puede usar un sitio estático o servir contenido dinámicamente."
      );
    }

    if (statusCode >= 400) {
      notes.push(`La página devolvió un código HTTP ${statusCode}.`);
    }

    const result: TechStackResult = {
      url,
      finalUrl,
      technologies: ctx.technologies,
      title,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        url: "",
        finalUrl: "",
        technologies: [],
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
    tool: "techstack",
    description:
      "Descarga una página web y detecta el servidor, CMS, frameworks JS, UI, analíticas, CDN y e-commerce mediante cabeceras y patrones en el HTML.",
    method: "POST",
    body: { url: "string" },
    timeoutMs: TIMEOUT_MS,
    categories: [
      "Servidor web",
      "Lenguaje / Runtime",
      "CMS",
      "Framework JS",
      "UI / CSS",
      "Analítica",
      "CDN / Hosting",
      "E-commerce",
      "Base de datos / Caché",
    ],
  });
}
