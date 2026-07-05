import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";

const IP_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
const IPV6_RE = /^([0-9a-f:]+)$/i;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Cloudflare IPv4 ranges (publicly documented).
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255))
    return null;
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function cidrContains(cidr: string, ip: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = parseInt(bits, 10);
  const baseInt = ipToInt(base);
  const ipInt = ipToInt(ip);
  if (baseInt == null || ipInt == null) return false;
  const hostBits = 32 - mask;
  return (baseInt >> hostBits) === (ipInt >> hostBits);
}

function isCloudflareIp(ip: string): boolean {
  if (!IP_RE.test(ip)) return false;
  return CLOUDFLARE_RANGES.some((range) => cidrContains(range, ip));
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

async function getDns(domain: string) {
  const [a, mx, txt, ns] = await Promise.allSettled([
    dns.resolve4(domain),
    dns.resolveMx(domain),
    dns.resolveTxt(domain),
    dns.resolveNs(domain),
  ]);
  return {
    A:
      a.status === "fulfilled"
        ? a.value
        : [`Error: ${(a as PromiseRejectedResult).reason?.message ?? "unknown"}`],
    MX:
      mx.status === "fulfilled"
        ? mx.value
            .sort((x, y) => x.priority - y.priority)
            .map((r) => `${r.exchange} (pri ${r.priority})`)
        : [],
    TXT:
      txt.status === "fulfilled"
        ? txt.value.map((t) => t.join(""))
        : [],
    NS: ns.status === "fulfilled" ? ns.value : [],
  };
}

async function getRdap(domain: string) {
  // Use the RDAP bootstrap service — modern WHOIS replacement, returns JSON.
  try {
    const res = await fetchWithTimeout(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: "application/rdap+json" },
      }
    );
    if (!res.ok) return null;
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
      const fn = vcard.find((f) => f[0] === "fn");
      if (fn && Array.isArray(fn) && fn[3]) registrar = String(fn[3]);
    }

    const statuses = (data.status ?? []) as string[];
    const nsArray = (data.nameservers ?? []) as { ldhName?: string }[];
    return {
      registrar,
      createdDate: getEvent("registration"),
      updatedDate: getEvent("last changed"),
      expiryDate: getEvent("expiration"),
      nameServers: nsArray.map((n) => n.ldhName?.toLowerCase()).filter(Boolean),
      status: statuses,
      raw: data,
    };
  } catch {
    return null;
  }
}

async function getGeo(ip: string) {
  try {
    const res = await fetchWithTimeout(`http://ip-api.com/json/${ip}?fields=66846719`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.status === "fail") return null;
    return {
      country: d.country,
      countryCode: d.countryCode,
      region: d.regionName,
      city: d.city,
      lat: d.lat,
      lon: d.lon,
      isp: d.isp,
      org: d.org,
      as: d.as,
      timezone: d.timezone,
    };
  } catch {
    return null;
  }
}

async function detectWaf(
  target: string,
  resolvedIp: string | null
): Promise<{
  cloudflare: boolean;
  detectedWaf?: string;
  serverHeader?: string;
  securityHeaders: string[];
}> {
  const securityHeaders: string[] = [];
  let serverHeader: string | undefined;
  let detectedWaf: string | undefined;
  let cloudflare = false;

  // 1. DNS-based Cloudflare detection
  if (resolvedIp && isCloudflareIp(resolvedIp)) {
    cloudflare = true;
    detectedWaf = "Cloudflare (por resolución DNS)";
  }

  // 2. HTTP header inspection
  try {
    const proto = target.startsWith("http") ? "" : "https://";
    const res = await fetchWithTimeout(`${proto}${target}`, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OsintFlow/1.0; +https://github.com/osintflow)",
      },
    });
    serverHeader = res.headers.get("server") ?? undefined;
    if (serverHeader) {
      const sl = serverHeader.toLowerCase();
      if (sl.includes("cloudflare")) {
        cloudflare = true;
        if (!detectedWaf) detectedWaf = "Cloudflare (cabecera Server)";
      } else if (sl.includes("akamai")) {
        if (!detectedWaf) detectedWaf = "Akamai";
      } else if (sl.includes("incapsula") || sl.includes("imperva")) {
        if (!detectedWaf) detectedWaf = "Imperva/Incapsula";
      } else if (sl.includes("sucuri")) {
        if (!detectedWaf) detectedWaf = "Sucuri";
      } else if (sl.includes("aws") || sl.includes("amazon")) {
        if (!detectedWaf) detectedWaf = "AWS WAF / CloudFront";
      } else if (sl.includes("nginx")) {
        if (!detectedWaf) detectedWaf = "Nginx (sin WAF conocido)";
      } else if (sl.includes("apache")) {
        if (!detectedWaf) detectedWaf = "Apache (sin WAF conocido)";
      }
    }
    if (res.headers.get("cf-ray")) {
      cloudflare = true;
      if (!detectedWaf) detectedWaf = "Cloudflare (cabecera cf-ray)";
    }
    const secHeaders = [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "x-xss-protection",
      "referrer-policy",
      "permissions-policy",
    ];
    for (const h of secHeaders) {
      const val = res.headers.get(h);
      if (val) securityHeaders.push(`${h}: ${val}`);
    }
  } catch {
    /* network may block — keep DNS-based result */
  }

  return { cloudflare, detectedWaf, serverHeader, securityHeaders };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const target = String(body?.target ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!target) {
      return NextResponse.json({ error: "IP o dominio requerido" }, { status: 400 });
    }

    const isIp = IP_RE.test(target) || IPV6_RE.test(target);
    const isDomain = !isIp && DOMAIN_RE.test(target);
    if (!isIp && !isDomain) {
      return NextResponse.json(
        { error: "Entrada inválida. Debe ser una IP o un dominio." },
        { status: 400 }
      );
    }

    const notes: string[] = [];
    let result: Record<string, unknown> = { input: target, type: isIp ? "ip" : "domain" };

    if (isIp) {
      const geo = await getGeo(target);
      if (geo) result.geo = geo;
      else notes.push("No se pudo obtener geolocalización para esta IP.");
      // Reverse DNS
      try {
        const hostnames = await dns.reverse(target);
        if (hostnames.length) {
          notes.push(`Reverse DNS: ${hostnames.join(", ")}`);
        }
      } catch {
        /* no PTR */
      }
    } else {
      // Domain
      const dnsRecords = await getDns(target);
      result.dns = dnsRecords;

      const firstA = dnsRecords.A[0];
      if (firstA && !firstA.startsWith("Error:")) {
        result.ip = firstA;
        const geo = await getGeo(firstA);
        if (geo) result.geo = geo;
      }

      const rdap = await getRdap(target);
      if (rdap) {
        result.whois = rdap;
      } else {
        notes.push("No se pudo obtener información RDAP/WHOIS para este dominio.");
      }

      // WAF detection (needs the resolved IP)
      const waf = await detectWaf(target, firstA && !firstA.startsWith("Error:") ? firstA : null);
      result.waf = waf;
      if (waf.cloudflare) {
        notes.push(
          "El dominio está protegido por Cloudflare: la IP resuelta pertenece a su red y el origen real está oculto."
        );
      }
    }

    result.notes = notes;
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
