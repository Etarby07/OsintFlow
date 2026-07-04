import { NextRequest, NextResponse } from "next/server";

// Callsign: 2-3 letters followed by 1-4 digits (e.g. IBB123, AAL1234).
const FLIGHT_RE = /^[A-Z]{2,3}\d{1,4}$/;
// MMSI: 9 digits.
const MMSI_RE = /^\d{9}$/;

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

interface FlightInfo {
  callsign: string;
  originCountry?: string;
  longitude?: number;
  latitude?: number;
  baroAltitude?: number;
  onGround: boolean;
  velocity?: number;
  trueTrack?: number;
  verticalRate?: number;
}

// Query OpenSky Network for the live state of a flight by callsign.
async function getFlight(
  callsign: string,
  notes: string[]
): Promise<FlightInfo | null> {
  try {
    const res = await fetchWithTimeout(
      "https://opensky-network.org/api/states/all",
      { headers: { Accept: "application/json" } },
      15000
    );
    if (res.status === 429) {
      notes.push(
        "OpenSky está limitando peticiones (HTTP 429). Visita https://opensky-network.org/ para más información o reintenta más tarde."
      );
      return null;
    }
    if (!res.ok) {
      notes.push(`OpenSky respondió HTTP ${res.status}.`);
      return null;
    }
    const data = await res.json();
    const states = (data.states ?? []) as unknown[];
    const target = callsign.toUpperCase();
    const match = states.find((s) => {
      if (!Array.isArray(s)) return false;
      const cs = s[1];
      return typeof cs === "string" && cs.trim().toUpperCase() === target;
    });
    if (!match) {
      notes.push(
        "El vuelo no está en el aire ahora mismo o no se encuentra en OpenSky."
      );
      return null;
    }
    const s = match as unknown[];
    return {
      callsign:
        typeof s[1] === "string" && s[1].trim() ? s[1].trim() : callsign,
      originCountry: typeof s[2] === "string" ? s[2] : undefined,
      longitude: typeof s[5] === "number" ? s[5] : undefined,
      latitude: typeof s[6] === "number" ? s[6] : undefined,
      baroAltitude: typeof s[7] === "number" ? s[7] : undefined,
      onGround: s[8] === true,
      velocity: typeof s[9] === "number" ? s[9] : undefined,
      trueTrack: typeof s[10] === "number" ? s[10] : undefined,
      verticalRate: typeof s[11] === "number" ? s[11] : undefined,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      notes.push("OpenSky tardó demasiado en responder (>15s).");
    } else {
      notes.push(
        `No se pudo consultar OpenSky: ${
          err instanceof Error ? err.message : "error desconocido"
        }.`
      );
    }
    return null;
  }
}

function getShipInfo(mmsi: string) {
  return {
    mmsi,
    links: [
      {
        label: "Abrir en MarineTraffic",
        url: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
      },
      {
        label: "Abrir en VesselFinder",
        url: `https://www.vesselfinder.com/?mmsi=${mmsi}`,
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawQuery = String(body?.query ?? "").trim();
    const query = rawQuery.toUpperCase();

    if (!query) {
      return NextResponse.json(
        {
          query: "",
          type: "unknown",
          notes: ["Consulta requerida."],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];

    if (FLIGHT_RE.test(query)) {
      const flight = await getFlight(query, notes);
      return NextResponse.json(
        {
          query: rawQuery,
          type: "flight",
          flight: flight ?? undefined,
          notes,
        },
        { status: 200 }
      );
    }

    if (MMSI_RE.test(query)) {
      const ship = getShipInfo(query);
      notes.push(
        "No existe una API pública libre para AIS en tiempo real. Los enlaces a MarineTraffic y VesselFinder muestran la posición actual del barco. Para datos en bruto necesitas una API key de un proveedor AIS (MarineTraffic, VesselFinder, AISHub, etc.)."
      );
      return NextResponse.json(
        { query: rawQuery, type: "ship", ship, notes },
        { status: 200 }
      );
    }

    notes.push(
      "El formato no corresponde a un callsign de vuelo (2-3 letras + 1-4 dígitos, ej. IBB123) ni a un MMSI (9 dígitos)."
    );
    return NextResponse.json(
      { query: rawQuery, type: "unknown", notes },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        query: "",
        type: "unknown",
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
    tool: "tracking",
    description:
      "Rastrea vuelos en tiempo real (OpenSky Network) y barcos (enlaces a MarineTraffic / VesselFinder).",
    method: "POST",
    body: { query: "string (callsign IBB123 o MMSI de 9 dígitos)" },
    sources: ["OpenSky Network", "MarineTraffic", "VesselFinder"],
  });
}
