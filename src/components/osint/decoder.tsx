"use client";

import { useState, useCallback } from "react";
import {
  Braces,
  Copy,
  Check,
  Sparkles,
  Hash,
  Binary,
  AlertCircle,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

// ---------------------------------------------------------------------------
// Pure-JS MD5 implementation (RFC 1321). Based on the public-domain
// blueimp-md5 algorithm, adapted to TypeScript with TextEncoder for UTF-8.
// ---------------------------------------------------------------------------
function safeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function bitRol(num: number, cnt: number): number {
  return (num << cnt) | (num >>> (32 - cnt));
}

function md5cmn(
  q: number,
  a: number,
  b: number,
  x: number,
  s: number,
  t: number
): number {
  return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number
): number {
  return md5cmn((b & c) | (~b & d), a, b, x, s, t);
}

function md5gg(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number
): number {
  return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function md5hh(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number
): number {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number
): number {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

function binlMD5(x: number[], len: number): number[] {
  x[len >> 5] |= 0x80 << len % 32;
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }
  return [a, b, c, d];
}

function binl2rstr(input: number[]): string {
  let output = "";
  for (let i = 0; i < input.length * 32; i += 8) {
    output += String.fromCharCode((input[i >> 5] >>> i % 32) & 0xff);
  }
  return output;
}

function rstr2binl(input: string): number[] {
  const output: number[] = [];
  for (let i = 0; i < input.length * 8; i += 8) {
    output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << i % 32;
  }
  return output;
}

function rstrMD5(s: string): string {
  return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
}

function rstr2hex(input: string): string {
  const hexTab = "0123456789abcdef";
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const x = input.charCodeAt(i);
    output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
  }
  return output;
}

// Convert UTF-8 string to a "raw" string where each char represents one byte
// (0-255). Uses TextEncoder for safe UTF-8 encoding.
function str2rstrUTF8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i]);
  }
  return raw;
}

function md5(input: string): string {
  return rstr2hex(rstrMD5(str2rstrUTF8(input)));
}

// ---------------------------------------------------------------------------
// Web Crypto SHA digests.
// ---------------------------------------------------------------------------
async function sha(algorithm: "SHA-1" | "SHA-256", input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest(algorithm, data);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Encoder/decoder helpers.
// ---------------------------------------------------------------------------
function isPrintable(s: string): boolean {
  if (!s) return false;
  let printable = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // Allow tab/newline/carriage-return + printable ASCII + Latin-1 accented.
    if (c === 9 || c === 10 || c === 13) {
      printable++;
      continue;
    }
    if (c >= 32 && c <= 126) {
      printable++;
      continue;
    }
    if (c >= 160 && c <= 255) {
      printable++;
      continue;
    }
    // Otherwise: non-printable control char or high Unicode. Reject.
    return false;
  }
  return printable > 0;
}

function tryBase64Decode(s: string): string | null {
  try {
    // Browser atob works on Latin-1; we then convert UTF-8 bytes back to str.
    const latin1 = atob(s);
    const bytes = new Uint8Array(latin1.length);
    for (let i = 0; i < latin1.length; i++) bytes[i] = latin1.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function base64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function tryHexDecode(s: string): string | null {
  try {
    if (s.length % 2 !== 0) return null;
    const bytes = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) {
      const byte = parseInt(s.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) return null;
      bytes[i / 2] = byte;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function hexEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function urlDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // Fall back to unescape for malformed sequences.
    try {
      return unescape(s);
    } catch {
      return s;
    }
  }
}

function urlEncode(s: string): string {
  return encodeURIComponent(s);
}

function rot13(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      out += String.fromCharCode(((c - 65 + 13) % 26) + 65);
    } else if (c >= 97 && c <= 122) {
      out += String.fromCharCode(((c - 97 + 13) % 26) + 97);
    } else {
      out += s.charAt(i);
    }
  }
  return out;
}

interface Detection {
  format: string;
  result: string;
}

// Auto-detect: try several formats and return all plausible candidates.
function autoDetect(input: string): Detection[] {
  const trimmed = input.trim();
  const candidates: Detection[] = [];
  if (!trimmed) return candidates;

  // 1) URL encoding (look for %XX patterns).
  if (/%[0-9a-fA-F]{2}/.test(trimmed)) {
    const decoded = urlDecode(trimmed);
    if (decoded !== trimmed && isPrintable(decoded)) {
      candidates.push({ format: "URL encode", result: decoded });
    }
  }

  // 2) Base64 (charset + length multiple of 4).
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0 && trimmed.length >= 4) {
    const decoded = tryBase64Decode(trimmed);
    if (decoded !== null && isPrintable(decoded)) {
      candidates.push({ format: "Base64", result: decoded });
    }
  }

  // 3) Hex (only hex chars + even length).
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length >= 2) {
    const decoded = tryHexDecode(trimmed);
    if (decoded !== null && isPrintable(decoded)) {
      candidates.push({ format: "Hexadecimal", result: decoded });
    }
  }

  // 4) ROT13 — always yields printable output if input is printable, so we
  //    only include it as a candidate when nothing else matched.
  if (candidates.length === 0 && isPrintable(trimmed) && /[A-Za-z]/.test(trimmed)) {
    candidates.push({ format: "ROT13", result: rot13(trimmed) });
  }

  return candidates;
}

export function DecoderTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const persistHistory = useCallback(
    (out: string) => {
      const query = input.slice(0, 80);
      saveHistory({ tool: "decoder", query, results: { input, output: out } });
    },
    [input]
  );

  function setOutAndPersist(out: string) {
    setOutput(out);
    persistHistory(out);
  }

  function handleAutoDetect() {
    const trimmed = input.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Entrada vacía",
        description: "Pega algo en el campo de entrada.",
      });
      return;
    }
    const cands = autoDetect(input);
    if (cands.length === 0) {
      const out = "Detectado: (sin resultados)\n\nNo se reconoció ningún formato conocido (Base64, Hex, URL encode, ROT13) o la decodificación no produjo texto imprimible.";
      setOutAndPersist(out);
      toast({
        title: "Sin detecciones",
        description: "No se reconoció ningún formato conocido.",
      });
      return;
    }
    if (cands.length === 1) {
      const c = cands[0];
      const out = `Detectado: ${c.format}\n\n${c.result}`;
      setOutAndPersist(out);
      toast({ title: `Detectado: ${c.format}`, description: "Decodificación aplicada." });
      return;
    }
    // Multiple plausible candidates.
    const lines = cands.map(
      (c, i) =>
        `--- Candidato ${i + 1}: ${c.format} ---\n${c.result}`
    );
    const out = `Detectado: varios formatos posibles (${cands
      .map((c) => c.format)
      .join(", ")})\n\n${lines.join("\n\n")}`;
    setOutAndPersist(out);
    toast({
      title: `${cands.length} candidatos detectados`,
      description: "Revisa la salida para ver cada uno.",
    });
  }

  function handleBase64Decode() {
    const decoded = tryBase64Decode(input.trim());
    if (decoded === null) {
      toast({
        variant: "destructive",
        title: "Base64 inválido",
        description: "El texto no es Base64 válido.",
      });
      return;
    }
    setOutAndPersist(decoded);
  }

  function handleBase64Encode() {
    setOutAndPersist(base64Encode(input));
  }

  function handleHexDecode() {
    const decoded = tryHexDecode(input.trim().replace(/\s+/g, ""));
    if (decoded === null) {
      toast({
        variant: "destructive",
        title: "Hex inválido",
        description: "El texto no es hexadecimal par válido.",
      });
      return;
    }
    setOutAndPersist(decoded);
  }

  function handleHexEncode() {
    setOutAndPersist(hexEncode(input));
  }

  function handleUrlDecode() {
    setOutAndPersist(urlDecode(input));
  }

  function handleUrlEncode() {
    setOutAndPersist(urlEncode(input));
  }

  function handleRot13() {
    setOutAndPersist(rot13(input));
  }

  async function handleMd5() {
    setOutAndPersist(md5(input));
  }

  async function handleSha(algo: "SHA-1" | "SHA-256", label: string) {
    try {
      const hex = await sha(algo, input);
      setOutAndPersist(hex);
      toast({ title: `${label} calculado`, description: `${hex.length} hex chars` });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al calcular hash",
        description: err instanceof Error ? err.message : "error desconocido",
      });
    }
  }

  async function handleCopy() {
    if (!output) {
      toast({
        variant: "destructive",
        title: "Nada que copiar",
        description: "La salida está vacía.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast({ title: "Salida copiada", description: "Al portapapeles." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        variant: "destructive",
        title: "No se pudo copiar",
        description: "Copia manualmente el texto.",
      });
    }
  }

  return (
    <ToolShell
      title="Decodificador Universal"
      description="Pega un texto extraño y OsintFlow detecta automáticamente si es Base64, Hexadecimal, URL encode, etc. También permite codificar y calcular hashes (MD5, SHA1, SHA256)."
      icon={<Braces className="h-6 w-6" />}
    >
      {/* Input */}
      <Card className="p-4 sm:p-6 flex flex-col gap-2">
        <Label htmlFor="decoder-input">Entrada</Label>
        <Textarea
          id="decoder-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pega aquí el texto a decodificar, codificar o hashear..."
          className="font-mono min-h-[120px]"
          autoComplete="off"
        />
      </Card>

      {/* Buttons */}
      <Card className="p-4 sm:p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Operaciones</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleAutoDetect}>
            <Sparkles className="h-4 w-4 mr-2" />
            Auto-detectar
          </Button>
          <Button type="button" variant="outline" onClick={handleBase64Decode}>
            Base64 → texto
          </Button>
          <Button type="button" variant="outline" onClick={handleBase64Encode}>
            Texto → Base64
          </Button>
          <Button type="button" variant="outline" onClick={handleHexDecode}>
            <Binary className="h-4 w-4 mr-2" />
            Hex → texto
          </Button>
          <Button type="button" variant="outline" onClick={handleHexEncode}>
            Texto → Hex
          </Button>
          <Button type="button" variant="outline" onClick={handleUrlDecode}>
            URL decode
          </Button>
          <Button type="button" variant="outline" onClick={handleUrlEncode}>
            URL encode
          </Button>
          <Button type="button" variant="outline" onClick={handleRot13}>
            ROT13
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 w-full text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            <span>Hashes (salida en hexadecimal):</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleMd5}>
            MD5
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSha("SHA-1", "SHA1")}
          >
            SHA1
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSha("SHA-256", "SHA256")}
          >
            SHA256
          </Button>
        </div>
      </Card>

      {/* Output */}
      <Card className="p-4 sm:p-6 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="decoder-output">Salida</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!output}
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <Textarea
          id="decoder-output"
          value={output}
          readOnly
          placeholder="El resultado aparecerá aquí..."
          className="font-mono min-h-[160px]"
        />
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Todos los cálculos se realizan en tu navegador; ningún dato se envía
          al servidor.
        </span>
      </p>
    </ToolShell>
  );
}
