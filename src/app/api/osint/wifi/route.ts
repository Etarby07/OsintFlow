import { NextRequest, NextResponse } from "next/server";

// Basic MAC/BSSID validator — accepts AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.
const BSSID_RE = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

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

interface WigleResult {
  ssid: string;
  bssid: string;
  latitude: number;
  longitude: number;
  type?: string;
  firsttime?: string;
  lasttime?: string;
  country?: string;
}

interface WigleResponse {
  success?: boolean;
  totalResults?: number;
  results?: Array<{
    netid?: string;
    ssid?: string;
    type?: string;
    latitude?: number;
    longitude?: number;
    country?: string;
    firsttime?: string;
    lasttime?: string;
  }>;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    const type = body?.type === "bssid" ? "bssid" : "ssid";

    if (!query) {
      return NextResponse.json(
        { error: "Consulta requerida" },
        { status: 400 }
      );
    }
    if (type === "bssid" && !BSSID_RE.test(query)) {
      return NextResponse.json(
        {
          error:
            "BSSID inválido. Formato esperado: AA:BB:CC:DD:EE:FF o AA-BB-CC-DD-EE-FF",
        },
        { status: 400 }
      );
    }

    const apiName = process.env.WIGLE_API_NAME;
    const apiKey = process.env.WIGLE_API_KEY;

    // Manual search URL (always provided for the no-config fallback).
    const manualSearchUrl =
      type === "ssid"
        ? `https://wigle.net/search#ssid=${encodeURIComponent(query)}`
        : `https://wigle.net/search#netid=${encodeURIComponent(query)}`;

    if (!apiName || !apiKey) {
      return NextResponse.json(
        {
          configured: false,
          query,
          type,
          results: [],
          manualSearchUrl,
          notes: [
            "No se configuraron las variables de entorno WIGLE_API_NAME y WIGLE_API_KEY. La búsqueda se realiza de forma manual en wigle.net.",
            "Para obtener una API key gratuita: crea una cuenta en https://wigle.net/, ve a My Account → API Token y copia tu API Name y Token. Luego configúralos como WIGLE_API_NAME y WIGLE_API_KEY.",
          ],
        },
        { status: 200 }
      );
    }

    const params = new URLSearchParams({
      resultsPerPage: "25",
    });
    if (type === "ssid") {
      params.set("ssid", query);
    } else {
      // Wigle expects the colon-separated form.
      params.set("netid", query.toLowerCase().replace(/-/g, ":"));
    }

    try {
      const res = await fetchWithTimeout(
        `https://api.wigle.net/api/v2/network/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiName}:${apiKey}`).toString(
              "base64"
            )}`,
            Accept: "application/json",
          },
        },
        8000
      );

      if (res.status === 401) {
        return NextResponse.json(
          {
            configured: true,
            query,
            type,
            results: [],
            manualSearchUrl,
            notes: [
              "Las credenciales de WiGLE (WIGLE_API_NAME / WIGLE_API_KEY) fueron rechazadas (401). Verifica que sean correctas.",
              "Puedes buscar manualmente mientras tanto:",
              manualSearchUrl,
            ],
          },
          { status: 200 }
        );
      }

      if (res.status === 429) {
        return NextResponse.json(
          {
            configured: true,
            query,
            type,
            results: [],
            manualSearchUrl,
            notes: [
              "WiGLE limitó la tasa de peticiones (429). Inténtalo de nuevo más tarde o usa la búsqueda manual:",
              manualSearchUrl,
            ],
          },
          { status: 200 }
        );
      }

      if (!res.ok) {
        return NextResponse.json(
          {
            configured: true,
            query,
            type,
            results: [],
            manualSearchUrl,
            notes: [
              `WiGLE respondió HTTP ${res.status}. Puedes usar la búsqueda manual:`,
              manualSearchUrl,
            ],
          },
          { status: 200 }
        );
      }

      const data = (await res.json()) as WigleResponse;
      const raw = Array.isArray(data.results) ? data.results : [];
      const results: WigleResult[] = raw
        .filter(
          (r) =>
            typeof r.latitude === "number" &&
            typeof r.longitude === "number"
        )
        .slice(0, 25)
        .map((r) => ({
          ssid: r.ssid ?? "(oculto)",
          bssid: r.netid ?? "",
          latitude: r.latitude as number,
          longitude: r.longitude as number,
          type: r.type,
          firsttime: r.firsttime,
          lasttime: r.lasttime,
          country: r.country,
        }));

      const notes: string[] = [];
      if (results.length === 0) {
        notes.push(
          `WiGLE no devolvió resultados con coordenadas para ${
            type === "ssid" ? "el SSID" : "el BSSID"
          } "${query}".`
        );
        notes.push(`Puedes intentar la búsqueda manual: ${manualSearchUrl}`);
      } else {
        notes.push(
          `WiGLE reportó ${
            typeof data.totalResults === "number"
              ? `${data.totalResults} coincidencia${data.totalResults === 1 ? "" : "s"} totales`
              : "coincidencias"
          }; se muestran las primeras ${results.length} con coordenadas.`
        );
        notes.push(
          "Las ubicaciones son aproximadas (centroide de las observaciones recogidas por la comunidad), no la posición exacta del punto de acceso."
        );
      }

      return NextResponse.json(
        {
          configured: true,
          query,
          type,
          results,
          manualSearchUrl,
          notes,
        },
        { status: 200 }
      );
    } catch (err) {
      return NextResponse.json(
        {
          configured: true,
          query,
          type,
          results: [],
          manualSearchUrl,
          notes: [
            err instanceof Error && err.name === "AbortError"
              ? "La consulta a WiGLE superó el tiempo de espera (>8s)."
              : "No se pudo conectar con la API de WiGLE.",
            `Búsqueda manual disponible: ${manualSearchUrl}`,
          ],
        },
        { status: 200 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "wifi",
    provider: "WiGLE.net",
    configured:
      !!process.env.WIGLE_API_NAME && !!process.env.WIGLE_API_KEY,
    description:
      "Geolocaliza redes Wi-Fi por SSID o BSSID usando la base de datos pública de WiGLE.net. Requiere API Name y API Key; sin ellos ofrece búsqueda manual en wigle.net.",
  });
}
