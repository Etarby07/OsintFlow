import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import crypto from "crypto";

// Curated educational sample of well-known public data breaches.
// This is NOT exhaustive — it simulates a local breach database for the demo.
const KNOWN_BREACHES: {
  name: string;
  date: string;
  count: string;
  domains: string[];
}[] = [
  {
    name: "LinkedIn Scrape (2021)",
    date: "2021-06-22",
    count: "700M",
    domains: ["linkedin.com"],
  },
  {
    name: "Collection #1",
    date: "2019-01-07",
    count: "2.7B",
    domains: [],
  },
  {
    name: "Adobe (2013)",
    date: "2013-10-04",
    count: "153M",
    domains: ["adobe.com"],
  },
  {
    name: "Dropbox (2012)",
    date: "2012-07-01",
    count: "68M",
    domains: ["dropbox.com"],
  },
  {
    name: "Yahoo (2014)",
    date: "2014-01-01",
    count: "500M",
    domains: ["yahoo.com"],
  },
  {
    name: "Canva (2019)",
    date: "2019-05-24",
    count: "139M",
    domains: ["canva.com"],
  },
  {
    name: "MyFitnessPal (2018)",
    date: "2018-02-01",
    count: "144M",
    domains: ["myfitnesspal.com"],
  },
  {
    name: "Dubsmash (2019)",
    date: "2019-02-01",
    count: "162M",
    domains: ["dubsmash.com"],
  },
  {
    name: "MyHeritage (2017)",
    date: "2017-10-26",
    count: "92M",
    domains: ["myheritage.com"],
  },
  {
    name: "Armor Games (2019)",
    date: "2019-01-01",
    count: "11M",
    domains: ["armorgames.com"],
  },
  {
    name: "Twitter (2022)",
    date: "2022-01-01",
    count: "5.4M",
    domains: ["twitter.com"],
  },
  {
    name: "Facebook (2021)",
    date: "2021-04-03",
    count: "533M",
    domains: ["facebook.com"],
  },
];

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

async function gravatarCheck(email: string) {
  const hash = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
  const url = `https://www.gravatar.com/avatar/${hash}?d=404&s=80`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return { exists: res.ok, url: `https://www.gravatar.com/avatar/${hash}?s=80` };
  } catch {
    return { exists: false, url: `https://www.gravatar.com/avatar/${hash}?s=80` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const valid = EMAIL_RE.test(email);
    const parts = email.split("@");
    const domain = parts[1] ?? "";

    // MX records
    let mxRecords: string[] = [];
    if (domain) {
      try {
        const records = await dns.resolveMx(domain);
        mxRecords = records
          .sort((a, b) => a.priority - b.priority)
          .map((r) => `${r.exchange} (prioridad ${r.priority})`);
      } catch {
        mxRecords = [];
      }
    }

    // Gravatar
    const gravatar = await gravatarCheck(email);

    // Breaches: match if breach domains include email domain OR if it's a
    // generic breach (Collection #1). This is a heuristic demo.
    const breaches = KNOWN_BREACHES.filter((b) => {
      if (b.domains.length === 0) {
        // Generic mass breaches — show as "possibly affected" only if domain
        // has a known provider to avoid false confidence.
        return ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(
          domain
        ) && b.name === "Collection #1";
      }
      return b.domains.includes(domain);
    }).map((b) => ({ name: b.name, date: b.date, count: b.count }));

    // Platform registration probes (public, non-auth endpoints)
    const platforms: { name: string; registered: boolean; url: string }[] = [];
    if (gravatar.exists) {
      platforms.push({
        name: "Gravatar / WordPress.com",
        registered: true,
        url: gravatar.url,
      });
    } else {
      platforms.push({
        name: "Gravatar / WordPress.com",
        registered: false,
        url: `https://gravatar.com`,
      });
    }

    const notes: string[] = [];
    if (!valid) {
      notes.push("El formato del correo no es válido según RFC 5322.");
    }
    if (valid && mxRecords.length === 0) {
      notes.push(
        "El dominio no tiene registros MX públicos; es posible que no reciba correo."
      );
    }
    if (breaches.length > 0) {
      notes.push(
        "El dominio del correo aparece en filtraciones públicas conocidas. Recomendado cambiar la contraseña asociada."
      );
    }
    if (gravatar.exists) {
      notes.push(
        "Existe un avatar público asociado al correo en Gravatar, lo que indica uso en plataformas WordPress/GitHub/etc."
      );
    }

    return NextResponse.json({
      email,
      valid,
      domain,
      mxRecords,
      gravatar,
      breaches,
      platforms,
      notes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
