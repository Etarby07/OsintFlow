import { NextRequest, NextResponse } from "next/server";

// Simple RFC 5322-ish email regex
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Map OpenPGP / SKS algorithm IDs to human-readable names.
// Reference: https://tools.ietf.org/html/rfc4880#section-9.1
const ALGO_NAMES: Record<number, string> = {
  1: "RSA",
  2: "RSA Encrypt-Only",
  3: "RSA Sign-Only",
  16: "Elgamal",
  17: "DSA",
  18: "ECDH",
  19: "ECDSA",
  20: "Elgamal Encrypt/Sign",
  21: "DH",
  22: "EdDSA",
};

interface PgpResponse {
  email: string;
  found: boolean;
  fingerprint?: string;
  algorithm?: string;
  keyLength?: string;
  created?: string;
  expires?: string | null;
  userIds?: string[];
  armored?: string;
  source?: string;
  notes: string[];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "User-Agent": "OsintFlow/1.0 (+https://example.com/osintflow)",
        ...(opts.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

// Decode HTML entities and percent-encoding used in keyserver vindex output.
function decodeUid(raw: string): string {
  let s = raw;
  // Decode percent-encoded sequences (%XX) — used by SKS for special chars.
  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore if not valid percent-encoding
  }
  // Decode common HTML entities
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return s;
}

// Parse the machine-readable vindex output from keyserver.ubuntu.com.
// Format:
//   info:1:7
//   pub:<keyid>:<algo>:<keylen>:<created>:<expires>:<flags>
//   uid:<escaped uid>:<created>:<expires>:<flags>
function parseVindex(text: string): {
  fingerprint?: string;
  algorithm?: string;
  keyLength?: string;
  created?: string;
  expires?: string | null;
  userIds: string[];
} {
  const lines = text.split(/\r?\n/);
  let fingerprint: string | undefined;
  let algorithm: string | undefined;
  let keyLength: string | undefined;
  let created: string | undefined;
  let expires: string | null = null;
  const userIds: string[] = [];

  for (const line of lines) {
    if (line.startsWith("pub:")) {
      const parts = line.split(":");
      // pub:<keyid>:<algo>:<keylen>:<created>:<expires>:<flags>
      const keyid = parts[1] ?? "";
      const algoNum = parseInt(parts[2] ?? "", 10);
      const klen = parts[3] ?? "";
      const createdTs = parts[4] ?? "";
      const expiresTs = parts[5] ?? "";
      const flags = parts[6] ?? "";

      // The "keyid" field of vindex is actually the long fingerprint when
      // op=vindex is used (40 hex chars for v4 keys). Otherwise it's the
      // short/long key ID. We treat any non-empty value as fingerprint.
      if (keyid) fingerprint = keyid.toUpperCase();
      algorithm = ALGO_NAMES[algoNum] ?? (algoNum ? `Algo ${algoNum}` : undefined);
      if (klen) keyLength = klen;
      if (createdTs) {
        const ts = parseInt(createdTs, 10);
        if (!Number.isNaN(ts) && ts > 0) {
          created = new Date(ts * 1000).toISOString();
        }
      }
      if (expiresTs) {
        const ts = parseInt(expiresTs, 10);
        if (!Number.isNaN(ts) && ts > 0) {
          expires = new Date(ts * 1000).toISOString();
        } else {
          expires = null;
        }
      } else if (flags.includes("e")) {
        expires = null; // expiry flag present but no date
      }
    } else if (line.startsWith("uid:")) {
      const parts = line.split(":");
      const rawUid = parts[1] ?? "";
      if (rawUid) {
        userIds.push(decodeUid(rawUid));
      }
    }
  }

  return {
    fingerprint,
    algorithm,
    keyLength,
    created,
    expires,
    userIds,
  };
}

export async function POST(req: NextRequest) {
  const notes: string[] = [];
  let email = "";

  try {
    const body = await req.json().catch(() => ({}));
    email = String(body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { email: "", found: false, notes: ["Email requerido."] },
        { status: 200 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        {
          email,
          found: false,
          notes: ["El formato del correo no es válido."],
        },
        { status: 200 }
      );
    }

    // ---- 1) Try Ubuntu keyserver vindex (machine-readable) for metadata ----
    const vindexUrl = `https://keyserver.ubuntu.com/pks/lookup?op=vindex&search=${encodeURIComponent(
      email
    )}&options=mr`;

    let meta: {
      fingerprint?: string;
      algorithm?: string;
      keyLength?: string;
      created?: string;
      expires?: string | null;
      userIds: string[];
    } | null = null;
    let ubuntuOk = false;

    try {
      const res = await fetchWithTimeout(vindexUrl, {}, 8000);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes("pub:")) {
          meta = parseVindex(text);
          ubuntuOk = true;
        }
      } else if (res.status === 404) {
        notes.push("keyserver.ubuntu.com: sin resultados (404).");
      } else {
        notes.push(`keyserver.ubuntu.com: HTTP ${res.status}.`);
      }
    } catch (err) {
      notes.push(
        `keyserver.ubuntu.com: ${
          err instanceof Error ? err.message : "error de red"
        }.`
      );
    }

    // ---- 2) Try openpgp.org for the armored key block ----
    const armoredUrl = `https://keys.openpgp.org/vks/v1/by-email/${encodeURIComponent(
      email
    )}`;
    let armored: string | undefined;
    let source: string | undefined;

    try {
      const res = await fetchWithTimeout(armoredUrl, {}, 8000);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes("BEGIN PGP PUBLIC KEY BLOCK")) {
          armored = text.trim();
          source = "keys.openpgp.org";
        } else {
          notes.push("keys.openpgp.org: respuesta inesperada (sin bloque armor).");
        }
      } else if (res.status === 404) {
        notes.push("keys.openpgp.org: sin resultados (404).");
      } else {
        notes.push(`keys.openpgp.org: HTTP ${res.status}.`);
      }
    } catch (err) {
      notes.push(
        `keys.openpgp.org: ${
          err instanceof Error ? err.message : "error de red"
        }.`
      );
    }

    // If openpgp.org didn't have it, try fetching armor from ubuntu keyserver
    if (!armored) {
      const ubuntuArmorUrl = `https://keyserver.ubuntu.com/pks/lookup?op=get&search=${encodeURIComponent(
        email
      )}&options=mr`;
      try {
        const res = await fetchWithTimeout(ubuntuArmorUrl, {}, 8000);
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes("BEGIN PGP PUBLIC KEY BLOCK")) {
            armored = text.trim();
            source = "keyserver.ubuntu.com";
          }
        }
      } catch (err) {
        notes.push(
          `keyserver.ubuntu.com (armor): ${
            err instanceof Error ? err.message : "error de red"
          }.`
        );
      }
    }

    // ---- 3) Compose final response ----
    const found = !!(meta && meta.userIds.length > 0) || !!armored;

    if (!found) {
      return NextResponse.json<PgpResponse>({
        email,
        found: false,
        notes: [
          "No se encontraron claves PGP asociadas a este correo en los servidores consultados (keys.openpgp.org y keyserver.ubuntu.com).",
          "No todas las personas tienen una clave PGP publicada; es habitual entre desarrolladores, administradores de sistemas y profesionales de la seguridad.",
          ...notes,
        ],
      });
    }

    if (armored && !source) source = "keys.openpgp.org";
    if (armored && !meta && !ubuntuOk) {
      // We have an armored key but no metadata — try to derive nothing more.
      notes.push(
        "Se recuperó el bloque de clave pública pero los metadatos detallados no están disponibles."
      );
    }

    return NextResponse.json<PgpResponse>({
      email,
      found: true,
      fingerprint: meta?.fingerprint,
      algorithm: meta?.algorithm,
      keyLength: meta?.keyLength,
      created: meta?.created,
      expires: meta?.expires ?? null,
      userIds: meta?.userIds ?? [],
      armored,
      source,
      notes,
    });
  } catch (err) {
    return NextResponse.json<PgpResponse>({
      email,
      found: false,
      notes: [
        `Error inesperado: ${
          err instanceof Error ? err.message : "desconocido"
        }`,
      ],
    });
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "pgp",
    description:
      "Busca claves PGP públicas asociadas a un email en keys.openpgp.org y keyserver.ubuntu.com.",
    keyservers: ["keys.openpgp.org", "keyserver.ubuntu.com"],
  });
}
