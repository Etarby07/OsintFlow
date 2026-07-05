"use client";

import { useState } from "react";
import {
  Link2,
  Loader2,
  Search,
  ExternalLink,
  History,
  ListOrdered,
  FileText,
  AlertCircle,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface RedirectStep {
  url: string;
  status: number;
  location?: string;
}

interface WaybackInfo {
  timestamp?: string;
  url?: string;
  status?: string;
  calendarUrl: string;
}

interface LinkResult {
  input: string;
  finalUrl: string;
  title?: string;
  redirects: RedirectStep[];
  wayback?: WaybackInfo;
  notes: string[];
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

// Wayback timestamps look like YYYYMMDDhhmmss. Format to a readable string.
function formatTimestamp(ts?: string): string {
  if (!ts) return "";
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/);
  if (!m) return ts;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d} ${h}:${mi}${s ? ":" + s : ""}`;
}

export function LinkAnalyzerTool() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
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
      const res = await fetch("/api/osint/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as LinkResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "link", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: data.finalUrl
          ? `URL final: ${data.finalUrl}`
          : "Análisis finalizado",
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

  const redirectCount = result ? result.redirects.length - 1 : 0;

  return (
    <ToolShell
      title="Analizador de Enlaces"
      description="Pega una URL acortada (bit.ly, tinyurl...) o cualquier enlace. OsintFlow sigue las redirecciones en el servidor para revelar la URL final real y consulta Wayback Machine para mostrar capturas históricas."
      icon={<Link2 className="h-6 w-6" />}
    >
      <form
        onSubmit={handleAnalyze}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ej: https://bit.ly/abc123"
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
          Siguiendo redirecciones y consultando Wayback Machine...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">URL final</h3>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-sm font-mono break-all">
                  {result.finalUrl || "—"}
                </span>
                {result.finalUrl && (
                  <a
                    href={result.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline hover:text-foreground shrink-0"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {result.title && (
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground break-all">
                    {result.title}
                  </span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {redirectCount > 0
                  ? `${redirectCount} redirección${
                      redirectCount > 1 ? "es" : ""
                    } seguida(s)`
                  : "Sin redirecciones"}
              </div>
            </div>
          </Card>

          {/* Redirect chain */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ListOrdered className="h-5 w-5" />
              <h3 className="text-sm font-semibold">
                Cadena de redirecciones
              </h3>
            </div>
            {result.redirects.length <= 1 ? (
              <p className="text-xs text-muted-foreground">
                La URL no tiene redirecciones.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {result.redirects.map((step, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 pt-0.5">
                        {i + 1}.
                      </span>
                      <Badge
                        variant={
                          isRedirectStatus(step.status) ? "outline" : "default"
                        }
                        className="font-mono text-[10px] shrink-0 mt-0.5"
                      >
                        {step.status === 0 ? "ERR" : step.status}
                      </Badge>
                      <span className="text-xs font-mono break-all">
                        {step.url}
                      </span>
                    </div>
                    {step.location && (
                      <div className="ml-8 text-[11px] text-muted-foreground font-mono break-all">
                        →{" "}
                        <a
                          href={new URL(
                            step.location,
                            step.url
                          ).href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          {step.location}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Wayback Machine */}
          {result.wayback && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Wayback Machine</h3>
              </div>
              {result.wayback.url ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">
                    Captura más cercana:{" "}
                    <span className="font-mono text-foreground">
                      {formatTimestamp(result.wayback.timestamp) || "—"}
                    </span>
                    {result.wayback.status && (
                      <span className="ml-2">
                        (HTTP {result.wayback.status})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={result.wayback.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs underline hover:text-foreground"
                    >
                      Ver captura <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={result.wayback.calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs underline hover:text-foreground"
                    >
                      Ver calendario de capturas{" "}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    No hay capturas históricas disponibles.
                  </p>
                  <a
                    href={result.wayback.calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline hover:text-foreground w-fit"
                  >
                    Ver calendario de capturas{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
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
