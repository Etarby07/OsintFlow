"use client";

import { useState } from "react";
import {
  PhoneCall,
  Loader2,
  Search,
  Phone,
  Globe2,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  UserCheck,
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
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface SearchLink {
  label: string;
  url: string;
}

interface CallerIdResult {
  phone: string;
  valid: boolean;
  e164?: string;
  country?: string;
  countryCode?: string;
  nationalNumber?: string;
  type?: string;
  callerName?: string;
  isSpam?: boolean;
  searchLinks: SearchLink[];
  notes: string[];
}

export function CallerIdTool() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallerIdResult | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Teléfono requerido",
        description: "Introduce un número con prefijo internacional.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/callerid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = (await res.json()) as CallerIdResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Error en la consulta");
      setResult(data);
      saveHistory({ tool: "callerid", query: trimmed, results: data });
      toast({
        title: "Consulta completada",
        description: data.valid
          ? data.isSpam
            ? "Número marcado como spam."
            : "Número válido. Revisa los detalles."
          : "El número no es válido.",
        variant: data.isSpam ? "destructive" : "default",
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

  return (
    <ToolShell
      title="Identificador de Spam y Llamadas"
      description="Introduce un número de teléfono para identificar a quién pertenece (si está disponible públicamente) y comprobar si otros usuarios lo han marcado como spam o estafa."
      icon={<PhoneCall className="h-6 w-6" />}
    >
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="ej: +34 912 345 678"
          className="font-mono"
          autoComplete="off"
          type="tel"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Identificando..." : "Identificar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Parseando número y buscando en bases de datos públicas...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Parsed number */}
          {result.valid ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Número parseado</h3>
              </div>
              <Table>
                <TableBody>
                  <DetailRow
                    label="Formato E.164"
                    value={result.e164}
                    mono
                  />
                  <DetailRow label="País" value={result.country} />
                  <DetailRow
                    label="Código ISO"
                    value={result.countryCode}
                    mono
                  />
                  <DetailRow
                    label="Número nacional"
                    value={result.nationalNumber}
                    mono
                  />
                  <DetailRow label="Tipo" value={result.type} />
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Número no válido</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {result.phone
                  ? `"${result.phone}" no es un número válido según libphonenumber.`
                  : "Introduce un número con prefijo internacional."}
              </p>
            </Card>
          )}

          {/* Caller name / spam */}
          {result.valid && (result.callerName || result.isSpam !== undefined) && (
            <Card
              className={`p-4 ${
                result.isSpam ? "border-foreground/40 bg-foreground/5" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {result.isSpam ? (
                  <ShieldAlert className="h-6 w-6 shrink-0" />
                ) : (
                  <ShieldCheck className="h-6 w-6 shrink-0 text-foreground" />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-semibold">
                    {result.callerName ?? "Titular no identificado"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.isSpam
                      ? "Marcado como spam por otros usuarios."
                      : "No marcado como spam."}
                  </span>
                </div>
                {result.isSpam !== undefined && (
                  <Badge
                    variant={result.isSpam ? "destructive" : "outline"}
                    className="ml-auto shrink-0 font-mono text-[10px] uppercase"
                  >
                    {result.isSpam ? "Spam" : "Limpio"}
                  </Badge>
                )}
              </div>
            </Card>
          )}

          {/* Search links */}
          {result.valid && result.searchLinks.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe2 className="h-5 w-5" />
                <h3 className="text-sm font-semibold">
                  Búsquedas públicas
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Estos enlaces te llevan a bases de datos públicas donde otros
                usuarios reportan números de spam. Ábrelos para ver si el número
                aparece reportado.
              </p>
              <div className="flex flex-wrap gap-2">
                {result.searchLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono hover:bg-muted transition-colors"
                  >
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    {link.label}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Observaciones</h3>
              </div>
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

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground w-1/3">
        {label}
      </TableCell>
      <TableCell className={mono ? "font-mono text-xs" : "text-sm"}>
        {value || <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
    </TableRow>
  );
}
