"use client";

import { useState } from "react";
import {
  History,
  Loader2,
  Search,
  Globe,
  Server,
  AlertCircle,
  ExternalLink,
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

interface CurrentWhois {
  registrar?: string;
  createdDate?: string;
  updatedDate?: string;
  expiryDate?: string;
  nameServers: string[];
  status: string[];
}

interface IpHistoryEntry {
  ip: string;
  date: string;
}

interface ReverseIpEntry {
  domain: string;
  lastResolved: string;
}

interface WhoisHistoryResult {
  domain: string;
  currentWhois: CurrentWhois | null;
  ipHistory: IpHistoryEntry[];
  reverseIp: ReverseIpEntry[];
  notes: string[];
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function WhoisHistoryTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhoisHistoryResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Dominio requerido",
        description: "Introduce un dominio (ej: example.com).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/whoishistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = (await res.json()) as WhoisHistoryResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Error en la consulta");
      setResult(data);
      saveHistory({ tool: "whoishistory", query: trimmed, results: data });
      toast({
        title: "Consulta completada",
        description: `Historial WHOIS/DNS para ${data.domain}`,
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
      title="Historial de WHOIS y DNS Inversa"
      description="Muestra el historial de un dominio: quién era el dueño anterior, qué IPs ha tenido a lo largo del tiempo y qué otros dominios comparten su IP actual (DNS inversa)."
      icon={<History className="h-6 w-6" />}
    >
      <form
        onSubmit={handleAnalyze}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="ej: example.com"
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
          {loading ? "Consultando..." : "Consultar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando RDAP, viewdns.info y DNS inversa...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* WHOIS actual */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-5 w-5" />
              <h3 className="text-sm font-semibold">WHOIS actual</h3>
              <span className="text-xs text-muted-foreground ml-auto font-mono">
                {result.domain}
              </span>
            </div>
            {result.currentWhois ? (
              <Table>
                <TableBody>
                  <WhoisRow
                    label="Registrar"
                    value={result.currentWhois.registrar}
                  />
                  <WhoisRow
                    label="Creación"
                    value={formatDate(result.currentWhois.createdDate)}
                  />
                  <WhoisRow
                    label="Actualización"
                    value={formatDate(result.currentWhois.updatedDate)}
                  />
                  <WhoisRow
                    label="Expiración"
                    value={formatDate(result.currentWhois.expiryDate)}
                  />
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground w-1/3">
                      Name servers
                    </TableCell>
                    <TableCell>
                      {result.currentWhois.nameServers.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {result.currentWhois.nameServers.map((ns) => (
                            <span
                              key={ns}
                              className="font-mono text-xs break-all"
                            >
                              {ns}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">
                      Estado
                    </TableCell>
                    <TableCell>
                      {result.currentWhois.status.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.currentWhois.status.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-xs text-muted-foreground">
                No se pudo obtener información WHOIS/RDAP para este dominio.
              </p>
            )}
          </Card>

          {/* IP history */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-5 w-5" />
              <h3 className="text-sm font-semibold">
                Historial de IPs
              </h3>
              {result.ipHistory.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] ml-auto">
                  {result.ipHistory.length}
                </Badge>
              )}
            </div>
            {result.ipHistory.length > 0 ? (
              <div className="max-h-72 overflow-y-auto pr-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-2/3">IP</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.ipHistory.map((entry, i) => (
                      <TableRow key={`${entry.ip}-${i}`}>
                        <TableCell className="font-mono text-xs break-all">
                          {entry.ip}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="inline-flex items-center gap-1">
                            <History className="h-3 w-3 text-muted-foreground" />
                            {entry.date || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center py-4">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground max-w-sm">
                  No hay historial de IPs disponible. viewdns.info puede estar
                  bloqueando la consulta.
                </p>
              </div>
            )}
          </Card>

          {/* Reverse IP */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-5 w-5" />
              <h3 className="text-sm font-semibold">
                Dominios en la misma IP
              </h3>
              {result.reverseIp.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] ml-auto">
                  {result.reverseIp.length}
                </Badge>
              )}
            </div>
            {result.reverseIp.length > 0 ? (
              <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-2">
                {result.reverseIp.map((entry, i) => (
                  <div
                    key={`${entry.domain}-${i}`}
                    className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <a
                      href={`https://${entry.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:underline inline-flex items-center gap-1.5 break-all"
                    >
                      {entry.domain}
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <History className="h-3 w-3" />
                      {entry.lastResolved || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center py-4">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground max-w-sm">
                  No se encontraron dominios compartiendo la IP actual. Puede
                  que viewdns.info esté bloqueando o que la IP no tenga otros
                  dominios.
                </p>
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

function WhoisRow({ label, value }: { label: string; value?: string }) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground w-1/3">
        {label}
      </TableCell>
      <TableCell className="text-xs">{value || "—"}</TableCell>
    </TableRow>
  );
}
