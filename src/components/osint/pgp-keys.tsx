"use client";

import { useState } from "react";
import {
  KeyRound,
  Loader2,
  Search,
  Copy,
  Fingerprint,
  Calendar,
  CalendarClock,
  User,
  Server,
  Info,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface PgpResult {
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

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Split a long hex fingerprint into groups of 4 for readability.
function formatFingerprint(fp?: string): string {
  if (!fp) return "—";
  const clean = fp.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (clean.length <= 8) return clean;
  // Group in blocks of 4
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

export function PgpKeysTool() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PgpResult | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Introduce un correo electrónico.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/pgp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data: PgpResult = await res.json();
      setResult(data);
      saveHistory({ tool: "pgp", query: trimmed, results: data });
      toast({
        title: data.found ? "Clave encontrada" : "Sin resultados",
        description: data.found
          ? "Se recuperaron datos de la clave PGP."
          : "No se encontraron claves PGP para este correo.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyArmored() {
    if (!result?.armored) return;
    try {
      await navigator.clipboard.writeText(result.armored);
      toast({
        title: "Copiado",
        description: "La clave pública se copió al portapapeles.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "No se pudo copiar",
        description: "Copia el texto manualmente desde el cuadro.",
      });
    }
  }

  return (
    <ToolShell
      title="Buscador de Claves PGP"
      description="Introduce un email para consultar servidores de claves públicas (keys.openpgp.org y keyserver.ubuntu.com). Si la persona tiene una clave PGP, se extraerán el nombre real, la empresa, la fecha de creación y la huella digital de la clave."
      icon={<KeyRound className="h-6 w-6" />}
    >
      <Card className="p-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-2"
        >
          <Input
            type="email"
            placeholder="ej: alguien@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={loading} className="shrink-0">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar clave
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          La búsqueda consulta los servidores públicos{" "}
          <span className="font-mono">keys.openpgp.org</span> y{" "}
          <span className="font-mono">keyserver.ubuntu.com</span>. No se
          almacenan las consultas.
        </p>
      </Card>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando servidores de claves públicas...
        </Card>
      )}

      {result && !loading && !result.found && (
        <Card className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              No se encontraron claves PGP
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No todas las personas tienen una clave PGP publicada. Es habitual
            entre desarrolladores, administradores de sistemas, criptógrafos y
            profesionales de la seguridad, pero la mayoría de usuarios de
            internet no tienen una.
          </p>
          {result.notes.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {result && !loading && result.found && (
        <div className="flex flex-col gap-4">
          {/* Key info */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Información de la clave</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Fingerprint className="h-3 w-3" /> Huella digital
                </span>
                <span className="text-xs font-mono break-all">
                  {formatFingerprint(result.fingerprint)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Algoritmo / longitud
                </span>
                <span className="text-xs font-mono">
                  {result.algorithm ?? "—"}
                  {result.keyLength ? ` · ${result.keyLength} bits` : ""}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Creación
                </span>
                <span className="text-xs">
                  {formatDate(result.created ?? null)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> Caducidad
                </span>
                <span className="text-xs">
                  {result.expires
                    ? formatDate(result.expires)
                    : "Sin caducidad"}
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Server className="h-3 w-3" /> Servidor de origen
                </span>
                <span className="text-xs font-mono">
                  {result.source ?? "—"}
                </span>
              </div>
            </div>
          </Card>

          {/* User IDs */}
          {result.userIds && result.userIds.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5" />
                <h3 className="text-sm font-semibold">
                  Identidades (User IDs) · {result.userIds.length}
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {result.userIds.map((uid, i) => (
                    <li
                      key={i}
                      className="px-3 py-2 text-xs font-mono break-all"
                    >
                      {uid}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Los User IDs suelen tener el formato{" "}
                <span className="font-mono">Nombre (Comentario) &lt;email&gt;</span>.
                Pueden revelar el nombre real de la persona y, a veces, su
                empresa o rol.
              </p>
            </Card>
          )}

          {/* Armored key */}
          {result.armored && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  <h3 className="text-sm font-semibold">
                    Clave pública (ASCII armor)
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyArmored}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar clave
                </Button>
              </div>
              <Textarea
                readOnly
                value={result.armored}
                className="font-mono text-xs max-h-64 overflow-y-auto resize-none"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Este bloque es la clave pública en formato ASCII-armored. Puedes
                importarlo con{" "}
                <span className="font-mono">gpg --import</span> o cualquier
                cliente compatible con OpenPGP.
              </p>
            </Card>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Notas</h3>
              </div>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}
