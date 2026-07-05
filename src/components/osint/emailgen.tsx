"use client";

import { useState } from "react";
import {
  AtSign,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

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

const STATUS_META: Record<
  SmtpStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "Válido",
    className: "border-foreground/40 text-foreground",
  },
  invalid: {
    label: "No válido",
    className: "border-destructive text-destructive",
  },
  unknown: {
    label: "Desconocido",
    className: "border-border text-muted-foreground",
  },
};

export function EmailGenTool() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailGenResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const dom = domain.trim().toLowerCase();
    if (!fn && !ln) {
      toast({
        variant: "destructive",
        title: "Datos requeridos",
        description: "Introduce al menos un nombre o apellido.",
      });
      return;
    }
    if (!dom) {
      toast({
        variant: "destructive",
        title: "Dominio requerido",
        description: "Introduce un dominio (ej: empresa.com).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/emailgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: fn, lastName: ln, domain: dom }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar correos");
      setResult(data as EmailGenResult);
      saveHistory({
        tool: "emailgen",
        query: `${fn} ${ln} @${dom}`.trim(),
        results: data,
      });
      toast({
        title: "Verificación completada",
        description: `Se generaron ${(data as EmailGenResult).permutations.length} combinaciones.`,
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

  function handleCopyValid() {
    if (!result) return;
    const validEmails = result.permutations
      .filter((p) => p.status === "valid")
      .map((p) => p.email);
    if (validEmails.length === 0) {
      toast({
        title: "Sin correos válidos",
        description: "No hay direcciones verificadas como válidas que copiar.",
      });
      return;
    }
    navigator.clipboard.writeText(validEmails.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado",
      description: `${validEmails.length} correos válidos copiados al portapapeles.`,
    });
  }

  const counts = result
    ? {
        valid: result.permutations.filter((p) => p.status === "valid").length,
        invalid: result.permutations.filter((p) => p.status === "invalid")
          .length,
        unknown: result.permutations.filter((p) => p.status === "unknown")
          .length,
      }
    : null;

  return (
    <ToolShell
      title="Generador y Verificador de Correos"
      description="Introduce el nombre, apellido y dominio de una empresa para generar todas las combinaciones posibles de email (j.doe@, jdoe@, etc.) y verificar cuáles existen realmente vía SMTP."
      icon={<AtSign className="h-6 w-6" />}
    >
      <form
        onSubmit={handleGenerate}
        className="flex flex-col sm:flex-row gap-2 sm:items-end"
      >
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="ej: Juan"
            autoComplete="off"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Apellido</label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="ej: Pérez"
            autoComplete="off"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Dominio</label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ej: empresa.com"
            className="font-mono"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Verificando..." : "Generar y verificar"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Usa esta herramienta solo sobre dominios de tu propiedad o para los que
        tengas autorización explícita. La verificación SMTP es best-effort y
        algunos servidores falsean las respuestas.
      </p>

      {loading && (
        <Card className="p-6 flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generando permutaciones y consultando el servidor MX...</span>
          </div>
          <span className="text-xs">
            La verificación SMTP puede tardar hasta 40 segundos; se comprueban
            las primeras combinaciones una a una para no saturar el servidor.
          </span>
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium font-mono">
                    @{result.domain}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.permutations.length} combinaciones generadas
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {counts && counts.valid > 0 && (
                  <Badge variant="outline" className="gap-1 border-foreground/40 text-foreground">
                    <ShieldCheck className="h-3 w-3" /> {counts.valid} válidos
                  </Badge>
                )}
                {counts && counts.invalid > 0 && (
                  <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                    <ShieldAlert className="h-3 w-3" /> {counts.invalid} no válidos
                  </Badge>
                )}
                {counts && counts.unknown > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {counts.unknown} desconocidos
                  </Badge>
                )}
                {result.catchAll && (
                  <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                    <AlertTriangle className="h-3 w-3" /> Catch-all detectado
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Permutations table */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-sm font-semibold">Permutaciones verificadas</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyValid}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copiar válidos
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-1/4">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.permutations.map((p) => {
                    const meta = STATUS_META[p.status];
                    return (
                      <TableRow key={p.email}>
                        <TableCell className="font-mono text-xs break-all">
                          {p.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* MX records */}
          {result.mxRecords.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">
                Registros MX de {result.domain}
              </h3>
              <div className="flex flex-col gap-1">
                {result.mxRecords.map((mx) => (
                  <span key={mx} className="font-mono text-xs">
                    {mx}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Observaciones</h3>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
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
