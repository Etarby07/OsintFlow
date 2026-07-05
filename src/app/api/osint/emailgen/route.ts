import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import net from "net";

// Limit the number of permutations we actually SMTP-verify, to avoid being
// flagged as abusive behaviour by the destination mail server.
const MAX_VERIFY = 6;

// Per-connection SMTP timeout (ms).
const SMTP_TIMEOUT_MS = 6000;

// Small polite delay between successive SMTP probes.
const PROBE_DELAY_MS = 250;

type SmtpStatus = "valid" | "invalid" | "unknown";

interface Perm {
  email: string;
  status: SmtpStatus;
}

interface EmailGenResult {
  firstName: string;
  lastName: string;
  domain: string;
  permutations: Perm[];
  catchAll: boolean;
  mxRecords: string[];
  notes: string[];
}

/**
 * Build the full list of candidate email permutations from a first/last name.
 * Returns up to ~14 patterns combined with the supplied domain.
 */
function buildPermutations(
  firstRaw: string,
  lastRaw: string,
  domain: string
): string[] {
  const first = firstRaw.toLowerCase().trim();
  const last = lastRaw.toLowerCase().trim();
  const f = first[0] ?? "";
  const l = last[0] ?? "";

  const locals: string[] = [];
  // Ordered roughly by real-world frequency so the first MAX_VERIFY are the
  // most likely candidates when we cap the SMTP verification.
  if (first) locals.push(first);
  if (last) locals.push(last);
  if (first && last) locals.push(`${first}.${last}`);
  if (first && last) locals.push(`${first}${last}`);
  if (f && last) locals.push(`${f}${last}`);
  if (first && l) locals.push(`${first}${l}`);
  if (f && last) locals.push(`${f}.${last}`);
  if (first && last) locals.push(`${first}_${last}`);
  if (first && last) locals.push(`${last}${first}`);
  if (first && last) locals.push(`${last}.${first}`);
  if (last && f) locals.push(`${last}${f}`);
  if (f && l) locals.push(`${f}${l}`);
  if (first && last) locals.push(`${first}-${last}`);
  if (f && last) locals.push(`${f}+${last}`);

  // Dedupe while preserving order, then attach the domain.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const local of locals) {
    const email = `${local}@${domain}`;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Talk to a single MX server over SMTP just enough to learn whether the
 * RCPT TO:<email> is accepted.  Best-effort; any network/parsing failure is
 * treated as "unknown".  The socket is destroyed as soon as we have an answer
 * and we send QUIT first to be polite.
 */
function smtpRcptCheck(mxHost: string, email: string): Promise<SmtpStatus> {
  return new Promise((resolve) => {
    let resolved = false;
    let buffer = "";
    let state: "greeting" | "helo" | "mail" | "rcpt" = "greeting";
    let rcptResult: SmtpStatus = "unknown";

    const finish = (result: SmtpStatus) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const socket = net.createConnection({ host: mxHost, port: 25 });
    const timer = setTimeout(() => finish("unknown"), SMTP_TIMEOUT_MS);

    const send = (cmd: string) => {
      try {
        socket.write(cmd + "\r\n");
      } catch {
        /* ignore */
      }
    };

    const processBuffer = () => {
      // Pull complete CRLF-terminated lines out of the buffer.
      while (true) {
        const idx = buffer.indexOf("\r\n");
        if (idx === -1) break;
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        // SMTP multiline responses: a "-" as the 4th char means there is at
        // least one more line for the same response. Wait for the final line.
        if (line.length >= 4 && line[3] === "-") continue;

        const code = parseInt(line.slice(0, 3), 10);
        if (Number.isNaN(code)) continue;

        switch (state) {
          case "greeting":
            if (code >= 200 && code < 400) {
              send("HELO osintflow.local");
              state = "helo";
            } else {
              finish("unknown");
            }
            break;
          case "helo":
            if (code >= 200 && code < 400) {
              send("MAIL FROM:<check@osintflow.local>");
              state = "mail";
            } else {
              finish("unknown");
            }
            break;
          case "mail":
            if (code >= 200 && code < 400) {
              send(`RCPT TO:<${email}>`);
              state = "rcpt";
            } else {
              finish("unknown");
            }
            break;
          case "rcpt":
            if (code === 250) rcptResult = "valid";
            else if (code === 550 || code === 551 || code === 552)
              rcptResult = "invalid";
            else rcptResult = "unknown";
            send("QUIT");
            // Give the socket a tiny window to flush QUIT before destroy.
            setTimeout(() => finish(rcptResult), 50);
            break;
        }
      }
    };

    socket.on("data", (data) => {
      buffer += data.toString("latin1");
      processBuffer();
    });
    socket.on("timeout", () => finish("unknown"));
    socket.on("error", () => finish("unknown"));
    socket.on("close", () => {
      if (!resolved) finish(rcptResult);
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const domainRaw = String(body?.domain ?? "").trim().toLowerCase();

    const notes: string[] = [];

    if (!firstName && !lastName) {
      return NextResponse.json(
        {
          firstName,
          lastName,
          domain: domainRaw,
          permutations: [],
          catchAll: false,
          mxRecords: [],
          notes: ["Debes introducir al menos un nombre o apellido."],
        },
        { status: 200 }
      );
    }
    if (!domainRaw) {
      return NextResponse.json(
        {
          firstName,
          lastName,
          domain: "",
          permutations: [],
          catchAll: false,
          mxRecords: [],
          notes: ["Debes introducir un dominio (ej: empresa.com)."],
        },
        { status: 200 }
      );
    }
    if (/\s/.test(domainRaw)) {
      return NextResponse.json(
        {
          firstName,
          lastName,
          domain: domainRaw,
          permutations: [],
          catchAll: false,
          mxRecords: [],
          notes: ["El dominio no puede contener espacios."],
        },
        { status: 200 }
      );
    }
    // Strip a leading @ if the user typed one.
    const domain = domainRaw.replace(/^@/, "");

    // Build the full permutation list.
    const allEmails = buildPermutations(firstName, lastName, domain);
    const permutations: Perm[] = allEmails.map((email) => ({
      email,
      status: "unknown" as SmtpStatus,
    }));

    // Resolve MX records for the domain.
    let mxRecords: string[] = [];
    let mxHost: string | null = null;
    try {
      const records = await dns.resolveMx(domain);
      if (records.length > 0) {
        records.sort((a, b) => a.priority - b.priority);
        mxHost = records[0].exchange;
        mxRecords = records.map((r) => `${r.exchange} (prioridad ${r.priority})`);
      }
    } catch {
      mxRecords = [];
    }

    if (mxRecords.length === 0) {
      notes.push(
        `No se encontraron registros MX para "${domain}". No es posible verificar las direcciones por SMTP; todas se marcan como "desconocido".`
      );
      notes.push(
        "Nota ética: la verificación SMTP es solo orientativa y debe usarse únicamente sobre dominios de tu propiedad o para los que tengas autorización explícita."
      );
      return NextResponse.json(
        {
          firstName,
          lastName,
          domain,
          permutations,
          catchAll: false,
          mxRecords,
          notes,
        },
        { status: 200 }
      );
    }

    // Verify the first MAX_VERIFY permutations via SMTP, with small delays.
    const toVerify = permutations.slice(0, MAX_VERIFY);
    let allAccepted = true;
    for (const p of toVerify) {
      const status = await smtpRcptCheck(mxHost as string, p.email);
      p.status = status;
      if (status !== "valid") allAccepted = false;
      await sleep(PROBE_DELAY_MS);
    }

    // Catch-all detection: if every probed address was accepted, probe an
    // obviously fake local-part.  If it is also accepted, the server is a
    // catch-all and none of the "valid" results are meaningful.
    let catchAll = false;
    if (allAccepted && toVerify.length > 0) {
      const fake = `zzztest999-osintflow@${domain}`;
      const fakeStatus = await smtpRcptCheck(mxHost as string, fake);
      if (fakeStatus === "valid") {
        catchAll = true;
        for (const p of toVerify) p.status = "unknown";
        notes.push(
          `El servidor MX de "${domain}" acepta cualquier destinatario (catch-all). Los resultados positivos no son fiables; todas las direcciones se marcan como "desconocido".`
        );
      }
    }

    notes.push(
      `Se verificaron las primeras ${toVerify.length} permutaciones de un total de ${permutations.length} generadas (límite para no saturar el servidor).`
    );
    notes.push(
      "La verificación SMTP es best-effort: muchos servidores limitan o falsean las respuestas para proteger la privacidad de sus usuarios."
    );
    notes.push(
      "Nota ética: utiliza esta herramienta únicamente sobre dominios de tu propiedad o para los que dispongas de autorización explícita. El envío masivo de sondas SMTP sin permiso puede considerarse abuso."
    );

    const result: EmailGenResult = {
      firstName,
      lastName,
      domain,
      permutations,
      catchAll,
      mxRecords,
      notes,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        firstName: "",
        lastName: "",
        domain: "",
        permutations: [],
        catchAll: false,
        mxRecords: [],
        notes: [
          `Error fatal: ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        ],
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tool: "emailgen",
    description:
      "Genera combinaciones de email a partir de nombre, apellido y dominio, y verifica las primeras direcciones por SMTP contra el servidor MX de mayor prioridad.",
    method: "POST",
    body: { firstName: "string", lastName: "string", domain: "string" },
    maxVerified: MAX_VERIFY,
    smtpTimeoutMs: SMTP_TIMEOUT_MS,
    ethical:
      "Usa esta herramienta solo sobre dominios que controles o para los que tengas autorización explícita.",
  });
}
