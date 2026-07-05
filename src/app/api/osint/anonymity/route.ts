import { NextRequest, NextResponse } from "next/server";

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

// Full fields mask for ip-api.com — includes geo, ISP, org, AS, reverse,
// proxy/hosting/mobile flags and the standard message/status.
const IP_API_FIELDS = 66846719;

// ISP / org substrings that hint at commercial VPN providers.
const VPN_HINTS = [
  "nordvpn",
  "expressvpn",
  "mullvad",
  "protonvpn",
  "private internet access",
  "privateinternetaccess",
  "cyberghost",
  "surfshark",
  "ipvanish",
  "vyprvpn",
  "purevpn",
  "tunnelbear",
  "windscribe",
  "pia",
  "ovpn",
  "trustzone",
  "astrill",
];

// ---- In-memory cache of Tor exit nodes (refreshed every 30 min) -----------
interface TorCache {
  ips: Set<string>;
  fetchedAt: number;
}
let torCache: TorCache | null = null;
const TOR_TTL_MS = 30 * 60 * 1000;

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

async function getTorExitIps(): Promise<Set<string>> {
  if (torCache && Date.now() - torCache.fetchedAt < TOR_TTL_MS) {
    return torCache.ips;
  }
  try {
    const res = await fetchWithTimeout(
      "https://check.torproject.org/exit-addresses",
      {},
      10000
    );
    if (!res.ok) {
      return torCache?.ips ?? new Set();
    }
    const text = await res.text();
    const ips = new Set<string>();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ExitAddress")) {
        const parts = trimmed.split(/\s+/);
        // Format: "ExitAddress <IP> <date> <time>"
        if (parts.length >= 2 && IPV4_RE.test(parts[1])) {
          ips.add(parts[1]);
        }
      }
    }
    torCache = { ips, fetchedAt: Date.now() };
    return ips;
  } catch {
    // Network/parse error — keep whatever cache we have or empty set.
    return torCache?.ips ?? new Set();
  }
}

function detectVpn(isp: string, org: string): string | null {
  const haystack = `${isp} ${org}`.toLowerCase();
  for (const hint of VPN_HINTS) {
    // Word-ish match: the hint is bordered by a non-alphanumeric char or
    // boundary so that "pia" doesn't match "spider" etc.
    const re = new RegExp(
      `(^|[^a-z0-9])${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
      "i"
    );
    if (re.test(haystack)) return hint;
  }
  return null;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

interface AbuseIpdbData {
  abuseConfidenceScore: number;
  isTor: boolean;
  usageType: string;
  totalReports?: number;
  countryCode?: string;
}

async function queryAbuseIpdb(ip: string): Promise<AbuseIpdbData | null> {
  const key = process.env.ABUSEIPDB_KEY;
  if (!key) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(
        ip
      )}&maxAgeInDays=90`,
      {
        headers: {
          Key: key,
          Accept: "application/json",
        },
      },
      8000
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        abuseConfidenceScore?: number;
        isTor?: boolean;
        usageType?: string;
        totalReports?: number;
        countryCode?: string;
      };
    };
    const d = json.data;
    if (!d) return null;
    return {
      abuseConfidenceScore: d.abuseConfidenceScore ?? 0,
      isTor: d.isTor === true,
      usageType: d.usageType ?? "Unknown",
      totalReports: d.totalReports,
      countryCode: d.countryCode,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = String(body?.ip ?? "").trim();

    if (!ip) {
      return NextResponse.json({ error: "IP requerida" }, { status: 400 });
    }
    if (!IPV4_RE.test(ip)) {
      return NextResponse.json(
        { error: "IPv4 inválida. Ejemplo: 8.8.8.8" },
        { status: 400 }
      );
    }

    const notes: string[] = [];
    let isp = "";
    let org = "";
    let as = "";
    let country = "";
    let city = "";
    let lat: number | undefined;
    let lon: number | undefined;
    let isHosting = false;
    let isProxy = false;
    let isMobile = false;

    // 1) ip-api.com geo + flags
    try {
      const res = await fetchWithTimeout(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`,
        {},
        8000
      );
      if (res.ok) {
        const d = await res.json();
        if (d && d.status !== "fail") {
          isp = d.isp ?? "";
          org = d.org ?? "";
          as = d.as ?? "";
          country = d.country ?? "";
          city = d.city ?? "";
          lat = typeof d.lat === "number" ? d.lat : undefined;
          lon = typeof d.lon === "number" ? d.lon : undefined;
          isHosting = d.hosting === true;
          isProxy = d.proxy === true;
          isMobile = d.mobile === true;
        } else {
          notes.push(
            `ip-api.com reportó fallo para esta IP${
              d?.message ? `: ${d.message}` : ""
            }.`
          );
        }
      } else {
        notes.push(`ip-api.com respondió HTTP ${res.status}.`);
      }
    } catch (err) {
      notes.push(
        err instanceof Error && err.name === "AbortError"
          ? "La consulta a ip-api.com superó el tiempo de espera (>8s)."
          : "No se pudo consultar ip-api.com para geolocalización."
      );
    }

    // 2) Tor exit-node check (cached 30 min)
    const torIps = await getTorExitIps();
    let isTor = torIps.has(ip);
    if (torIps.size === 0) {
      notes.push(
        "No se pudo obtener la lista de nodos de salida de Tor desde check.torproject.org; la detección de Tor puede ser incompleta."
      );
    }

    // 3) VPN heuristic on ISP / org text
    const vpnProvider = detectVpn(isp, org);
    const isVpn = vpnProvider !== null;

    // 4) AbuseIPDB enrichment (optional)
    let abuseScore: number | undefined;
    const abuse = await queryAbuseIpdb(ip);
    if (abuse) {
      abuseScore = abuse.abuseConfidenceScore;
      // AbuseIPDB may know it's a Tor node even if our list cache missed it.
      if (abuse.isTor) isTor = true;
      if (abuse.usageType && abuse.usageType !== "Unknown") {
        notes.push(`AbuseIPDB usageType: ${abuse.usageType}.`);
      }
      if (typeof abuse.totalReports === "number" && abuse.totalReports > 0) {
        notes.push(
          `AbuseIPDB tiene ${abuse.totalReports} informe${
            abuse.totalReports === 1 ? "" : "s"
          } reciente${abuse.totalReports === 1 ? "" : "s"} sobre esta IP.`
        );
      }
    }

    // 5) Risk score 0–100
    let risk = 0;
    if (isHosting) risk += 20;
    if (isTor) risk += 50;
    if (isVpn) risk += 30;
    if (isProxy) risk += 25;
    if (typeof abuseScore === "number") {
      // Map 0–100 abuse score to a 0–40 contribution.
      risk += Math.round((abuseScore / 100) * 40);
    }
    risk = clamp(risk);

    if (!process.env.ABUSEIPDB_KEY) {
      notes.push(
        "No se configuró ABUSEIPDB_KEY: la detección se basa solo en ip-api.com (heurístico) y la lista de nodos de salida de Tor. Para una verificación más fiable configura una API key de AbuseIPDB (https://www.abuseipdb.com/account/api)."
      );
    }

    if (!isTor && !isVpn && !isHosting && !isProxy) {
      notes.push(
        "Ninguna señal de anonimato detectada: probablemente se trata de una IP residencial o ISP corporativo estándar."
      );
    }
    if (isMobile) {
      notes.push(
        "ip-api.com clasifica esta IP como red móvil (carrier); la ubicación puede corresponder a una antena celular, no al dispositivo."
      );
    }

    const payload = {
      ip,
      isHosting,
      isTor,
      isVpn,
      vpnProvider: vpnProvider ?? undefined,
      isProxy,
      isp,
      org,
      as,
      country,
      city,
      lat,
      lon,
      abuseScore,
      riskScore: risk,
      notes,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "anonymity",
    providers: ["ip-api.com", "check.torproject.org", "AbuseIPDB (opcional)"],
    abuseIpdbConfigured: !!process.env.ABUSEIPDB_KEY,
    description:
      "Detecta si una IPv4 pertenece a una VPN comercial, un proxy público, un nodo de salida de Tor o un proveedor de hosting en la nube. Sin API key funciona en modo heurístico; con ABUSEIPDB_KEY se enriquece con el score de abuso.",
  });
}
