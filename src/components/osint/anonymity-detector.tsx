"use client";

import { useState } from "react";
import {
  EyeOff,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  Ghost,
  Globe,
  Server,
  Check,
  ExternalLink,
  AlertTriangle,
  MapPin,
  Info,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { MapView } from "@/components/osint/map-view";
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

interface AnonymityResult {
  ip: string;
  isHosting: boolean;
  isTor: boolean;
  isVpn: boolean;
  vpnProvider?: string;
  isProxy: boolean;
  isp: string;
  org: string;
  as: string;
  country: string;
  city: string;
  lat?: number;
  lon?: number;
  abuseScore?: number;
  riskScore: number;
  notes: string[];
}

function riskLabel(score: number): { label: string; tone: string } {
  if (score >= 75) return { label: "Muy alto", tone: "Alto riesgo de anonimato" };
  if (score >= 50) return { label: "Alto", tone: "Probable uso de anonimato" };
  if (score >= 25) return { label: "Medio", tone: "Señales moderadas" };
  if (score > 0) return { label: "Bajo", tone: "Señal menor detectada" };
  return { label: "Nulo", tone: "Sin señales de anonimato" };
}

export function AnonymityTool() {
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnonymityResult | null>(null);
  const { toast } = useToast();

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ip.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "IP requerida",
        description: "Introduce una dirección IPv4.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/anonymity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la detección");
      setResult(data);
      saveHistory({ tool: "anonymity", query: trimmed, results: data });
      toast({
        title: "Detección completada",
        description: `Risk score: ${data.riskScore}/100`,
        variant:
          data.isTor || data.isVpn || data.isProxy || data.isHosting
            ? "destructive"
            : "default",
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

  const hasAnon =
    result && (result.isTor || result.isVpn || result.isProxy || result.isHosting);

  return (
    <ToolShell
      title="Detector de Anonimato"
      description="Introduce una IP y OsintFlow consulta inteligencia de amenazas para determinar si pertenece a una VPN comercial, un proxy público, un nodo de salida de Tor o un proveedor de hosting en la nube."
      icon={<EyeOff className="h-6 w-6" />}
    >
      <form onSubmit={handleCheck} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="ej: 8.8.8.8"
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
          {loading ? "Analizando..." : "Analizar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando ip-api.com, lista de nodos Tor y AbuseIPDB (si está
          configurado)...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Veredicto */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              {hasAnon ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-foreground" />
              )}
              <h3 className="text-sm font-semibold">Veredicto</h3>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {result.ip}
              </span>
            </div>
            {hasAnon ? (
              <div className="flex flex-wrap gap-2">
                {result.isTor && (
                  <Badge className="gap-1 bg-foreground text-background">
                    <Ghost className="h-3 w-3" /> Tor
                  </Badge>
                )}
                {result.isVpn && (
                  <Badge className="gap-1 bg-foreground text-background">
                    <ShieldAlert className="h-3 w-3" /> VPN
                    {result.vpnProvider && (
                      <span className="ml-1 opacity-80">
                        ({result.vpnProvider})
                      </span>
                    )}
                  </Badge>
                )}
                {result.isHosting && (
                  <Badge variant="outline" className="gap-1">
                    <Server className="h-3 w-3" /> Hosting / Datacenter
                  </Badge>
                )}
                {result.isProxy && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" /> Proxy
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-foreground" />
                IP residencial (sin anonimato detectado)
              </div>
            )}
          </Card>

          {/* Risk score */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Puntuación de riesgo</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {result.riskScore}
                <span className="text-base text-muted-foreground">/100</span>
              </span>
              <div className="flex flex-col">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase w-fit"
                >
                  {riskLabel(result.riskScore).label}
                </Badge>
                <span className="text-xs text-muted-foreground mt-1">
                  {riskLabel(result.riskScore).tone}
                </span>
              </div>
              {typeof result.abuseScore === "number" && (
                <div className="ml-auto flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">
                    AbuseIPDB
                  </span>
                  <span className="font-mono text-sm">
                    {result.abuseScore}/100
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Cálculo: hosting +20, VPN +30, proxy +25, Tor +50 y la puntuación
              de abuso de AbuseIPDB contribuye hasta +40 (si está configurada).
            </p>
          </Card>

          {/* Details table */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Detalles de la IP</h3>
            </div>
            <Table>
              <TableBody>
                <DetailRow label="ISP" value={result.isp} />
                <DetailRow label="Organización" value={result.org} />
                <DetailRow label="AS" value={result.as} mono />
                <DetailRow label="País" value={result.country} />
                <DetailRow label="Ciudad" value={result.city} />
              </TableBody>
            </Table>
          </Card>

          {/* Map */}
          {typeof result.lat === "number" &&
            typeof result.lon === "number" && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5" />
                  <h3 className="text-sm font-semibold">
                    Ubicación aproximada
                  </h3>
                </div>
                <MapView
                  lat={result.lat}
                  lon={result.lon}
                  label={`${result.city ? result.city + ", " : ""}${
                    result.country ?? result.ip
                  }`}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Ubicación del ISP/datacenter, no de un usuario. La precisión
                  varía según el proveedor.
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
                <li>
                  Sin clave de API la detección es heurística. Para más
                  inteligencia de amenazas consulta{" "}
                  <a
                    href="https://www.abuseipdb.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    AbuseIPDB
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
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
  value: string;
  mono?: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground w-1/3">
        {label}
      </TableCell>
      <TableCell className={mono ? "font-mono text-xs" : "text-xs"}>
        {value || <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}
