import { NextRequest, NextResponse } from "next/server";
import {
  parsePhoneNumberFromString,
  type PhoneNumber,
} from "libphonenumber-js";

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Compact ISO-2 → country name map for the most common countries. Fallback
// is the ISO code itself if we don't have a friendly name.
const COUNTRY_NAMES: Record<string, string> = {
  ES: "España",
  MX: "México",
  US: "Estados Unidos",
  AR: "Argentina",
  CO: "Colombia",
  BR: "Brasil",
  FR: "Francia",
  DE: "Alemania",
  GB: "Reino Unido",
  UK: "Reino Unido",
  IT: "Italia",
  PT: "Portugal",
  CL: "Chile",
  PE: "Perú",
  VE: "Venezuela",
  EC: "Ecuador",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  CR: "Costa Rica",
  PA: "Panamá",
  DO: "República Dominicana",
  GT: "Guatemala",
  HN: "Honduras",
  SV: "El Salvador",
  NI: "Nicaragua",
  CU: "Cuba",
  CA: "Canadá",
  RU: "Rusia",
  CN: "China",
  JP: "Japón",
  IN: "India",
  BR: "Brasil",
  AU: "Australia",
  ZA: "Sudáfrica",
  MA: "Marruecos",
  DZ: "Argelia",
  NG: "Nigeria",
  SA: "Arabia Saudí",
  AE: "Emiratos Árabes",
  NL: "Países Bajos",
  BE: "Bélgica",
  CH: "Suiza",
  AT: "Austria",
  SE: "Suecia",
  NO: "Noruega",
  DK: "Dinamarca",
  FI: "Finlandia",
  IE: "Irlanda",
  PL: "Polonia",
  GR: "Grecia",
  TR: "Turquía",
  IL: "Israel",
  KR: "Corea del Sur",
  ID: "Indonesia",
  TH: "Tailandia",
  VN: "Vietnam",
  PH: "Filipinas",
  MY: "Malasia",
  SG: "Singapur",
};

function phoneType(phone?: PhoneNumber): string | undefined {
  if (!phone) return undefined;
  switch (phone.getType()) {
    case "MOBILE":
      return "Móvil";
    case "FIXED_LINE":
      return "Fijo";
    case "FIXED_LINE_OR_MOBILE":
      return "Fijo o móvil";
    case "VOIP":
      return "VoIP";
    case "TOLL_FREE":
      return "Gratuito";
    case "PREMIUM_RATE":
      return "Tarifa premium";
    case "PAGER":
      return "Busca";
    case "PERSONAL_NUMBER":
      return "Número personal";
    default:
      return "Desconocido";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phoneInput = String(body?.phone ?? "").trim();

    if (!phoneInput) {
      return NextResponse.json(
        { phone: "", valid: false, notes: ["Teléfono requerido."] },
        { status: 200 }
      );
    }

    const phone = parsePhoneNumberFromString(phoneInput);
    if (!phone || !phone.isValid()) {
      return NextResponse.json({
        phone: phoneInput,
        valid: false,
        notes: [
          "El número no es válido según libphonenumber. Verifica el prefijo internacional.",
        ],
      });
    }

    const country = phone.country;
    const e164 = phone.format("E.164");
    const nationalNumber = phone.nationalNumber.toString();
    const countryCode = country ?? "";
    const countryName = countryCode
      ? COUNTRY_NAMES[countryCode] ?? countryCode
      : "Desconocido";

    const cc = countryCode.toLowerCase();
    const searchLinks: { label: string; url: string }[] = [];

    if (cc) {
      searchLinks.push({
        label: "Truecaller",
        url: `https://www.truecaller.com/search/${cc}/${nationalNumber}`,
      });
    }
    searchLinks.push({
      label: "tellows (España)",
      url: `https://www.tellows.es/num/${cc}${nationalNumber}`,
    });
    searchLinks.push({
      label: "tellows (internacional)",
      url: `https://www.tellows.com/num/${cc}${nationalNumber}`,
    });
    searchLinks.push({
      label: `Google: "${e164}" spam`,
      url: `https://www.google.com/search?q=${encodeURIComponent(
        `"${e164}" OR "${phoneInput}" spam`
      )}`,
    });

    const notes: string[] = [
      "Sin una API key de un proveedor (NumLookup, Truecaller, etc.) no se puede obtener directamente el nombre del titular. Los enlaces te llevan a bases de datos públicas de spam.",
    ];

    let callerName: string | undefined;
    let isSpam: boolean | undefined;

    const numLookupKey = process.env.NUMLOOKUP_KEY;
    if (numLookupKey) {
      try {
        const e164NoPlus = e164.replace("+", "");
        const res = await fetchWithTimeout(
          `https://api.numlookupapi.com/v2/numlookup?phone=${e164NoPlus}&apikey=${numLookupKey}`,
          { headers: { Accept: "application/json" } },
          8000
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.caller_name) callerName = String(data.caller_name);
          if (typeof data?.spam === "boolean") {
            isSpam = data.spam;
          } else if (typeof data?.spam_score === "number") {
            isSpam = data.spam_score > 0.5;
          }
        } else {
          notes.push(`NumLookup respondió HTTP ${res.status}.`);
        }
      } catch (err) {
        notes.push(
          `NumLookup falló: ${
            err instanceof Error ? err.message : "error desconocido"
          }.`
        );
      }
    } else {
      notes.push(
        "No hay NUMLOOKUP_KEY configurada; no se consultó la API de NumLookup. Si quieres identificar el titular automáticamente, configura la variable de entorno NUMLOOKUP_KEY."
      );
    }

    return NextResponse.json({
      phone: phoneInput,
      valid: true,
      e164,
      country: countryName,
      countryCode,
      nationalNumber,
      type: phoneType(phone),
      callerName,
      isSpam,
      searchLinks,
      notes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        phone: "",
        valid: false,
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
    tool: "callerid",
    description:
      "Identifica el titular de un número de teléfono (cuando es posible) y comprueba si está marcado como spam en bases de datos públicas.",
    method: "POST",
    body: { phone: "string" },
    hasNumLookupKey: !!process.env.NUMLOOKUP_KEY,
  });
}
