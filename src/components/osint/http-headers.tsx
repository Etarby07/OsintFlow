"use client";

import { useState } from "react";
import {
  Shield,
  Loader2,
  Search,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Info,
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

interface RawHeader {
  key: string;
  value: string;
}

type Severity = "good" | "bad" | "info";

interface SecurityCheck {
  header: string;
  present: boolean;
  value?: string;
  severity: Severity;
  explanation: string;
}

interface HeadersResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: RawHeader[];
  checks: SecurityCheck[];
  notes: string[];
}

export function HttpHeadersTool() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HeadersResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "URL requerida",
        description: "Pega una URL para analizar.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as HeadersResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "headers", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: `HTTP ${data.statusCode} · ${data.headers.length} cabeceras recibidas`,
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

  const presentCount = result
    ? result.checks.filter((c) => c.present).length
    : 0;
  const totalCount = result ? result.checks.length : 0;

  return (
    <ToolShell
      title="Analizador de Cabeceras de Seguridad"
      description="Introduce una URL para extraer y analizar las cabeceras HTTP de seguridad (HSTS, CSP, X-Frame-Options...) y ver de forma visual qué protecciones están activadas y cuáles faltan."
      icon={<Shield className="h-6 w-6" />}
    >
      <form
        onSubmit={handleAnalyze}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ej: https://example.com"
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
          Descargando cabeceras HTTP (HEAD, fallback GET)...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Resumen de seguridad</h3>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-semibold font-mono">
                  {presentCount}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {totalCount} cabeceras de seguridad presentes
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{result.finalUrl || result.url}</span>
                {result.finalUrl && (
                  <a
                    href={result.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline hover:text-foreground"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Badge variant="outline" className="font-mono text-[10px]">
                  HTTP {result.statusCode}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Security checks */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Cabeceras analizadas</h3>
            </div>
            <div className="flex flex-col gap-2">
              {result.checks.map((c) => (
                <div
                  key={c.header}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium break-all">
                        {c.header}
                      </span>
                      {c.severity === "info" && (
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.explanation}
                    </p>
                    {c.present && c.value && (
                      <span className="text-[11px] font-mono text-muted-foreground break-all mt-1">
                        {c.value}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {c.present ? (
                      <Badge className="bg-foreground text-background border-transparent">
                        <ShieldCheck className="h-3 w-3" />
                        Presente
                      </Badge>
                    ) : c.severity === "info" ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        No presente
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-destructive text-destructive"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Faltante
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* All headers */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">
                Todas las cabeceras ({result.headers.length})
              </h3>
            </div>
            {result.headers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No se recibieron cabeceras en la respuesta.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-1/3">Campo</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.headers.map((h, i) => (
                      <TableRow key={`${h.key}-${i}`}>
                        <TableCell className="font-mono text-xs font-medium text-muted-foreground align-top break-all">
                          {h.key}
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all whitespace-pre-wrap">
                          {h.value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

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
