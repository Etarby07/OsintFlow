"use client";

import { useState } from "react";
import {
  Wifi,
  Loader2,
  Search,
  MapPin,
  Globe,
  Calendar,
  ExternalLink,
  Info,
  KeyRound,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { MapView } from "@/components/osint/map-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface WifiResult {
  ssid: string;
  bssid: string;
  latitude: number;
  longitude: number;
  type?: string;
  firsttime?: string;
  lasttime?: string;
  country?: string;
}

interface WifiResponse {
  configured: boolean;
  query: string;
  type: "ssid" | "bssid";
  results: WifiResult[];
  manualSearchUrl: string;
  notes: string[];
}

export function WifiLocatorTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ssid" | "bssid">("ssid");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WifiResponse | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Consulta requerida",
        description:
          type === "ssid"
            ? "Introduce el nombre de la red (SSID)."
            : "Introduce la dirección MAC (BSSID).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/wifi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResult(data);
      saveHistory({ tool: "wifi", query: `${type}:${trimmed}`, results: data });
      toast({
        title: "Búsqueda completada",
        description: data.results.length
          ? `${data.results.length} red${data.results.length === 1 ? "" : "es"} encontrada${data.results.length === 1 ? "" : "s"}.`
          : "Sin resultados con coordenadas.",
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

  const firstWithCoords = result?.results.find(
    (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
  );

  return (
    <ToolShell
      title="Geolocalizador de Redes Wi-Fi"
      description="Introduce el nombre (SSID) o la dirección MAC (BSSID) de una red Wi-Fi para consultar su ubicación aproximada a través de WiGLE.net."
      icon={<Wifi className="h-6 w-6" />}
    >
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Select
          value={type}
          onValueChange={(v) => setType(v as "ssid" | "bssid")}
        >
          <SelectTrigger className="w-full sm:w-32 shrink-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ssid">SSID</SelectItem>
            <SelectItem value="bssid">BSSID</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            type === "ssid"
              ? "ej: MiRedWiFi"
              : "ej: AA:BB:CC:DD:EE:FF"
          }
          className="font-mono flex-1"
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
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando la base de datos de WiGLE.net...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Not configured banner */}
          {!result.configured && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <p className="text-foreground font-medium text-sm mb-1">
                    API de WiGLE no configurada
                  </p>
                  WiGLE requiere una cuenta gratuita y un par de credenciales
                  (API Name + API Token). Crea tu cuenta en{" "}
                  <a
                    href="https://wigle.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    wigle.net
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  , luego copia tus credenciales desde{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">
                    My Account → API Token
                  </code>{" "}
                  y configúralas como{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">
                    WIGLE_API_NAME
                  </code>{" "}
                  y{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">
                    WIGLE_API_KEY
                  </code>
                  .
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="w-fit"
              >
                <a
                  href={result.manualSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir búsqueda en WiGLE
                </a>
              </Button>
            </Card>
          )}

          {/* Summary */}
          {result.configured && (
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium font-mono">
                    {result.query}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Tipo: {result.type === "ssid" ? "SSID" : "BSSID"} ·{" "}
                    {result.results.length} resultado
                    {result.results.length === 1 ? "" : "s"} con coordenadas
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">
                WiGLE
              </Badge>
            </Card>
          )}

          {/* Map of first result */}
          {firstWithCoords && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5" />
                <h3 className="text-sm font-semibold">
                  Ubicación del primer resultado
                </h3>
              </div>
              <MapView
                lat={firstWithCoords.latitude}
                lon={firstWithCoords.longitude}
                label={`${firstWithCoords.ssid}${
                  firstWithCoords.bssid ? " (" + firstWithCoords.bssid + ")" : ""
                }`}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Coordenadas aproximadas (centroide de observaciones). La
                precisión real varía entre decenas y cientos de metros.
              </p>
            </Card>
          )}

          {/* List of results */}
          {result.configured && result.results.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Resultados</h3>
              <div className="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
                {result.results.map((r, i) => (
                  <div
                    key={`${r.bssid || r.ssid}-${i}`}
                    className="border border-border rounded-md p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium font-mono">
                        {r.ssid}
                      </span>
                      {r.type && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.type}
                        </Badge>
                      )}
                      {r.country && (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.country}
                        </Badge>
                      )}
                    </div>
                    {r.bssid && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.bssid}
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <MapPin className="h-3 w-3" />
                        {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                      </span>
                      {r.firsttime && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          primera: {r.firsttime.slice(0, 10)}
                        </span>
                      )}
                      {r.lasttime && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          última: {r.lasttime.slice(0, 10)}
                        </span>
                      )}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=14/${r.latitude}/${r.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline hover:text-foreground ml-auto"
                      >
                        <Globe className="h-3 w-3" /> OSM
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4" />
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
