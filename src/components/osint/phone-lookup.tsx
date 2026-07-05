"use client";

import { useState } from "react";
import { Phone, Loader2, Search, MessageCircle, Globe2 } from "lucide-react";
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

interface PhoneResult {
  input: string;
  valid: boolean;
  e164?: string;
  international?: string;
  national?: string;
  country?: string;
  countryCode?: string;
  countryCallingCode?: string;
  type?: string;
  carrier?: string;
  whatsapp?: { possible: boolean; url: string };
  notes: string[];
}

export function PhoneLookupTool() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhoneResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
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
      const res = await fetch("/api/osint/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "phone", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: data.valid
          ? "Número válido. Revisa los detalles."
          : "El número no es válido.",
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
      title="Búsqueda de Teléfono"
      description="Introduce un número de teléfono con prefijo internacional (ej. +34612345678) para identificar el país, el operador probable y generar un enlace directo a WhatsApp."
      icon={<Phone className="h-6 w-6" />}
    >
      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="ej: +34 612 345 678"
          className="font-mono"
          autoComplete="off"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Analizando..." : "Analizar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Parseando número, identificando país y operador...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex items-center gap-3">
            <Phone className="h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-sm font-medium font-mono">
                {result.international ?? result.input}
              </span>
              <span className="text-xs text-muted-foreground">
                {result.valid ? "Número válido" : "Número no válido"}
                {result.type ? ` · Tipo: ${result.type}` : ""}
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Información geográfica</h3>
            </div>
            <Table>
              <TableBody>
                <InfoRow label="País" value={result.country} />
                <InfoRow label="Código ISO" value={result.countryCode} />
                <InfoRow
                  label="Prefijo internacional"
                  value={result.countryCallingCode
                    ? `+${result.countryCallingCode}`
                    : undefined}
                />
                <InfoRow label="Formato E.164" value={result.e164} mono />
                <InfoRow label="Formato nacional" value={result.national} mono />
              </TableBody>
            </Table>
          </Card>

          {result.carrier && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Operador / Carrier</h3>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                <span className="text-sm">{result.carrier}</span>
                <Badge variant="outline">Estimado</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                El operador se estima a partir del rango del número. La
                portabilidad puede hacer que el operador real difiera.
              </p>
            </Card>
          )}

          {result.whatsapp && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Asociación con WhatsApp</h3>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                <span className="text-sm">
                  {result.whatsapp.possible
                    ? "El número tiene el formato válido para WhatsApp."
                    : "El número no tiene un formato válido para WhatsApp."}
                </span>
                {result.whatsapp.possible && (
                  <a
                    href={result.whatsapp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline hover:text-foreground"
                  >
                    Abrir chat →
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                La verificación real de si una cuenta existe en WhatsApp requiere
                su protocolo interno. El enlace <code>wa.me</code> abre un chat
                si la cuenta existe.
              </p>
            </Card>
          )}

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

function InfoRow({
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
