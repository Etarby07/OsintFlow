"use client";

import { useState } from "react";
import {
  PlaneTakeoff,
  Loader2,
  Search,
  Plane,
  Anchor,
  MapPin,
  ExternalLink,
  AlertCircle,
  Radar,
  Network,
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
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface FlightInfo {
  callsign: string;
  originCountry?: string;
  longitude?: number;
  latitude?: number;
  baroAltitude?: number;
  onGround: boolean;
  velocity?: number;
  trueTrack?: number;
  verticalRate?: number;
}

interface ShipInfo {
  mmsi: string;
  links: { label: string; url: string }[];
}

interface TrackingResult {
  query: string;
  type: "flight" | "ship" | "unknown";
  flight?: FlightInfo;
  ship?: ShipInfo;
  notes: string[];
}

function fmtSpeed(mps?: number): string {
  if (mps == null) return "—";
  const kmh = mps * 3.6;
  return `${kmh.toFixed(0)} km/h (${mps.toFixed(0)} m/s)`;
}

function fmtAltitude(m?: number): string {
  if (m == null) return "—";
  return `${m.toFixed(0)} m`;
}

function fmtHeading(deg?: number): string {
  if (deg == null) return "—";
  return `${deg.toFixed(0)}°`;
}

function fmtVertical(mps?: number): string {
  if (mps == null) return "—";
  return `${mps.toFixed(1)} m/s`;
}

export function TrackingTool() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Consulta requerida",
        description: "Introduce un callsign (IBB123) o un MMSI (9 dígitos).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await res.json()) as TrackingResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Error en el rastreo");
      setResult(data);
      saveHistory({ tool: "tracking", query: trimmed, results: data });
      toast({
        title: "Consulta completada",
        description:
          data.type === "flight"
            ? data.flight
              ? "Vuelo localizado en OpenSky."
              : "El vuelo no está disponible ahora mismo."
            : data.type === "ship"
            ? "Enlaces generados para el MMSI."
            : "Formato no reconocido.",
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

  const hasCoords =
    result?.flight?.latitude != null && result?.flight?.longitude != null;

  return (
    <ToolShell
      title="Rastreador de Vuelos y Barcos"
      description="Introduce el código de un vuelo (ej. IBB123) o el MMSI de un barco para ver su ubicación, ruta, velocidad y altitud en tiempo real (vía OpenSky Network para aviones)."
      icon={<PlaneTakeoff className="h-6 w-6" />}
    >
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ej: IBB123  o  228025800 (MMSI)"
          className="font-mono"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Rastreando..." : "Rastrear"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando OpenSky Network / preparando enlaces AIS...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {result.type === "flight" && result.flight && hasCoords && (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Plane className="h-5 w-5" />
                  <h3 className="text-sm font-semibold">Ubicación actual</h3>
                  <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                    {result.flight.onGround ? "En tierra" : "En vuelo"}
                  </Badge>
                </div>
                <MapView
                  lat={result.flight.latitude as number}
                  lon={result.flight.longitude as number}
                  label={`${result.flight.callsign}${
                    result.flight.originCountry
                      ? ` · ${result.flight.originCountry}`
                      : ""
                  }`}
                />
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Plane className="h-5 w-5" />
                  <h3 className="text-sm font-semibold">Detalles del vuelo</h3>
                </div>
                <Table>
                  <TableBody>
                    <DetailRow
                      label="Callsign"
                      value={result.flight.callsign}
                      mono
                    />
                    <DetailRow
                      label="País de origen"
                      value={result.flight.originCountry}
                    />
                    <DetailRow
                      label="Coordenadas"
                      value={`${result.flight.latitude?.toFixed(4)}, ${result.flight.longitude?.toFixed(4)}`}
                      mono
                    />
                    <DetailRow
                      label="En tierra"
                      value={result.flight.onGround ? "Sí" : "No"}
                    />
                    <DetailRow
                      label="Altitud barométrica"
                      value={fmtAltitude(result.flight.baroAltitude)}
                      icon={<Plane className="h-3 w-3" />}
                    />
                    <DetailRow
                      label="Velocidad"
                      value={fmtSpeed(result.flight.velocity)}
                      icon={<Radar className="h-3 w-3" />}
                    />
                    <DetailRow
                      label="Rumbo"
                      value={fmtHeading(result.flight.trueTrack)}
                      icon={<MapPin className="h-3 w-3" />}
                    />
                    <DetailRow
                      label="Razón vertical"
                      value={fmtVertical(result.flight.verticalRate)}
                      icon={<Network className="h-3 w-3" />}
                    />
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Datos en tiempo real de OpenSky Network. La posición puede
                  tener varios segundos de retraso.
                </p>
              </Card>
            </>
          )}

          {result.type === "flight" && result.flight && !hasCoords && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Plane className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Detalles del vuelo</h3>
              </div>
              <Table>
                <TableBody>
                  <DetailRow
                    label="Callsign"
                    value={result.flight.callsign}
                    mono
                  />
                  <DetailRow
                    label="País de origen"
                    value={result.flight.originCountry}
                  />
                  <DetailRow
                    label="En tierra"
                    value={result.flight.onGround ? "Sí" : "No"}
                  />
                </TableBody>
              </Table>
            </Card>
          )}

          {result.type === "flight" && !result.flight && (
            <Card className="p-6 flex flex-col items-center gap-2 text-center">
              <Plane className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                El vuelo no está en el aire ahora mismo
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                El vuelo {result.query} no aparece en OpenSky. Puede haber
                aterrizado, no estar transmitiendo o OpenSky estar saturado.
              </p>
            </Card>
          )}

          {result.type === "ship" && result.ship && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Anchor className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Barco (MMSI)</h3>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {result.ship.mmsi}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                No hay una API pública libre para AIS en tiempo real. Usa los
                siguientes enlaces para ver la posición actual del barco:
              </p>
              <div className="flex flex-wrap gap-2">
                {result.ship.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </Button>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {result.type === "unknown" && (
            <Card className="p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Formato no reconocido</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Introduce un callsign de vuelo (2-3 letras + 1-4 dígitos, ej.
                IBB123) o un MMSI de 9 dígitos.
              </p>
            </Card>
          )}

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
  icon,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground w-1/3">
        {label}
      </TableCell>
      <TableCell className={mono ? "font-mono text-xs" : "text-sm"}>
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            {icon}
            {value}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
