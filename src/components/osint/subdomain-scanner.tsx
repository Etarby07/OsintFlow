"use client";

import { useState } from "react";
import {
  Network,
  Loader2,
  Search,
  ExternalLink,
  Calendar,
  CalendarClock,
  BadgeCheck,
  Inbox,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface SubdomainInfo {
  name: string;
  firstSeen?: string;
  lastSeen?: string;
  certCount: number;
}

interface SubdomainResult {
  domain: string;
  count: number;
  subdomains: SubdomainInfo[];
  notes: string[];
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function SubdomainScannerTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubdomainResult | null>(null);
  const { toast } = useToast();

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Dominio requerido",
        description: "Introduce un dominio principal (ej: apple.com).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/subdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el escaneo");
      setResult(data);
      saveHistory({ tool: "subdomain", query: trimmed, results: data });
      toast({
        title: "Escaneo completado",
        description:
          data.count > 0
            ? `${data.count} subdominios encontrados para ${data.domain}.`
            : "No se encontraron subdominios.",
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
      title="Escáner de Subdominios y SSL"
      description="Introduce un dominio principal (ej. apple.com) para descubrir todos los subdominios registrados a través de los registros de transparencia de certificados (Certificate Transparency Logs vía crt.sh). Útil para encontrar portales ocultos, entornos de desarrollo o paneles de administración."
      icon={<Network className="h-6 w-6" />}
    >
      <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="ej: apple.com"
          className="font-mono"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Escaneando..." : "Escanear"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando los registros de transparencia de certificados en crt.sh...
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            crt.sh puede tardar 10-20 segundos en responder. La consulta recorre
            millones de certificados TLS emitidos públicamente.
          </p>
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="text-sm font-medium font-mono">
                  {result.domain}
                </span>
                <span className="text-xs text-muted-foreground">
                  {result.count > 0
                    ? `${result.count} subdominio${
                        result.count === 1 ? "" : "s"
                      } encontrado${result.count === 1 ? "" : "s"}`
                    : "Sin subdominios encontrados"}
                </span>
              </div>
            </div>
            {result.count > 0 && (
              <Badge variant="outline" className="font-mono">
                {result.count}
              </Badge>
            )}
          </Card>

          {/* Results */}
          {result.count > 0 ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Subdominios</h3>
              <div className="max-h-96 overflow-y-auto pr-1 flex flex-col gap-2">
                {result.subdomains.map((sd) => {
                  const first = formatDate(sd.firstSeen);
                  const last = formatDate(sd.lastSeen);
                  return (
                    <div
                      key={sd.name}
                      className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <a
                        href={`https://${sd.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm hover:underline inline-flex items-center gap-1.5 break-all"
                      >
                        {sd.name}
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {first && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono gap-1"
                          >
                            <Calendar className="h-3 w-3" />
                            {first}
                          </Badge>
                        )}
                        {last && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono gap-1"
                          >
                            <CalendarClock className="h-3 w-3" />
                            {last}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono gap-1"
                        >
                          <BadgeCheck className="h-3 w-3" />
                          {sd.certCount} cert{sd.certCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Fuente:{" "}
                <a
                  href={`https://crt.sh/?q=${encodeURIComponent(
                    "%." + result.domain
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  crt.sh
                </a>{" "}
                · Las fechas corresponden a la validez del certificado
                (not_before / not_after), no necesariamente a la creación del
                subdominio.
              </p>
            </Card>
          ) : (
            <Card className="p-6 flex flex-col items-center gap-2 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Sin resultados</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                crt.sh no devolvió certificados para este dominio. Puede que el
                dominio no exista, que no tenga certificados TLS emitidos
                públicamente o que crt.sh esté temporalmente saturado.
              </p>
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
