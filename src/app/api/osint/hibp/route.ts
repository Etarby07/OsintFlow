import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface HibpBreach {
  Name: string;
  Domain?: string;
  BreachDate?: string;
  PwnCount?: number;
  DataClasses?: string[];
  Description?: string;
  IsVerified?: boolean;
}

interface LocalBreach {
  name: string;
  date: string;
  count: number;
  domains: string[];
  dataClasses: string[];
  description: string;
}

// Curated educational sample of ~12 well-known public data breaches.
// Used as a local fallback when no HIBP API key is configured.
const LOCAL_BREACHES: LocalBreach[] = [
  {
    name: "LinkedIn Scrape",
    date: "2021-06-22",
    count: 700_000_000,
    domains: ["linkedin.com"],
    dataClasses: ["Emails", "Names", "Geographic locations", "Genders", "Job titles"],
    description:
      "En 2021, se filtraron datos de 700 millones de perfiles de LinkedIn obtenidos mediante scraping. No es un hackeo tradicional, pero expone información profesional pública de millones de usuarios.",
  },
  {
    name: "Collection #1",
    date: "2019-01-07",
    count: 2_700_000_000,
    domains: [],
    dataClasses: ["Emails", "Passwords"],
    description:
      "Mega-filtración de 2.700 millones de pares email/contraseña agregadas de múltiples brechas anteriores. Una de las mayores colecciones de credenciales jamás publicada.",
  },
  {
    name: "Adobe",
    date: "2013-10-04",
    count: 152_000_000,
    domains: ["adobe.com"],
    dataClasses: ["Emails", "Password hints", "Passwords", "Usernames"],
    description:
      "En octubre de 2013, Adobe sufrió una brecha que expuso 152 millones de cuentas, incluyendo contraseñas cifradas débilmente y pistas de contraseña en texto plano.",
  },
  {
    name: "Dropbox",
    date: "2012-07-01",
    count: 68_000_000,
    domains: ["dropbox.com"],
    dataClasses: ["Emails", "Passwords"],
    description:
      "En 2012, un empleado de Dropbox reutilizó una contraseña comprometida en LinkedIn, lo que permitió acceder a un documento con 68 millones de credenciales de usuarios de Dropbox.",
  },
  {
    name: "Yahoo",
    date: "2014-01-01",
    count: 500_000_000,
    domains: ["yahoo.com"],
    dataClasses: ["Emails", "Names", "Dates of birth", "Phone numbers", "Security questions"],
    description:
      "Yahoo reveló en 2016 una brecha de 2014 que afectó a 500 millones de cuentas, incluyendo preguntas de seguridad y datos personales. Una de las brechas más graves de la historia.",
  },
  {
    name: "Canva",
    date: "2019-05-24",
    count: 139_000_000,
    domains: ["canva.com"],
    dataClasses: ["Emails", "Names", "Usernames", "Passwords"],
    description:
      "En mayo de 2019, la plataforma de diseño Canva sufrió una brecha que expuso 139 millones de cuentas, incluyendo contraseñas cifradas con bcrypt.",
  },
  {
    name: "MyFitnessPal",
    date: "2018-02-01",
    count: 144_000_000,
    domains: ["myfitnesspal.com"],
    dataClasses: ["Emails", "Usernames", "Passwords"],
    description:
      "En 2018, Under Armour reveló que MyFitnessPal había sido comprometido, exponiendo 144 millones de cuentas con contraseñas cifradas con bcrypt (fuertes).",
  },
  {
    name: "MyHeritage",
    date: "2017-10-26",
    count: 92_000_000,
    domains: ["myheritage.com"],
    dataClasses: ["Emails", "Passwords"],
    description:
      "Un investigador de seguridad encontró en 2018 un archivo con 92 millones de cuentas de MyHeritage en un servidor externo. Las contraseñas estaban cifradas con bcrypt.",
  },
  {
    name: "Twitter",
    date: "2022-01-01",
    count: 5_400_000,
    domains: ["twitter.com"],
    dataClasses: ["Emails", "Names", "Phone numbers", "Usernames"],
    description:
      "En 2022, una vulnerabilidad en la API de Twitter permitió a un atacante obtener 5,4 millones de cuentas mediante enumeración. Los datos se vendieron en foros clandestinos.",
  },
  {
    name: "Facebook",
    date: "2021-04-03",
    count: 533_000_000,
    domains: ["facebook.com"],
    dataClasses: ["Emails", "Names", "Geographic locations", "Phone numbers", "Dates of birth"],
    description:
      "En abril de 2021, se publicaron datos de 533 millones de usuarios de Facebook obtenidos mediante scraping de una funcionalidad de contactos. Incluye teléfonos y ubicaciones.",
  },
  {
    name: "Dubsmash",
    date: "2019-02-01",
    count: 162_000_000,
    domains: ["dubsmash.com"],
    dataClasses: ["Emails", "Usernames", "Passwords"],
    description:
      "En diciembre de 2019, Dubsmash confirmó una brecha que afectó a 162 millones de cuentas. Los datos aparecieron a la venta junto con los de varias otras plataformas.",
  },
  {
    name: "Armor Games",
    date: "2019-01-01",
    count: 11_000_000,
    domains: ["armorgames.com"],
    dataClasses: ["Emails", "Usernames", "Passwords"],
    description:
      "La plataforma de juegos Armor Games sufrió una brecha que expuso 11 millones de cuentas con contraseñas cifradas con SHA-1 (débil, recomendado cambiarlas).",
  },
];

const COMMON_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
]);

function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function localMatch(email: string, notes: string[]) {
  const domain = email.split("@")[1] ?? "";
  const matched = LOCAL_BREACHES.filter((b) => {
    if (b.domains.length === 0) {
      // Generic mass breach — only "match" for common providers to avoid
      // giving false confidence about niche domains.
      return COMMON_PROVIDERS.has(domain);
    }
    return b.domains.includes(domain);
  });

  return matched.map((b) => ({
    name: b.name,
    domain: b.domains[0],
    date: b.date,
    dataClasses: b.dataClasses,
    pwnCount: b.count,
    description: b.description,
    isVerified: true,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Email requerido" },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        {
          email,
          source: "local" as const,
          breaches: [],
          notes: [
            "El formato del correo no es válido. Ejemplo: alguien@dominio.com",
          ],
        },
        { status: 200 }
      );
    }

    const notes: string[] = [];
    const apiKey = process.env.HIBP_API_KEY;

    // Real HIBP API path
    if (apiKey) {
      try {
        const res = await fetchWithTimeout(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
            email
          )}?truncateResponse=false`,
          {
            headers: {
              "hibp-api-key": apiKey,
              "user-agent": "OsintFlow",
              accept: "application/json",
            },
          },
          10000
        );

        if (res.status === 404) {
          // No breaches found.
          return NextResponse.json(
            {
              email,
              source: "hibp" as const,
              breaches: [],
              notes: [
                "HaveIBeenPwned confirma que el correo no aparece en filtraciones conocidas.",
              ],
            },
            { status: 200 }
          );
        }

        if (res.status === 401) {
          notes.push(
            "La API key de HaveIBeenPwned fue rechazada (401). Mostrando resultados de la base de datos local de muestra en su lugar."
          );
          const breaches = localMatch(email, notes);
          if (breaches.length === 0) {
            notes.push(
              "La base de datos local de muestra no cubre este dominio. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
            );
          } else {
            notes.push(
              "Estos resultados provienen de una base de datos local de muestra (~12 brechas conocidas) y NO representan una verificación completa en tiempo real. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
            );
          }
          return NextResponse.json(
            { email, source: "local" as const, breaches, notes },
            { status: 200 }
          );
        }

        if (res.status === 429) {
          notes.push(
            "HaveIBeenPwned limitó la tasa de peticiones (429). Mostrando resultados de la base de datos local de muestra en su lugar. Inténtalo de nuevo más tarde."
          );
          const breaches = localMatch(email, notes);
          if (breaches.length === 0) {
            notes.push(
              "La base de datos local de muestra no cubre este dominio. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
            );
          } else {
            notes.push(
              "Estos resultados provienen de una base de datos local de muestra (~12 brechas conocidas) y NO representan una verificación completa en tiempo real. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
            );
          }
          return NextResponse.json(
            { email, source: "local" as const, breaches, notes },
            { status: 200 }
          );
        }

        if (!res.ok) {
          notes.push(
            `HaveIBeenPwned respondió con código HTTP ${res.status}. Mostrando resultados de la base de datos local de muestra en su lugar.`
          );
          const breaches = localMatch(email, notes);
          if (breaches.length === 0) {
            notes.push(
              "La base de datos local de muestra no cubre este dominio. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
            );
          } else {
            notes.push(
              "Estos resultados provienen de una base de datos local de muestra (~12 brechas conocidas) y NO representan una verificación completa en tiempo real."
            );
          }
          return NextResponse.json(
            { email, source: "local" as const, breaches, notes },
            { status: 200 }
          );
        }

        const data = (await res.json()) as HibpBreach[];
        const breaches = data.map((b) => ({
          name: b.Name,
          domain: b.Domain,
          date: b.BreachDate ?? "",
          dataClasses: b.DataClasses ?? [],
          pwnCount: b.PwnCount,
          description: b.Description,
          isVerified: b.IsVerified,
        }));

        if (breaches.length === 0) {
          notes.push(
            "HaveIBeenPwned confirma que el correo no aparece en filtraciones conocidas."
          );
        }

        return NextResponse.json(
          { email, source: "hibp" as const, breaches, notes },
          { status: 200 }
        );
      } catch (err) {
        notes.push(
          err instanceof Error && err.name === "AbortError"
            ? "La petición a HaveIBeenPwned superó el tiempo de espera (>10s). Mostrando resultados de la base de datos local de muestra."
            : "No se pudo conectar con la API de HaveIBeenPwned. Mostrando resultados de la base de datos local de muestra."
        );
        const breaches = localMatch(email, notes);
        if (breaches.length === 0) {
          notes.push(
            "La base de datos local de muestra no cubre este dominio. Para una verificación completa, configura una API key válida de HaveIBeenPwned: https://haveibeenpwned.com/API/Key"
          );
        } else {
          notes.push(
            "Estos resultados provienen de una base de datos local de muestra (~12 brechas conocidas) y NO representan una verificación completa en tiempo real."
          );
        }
        return NextResponse.json(
          { email, source: "local" as const, breaches, notes },
          { status: 200 }
        );
      }
    }

    // No API key — local fallback.
    const breaches = localMatch(email, notes);
    notes.push(
      "No se configuró la variable de entorno HIBP_API_KEY. Los resultados siguientes provienen de una base de datos local de muestra (~12 brechas conocidas) y NO representan una verificación completa en tiempo real. Para una verificación completa, obtén una API key en https://haveibeenpwned.com/API/Key y configúrala como HIBP_API_KEY."
    );
    if (breaches.length === 0) {
      notes.push(
        "La base de datos local de muestra no cubre el dominio de este correo. Esto no significa que el correo esté libre de filtraciones, solo que no está en la muestra local."
      );
    }

    return NextResponse.json(
      { email, source: "local" as const, breaches, notes },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "hibp",
    provider: "HaveIBeenPwned",
    configured: !!process.env.HIBP_API_KEY,
    description:
      "Comprueba si un correo electrónico aparece en filtraciones de datos conocidas. Usa la API v3 de HaveIBeenPwned si HIBP_API_KEY está configurada; si no, recurre a una base de datos local de muestra.",
  });
}
