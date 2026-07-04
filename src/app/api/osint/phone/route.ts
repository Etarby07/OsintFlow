import { NextRequest, NextResponse } from "next/server";
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type PhoneNumber,
} from "libphonenumber-js";

// Heuristic carrier estimation per country calling code.
// This is NOT authoritative — real carrier data requires paid HLR lookups.
const COUNTRY_CARRIERS: Record<string, { name: string; carriers: Record<string, string> }> = {
  ES: {
    name: "España",
    carriers: {
      "6": "Movistar / Vodafone / Orange (móvil)",
      "7": "Movistar / Vodafone / Orange / Yoigo (móvil)",
      "9": "Movistar / Vodafone / Orange / MásMóvil (fijo)",
    },
  },
  MX: {
    name: "México",
    carriers: {
      // Lada móvil starts; we can't be precise — show common ones.
      "55": "Telcel / AT&T / Movistar (CDMX)",
      "33": "Telcel / AT&T / Movistar (Guadalajara)",
      "81": "Telcel / AT&T / Movistar (Monterrey)",
    },
  },
  US: {
    name: "Estados Unidos",
    carriers: {
      "": "Verizon / AT&T / T-Mobile (variable)",
    },
  },
  AR: {
    name: "Argentina",
    carriers: {
      "9": "Movistar / Claro / Personal (móvil)",
    },
  },
  CO: {
    name: "Colombia",
    carriers: {
      "3": "Claro / Movistar / Tigo (móvil)",
    },
  },
  BR: {
    name: "Brasil",
    carriers: {
      "": "Vivo / Claro / Tim (variable)",
    },
  },
  FR: {
    name: "Francia",
    carriers: {
      "6": "Orange / SFR / Bouygues / Free (móvil)",
      "7": "Orange / SFR / Bouygues / Free (móvil)",
    },
  },
  DE: {
    name: "Alemania",
    carriers: {
      "15": "T-Mobile / Vodafone / O2 (móvil)",
      "16": "T-Mobile / Vodafone / O2 (móvil)",
      "17": "T-Mobile / Vodafone / O2 (móvil)",
    },
  },
  GB: {
    name: "Reino Unido",
    carriers: {
      "7": "EE / O2 / Vodafone / Three (móvil)",
    },
  },
  IT: {
    name: "Italia",
    carriers: {
      "3": "TIM / Vodafone / WindTre / Iliad (móvil)",
    },
  },
  PT: {
    name: "Portugal",
    carriers: {
      "9": "MEO / NOS / Vodafone (móvil)",
    },
  },
  CL: {
    name: "Chile",
    carriers: {
      "9": "Entel / Movistar / Claro / WOM (móvil)",
    },
  },
  PE: {
    name: "Perú",
    carriers: {
      "9": "Movistar / Claro / Entel / Bitel (móvil)",
    },
  },
  VE: {
    name: "Venezuela",
    carriers: {
      "4": "Movilnet / Movistar / Digitel (móvil)",
    },
  },
};

function estimateCarrier(
  country: string | undefined,
  nationalNumber: string
): string | undefined {
  if (!country) return undefined;
  const entry = COUNTRY_CARRIERS[country];
  if (!entry) return "Operador no catalogado (requiere HLR lookup)";
  // Match by first digit(s) of national number.
  const first = nationalNumber[0] ?? "";
  const firstTwo = nationalNumber.slice(0, 2);
  return (
    entry.carriers[firstTwo] ||
    entry.carriers[first] ||
    entry.carriers[""] ||
    "Operador no determinado"
  );
}

function phoneType(phone: PhoneNumber): string {
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
      return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
    }

    const phone = parsePhoneNumberFromString(phoneInput);
    if (!phone || !phone.isValid()) {
      return NextResponse.json({
        input: phoneInput,
        valid: false,
        notes: [
          "El número no es válido según la librería libphonenumber. Verifica el prefijo internacional.",
        ],
      });
    }

    const country = phone.country;
    const national = phone.nationalNumber.toString();
    const carrier = estimateCarrier(country, national);
    const e164 = phone.format("E.164");

    // WhatsApp uses E.164 without the '+' for wa.me links.
    const waNumber = e164.replace("+", "");
    const waUrl = `https://wa.me/${waNumber}`;
    // WhatsApp is possible for mobile numbers, and some fixed-line or mobile
    // in certain countries. Treat mobile as candidate.
    const waPossible =
      phone.getType() === "MOBILE" ||
      phone.getType() === "FIXED_LINE_OR_MOBILE";

    let countryName: string | undefined;
    let callingCode: string | undefined;
    if (country) {
      countryName = COUNTRY_CARRIERS[country]?.name;
      try {
        callingCode = getCountryCallingCode(country);
      } catch {
        /* ignore */
      }
    }

    const notes: string[] = [];
    if (!country) {
      notes.push(
        "No se pudo determinar el país automáticamente; verifica el prefijo internacional."
      );
    }
    if (waPossible) {
      notes.push(
        "El número tiene formato de móvil y podría estar asociado a WhatsApp. Abre wa.me para confirmar."
      );
    } else {
      notes.push(
        "El número no parece ser móvil; la asociación con WhatsApp es improbable."
      );
    }

    return NextResponse.json({
      input: phoneInput,
      valid: true,
      e164,
      international: phone.formatInternational(),
      national: phone.formatNational(),
      country: countryName,
      countryCode: country,
      countryCallingCode: callingCode,
      type: phoneType(phone),
      carrier,
      whatsapp: { possible: waPossible, url: waUrl },
      notes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
