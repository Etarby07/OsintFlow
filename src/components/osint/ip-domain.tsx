"use client";

import { useState } from "react";
import { Globe, Loader2, Search, MapPin, Server, Cloud, Shield } from "lucide-react";
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

interface IpDomainResult {
  input: string;
  type: "ip" | "domain";
  ip?: string;
  domain?: string;
  dns?: {
    A: string[];
    MX: string[];
    TXT: string[];
    NS: string[];
  };
  whois?: {
    registrar?: string;
    createdDate?: string;
    updatedDate?: string;
    expiryDate?: string;
    nameServers?: string[];
    status?: string[];
    raw?: Record<string, unknown>;
  };
  geo?: {
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    lat?: number;
    lon?: number;
    isp?: string;
    org?: string;
    as?: string;
    timezone?: string;
  };
  waf?: {
    cloudflare: boolean;
    detectedWaf?: string;
    serverHeader?: string;
    securityHeaders?: string[];
  };
  notes: string[];
}

export function IpDomainTool() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IpDomainResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Entrada requerida",
        description: "Introduce una IP o un dominio.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/ipdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "ipdomain", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: `Resultado para ${data.type === "ip" ? "IP" : "dominio"}: ${trimmed}`,
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
      title="Reconocimiento de IP y Dominio"
      description="Introduce una dirección IP o un nombre de dominio para obtener registros DNS (A, MX, TXT, NS), información WHOIS/RDAP, geolocalización aproximada de la IP y detección de Cloudflare u otros WAF."
      icon={<Globe className="h-6 w-6" />}
    >
      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ej: 8.8.8.8  o  example.com"
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
          Consultando DNS, WHOIS/RDAP y geolocalización...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="text-sm font-medium font-mono">
                  {result.input}
                </span>
                <span className="text-xs text-muted-foreground">
                  Tipo: {result.type === "ip" ? "Dirección IP" : "Dominio"}
                </span>
              </div>
            </div>
            {result.waf?.cloudflare && (
              <Badge className="gap-1">
                <Cloud className="h-3 w-3" /> Cloudflare
              </Badge>
            )}
          </Card>

          {/* Geolocation */}
          {result.geo && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Geolocalización</h3>
              </div>
              <Table>
                <TableBody>
                  {result.geo.country && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground w-1/3">
                        País
                      </TableCell>
                      <TableCell>
                        {result.geo.country}{" "}
                        {result.geo.countryCode && `(${result.geo.countryCode})`}
                      </TableCell>
                    </TableRow>
                  )}
                  {result.geo.region && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Región
                      </TableCell>
                      <TableCell>{result.geo.region}</TableCell>
                    </TableRow>
                  )}
                  {result.geo.city && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Ciudad
                      </TableCell>
                      <TableCell>{result.geo.city}</TableCell>
                    </TableRow>
                  )}
                  {result.geo.lat != null && result.geo.lon != null && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Coordenadas
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {result.geo.lat}, {result.geo.lon}{" "}
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${result.geo.lat}&mlon=${result.geo.lon}#map=12/${result.geo.lat}/${result.geo.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline ml-2 hover:text-foreground"
                        >
                          Ver mapa →
                        </a>
                      </TableCell>
                    </TableRow>
                  )}
                  {result.geo.isp && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        ISP
                      </TableCell>
                      <TableCell>{result.geo.isp}</TableCell>
                    </TableRow>
                  )}
                  {result.geo.org && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Organización
                      </TableCell>
                      <TableCell>{result.geo.org}</TableCell>
                    </TableRow>
                  )}
                  {result.geo.as && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        AS
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {result.geo.as}
                      </TableCell>
                    </TableRow>
                  )}
                  {result.geo.timezone && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Zona horaria
                      </TableCell>
                      <TableCell>{result.geo.timezone}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* DNS */}
          {result.dns && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Registros DNS</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Tipo</TableHead>
                    <TableHead>Valores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <DnsRow type="A" values={result.dns.A} />
                  <DnsRow type="MX" values={result.dns.MX} />
                  <DnsRow type="TXT" values={result.dns.TXT} />
                  <DnsRow type="NS" values={result.dns.NS} />
                </TableBody>
              </Table>
            </Card>
          )}

          {/* WHOIS */}
          {result.whois && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5" />
                <h3 className="text-sm font-semibold">WHOIS / RDAP</h3>
              </div>
              <Table>
                <TableBody>
                  {result.whois.registrar && (
                    <WhoisRow label="Registrar" value={result.whois.registrar} />
                  )}
                  {result.whois.createdDate && (
                    <WhoisRow
                      label="Fecha de creación"
                      value={result.whois.createdDate}
                    />
                  )}
                  {result.whois.updatedDate && (
                    <WhoisRow
                      label="Última actualización"
                      value={result.whois.updatedDate}
                    />
                  )}
                  {result.whois.expiryDate && (
                    <WhoisRow
                      label="Fecha de expiración"
                      value={result.whois.expiryDate}
                    />
                  )}
                  {result.whois.nameServers && result.whois.nameServers.length > 0 && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground w-1/3">
                        Name servers
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {result.whois.nameServers.map((ns) => (
                            <span key={ns} className="font-mono text-xs">
                              {ns}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {result.whois.status && result.whois.status.length > 0 && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Estado
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {result.whois.status.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* WAF */}
          {result.waf && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Detección de WAF</h3>
              </div>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground w-1/3">
                      Cloudflare
                    </TableCell>
                    <TableCell>
                      {result.waf.cloudflare ? (
                        <Badge>Sí detectado</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No detectado
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  {result.waf.detectedWaf && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        WAF detectado
                      </TableCell>
                      <TableCell>{result.waf.detectedWaf}</TableCell>
                    </TableRow>
                  )}
                  {result.waf.serverHeader && (
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Cabecera Server
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {result.waf.serverHeader}
                      </TableCell>
                    </TableRow>
                  )}
                  {result.waf.securityHeaders &&
                    result.waf.securityHeaders.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Cabeceras de seguridad
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {result.waf.securityHeaders.map((h) => (
                              <span key={h} className="font-mono text-xs">
                                {h}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
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

function DnsRow({ type, values }: { type: string; values: string[] }) {
  return (
    <TableRow>
      <TableCell className="font-medium font-mono">{type}</TableCell>
      <TableCell>
        {values.length > 0 ? (
          <div className="flex flex-col gap-1">
            {values.map((v) => (
              <span key={v} className="font-mono text-xs break-all">
                {v}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function WhoisRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground w-1/3">
        {label}
      </TableCell>
      <TableCell className="text-xs">{value}</TableCell>
    </TableRow>
  );
}
