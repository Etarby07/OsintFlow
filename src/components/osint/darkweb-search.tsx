"use client";

import { useState } from "react";
import {
  Ghost,
  Loader2,
  Search,
  ExternalLink,
  Info,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface DarkResult {
  title: string;
  url: string;
  snippet?: string;
}

interface DarkWebResponse {
  query: string;
  results: DarkResult[];
  searchUrl: string;
  notes: string[];
}

export function DarkWebTool() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DarkWebResponse | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Consulta requerida",
        description: "Introduce un término, empresa o correo.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/darkweb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResult(data);
      saveHistory({ tool: "darkweb", query: trimmed, results: data });
      toast({
        title: "Búsqueda completada",
        description: data.results.length
          ? `${data.results.length} resultado${data.results.length === 1 ? "" : "s"} .onion.`
          : "Sin resultados .onion.",
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
      title="Buscador en la Dark Web"
      description="Busca si un término, empresa o correo aparece mencionado en la red Tor a través del motor Ahmia. Los enlaces .onión requieren el navegador Tor Browser para abrirse."
      icon={<Ghost className="h-6 w-6" />}
    >
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ej: empresa S.L.  o  admin@dominio.com"
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
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando el motor de búsqueda Ahmia...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Disclaimer */}
          <Card className="p-4 flex items-start gap-3 bg-muted/40">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="text-foreground font-medium text-sm mb-1">
                Aviso importante
              </p>
              Para abrir los enlaces <code className="font-mono bg-background px-1 py-0.5 rounded">.onion</code>{" "}
              necesitas el navegador{" "}
              <a
                href="https://www.torproject.org/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground inline-flex items-center gap-0.5"
              >
                Tor Browser
                <ExternalLink className="h-3 w-3" />
              </a>
              . No accedas a contenido ilegal. OsintFlow no aloja ni proxifica
              sitios .onion: solo muestra direcciones indexadas por Ahmia.
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ghost className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="text-sm font-medium font-mono">
                  {result.query}
                </span>
                <span className="text-xs text-muted-foreground">
                  {result.results.length} resultado
                  {result.results.length === 1 ? "" : "s"} .onion
                </span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a
                href={result.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Abrir búsqueda en Ahmia
              </a>
            </Button>
          </Card>

          {/* Results */}
          {result.results.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Resultados</h3>
              <div className="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
                {result.results.map((r, i) => (
                  <div
                    key={`${r.url}-${i}`}
                    className="border border-border rounded-md p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">
                        {r.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        .onion
                      </Badge>
                    </div>
                    <code className="font-mono text-[11px] text-muted-foreground break-all">
                      {r.url}
                    </code>
                    {r.snippet && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {r.snippet}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                      Necesitas Tor Browser para abrir este enlace.
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty state */}
          {result.results.length === 0 && (
            <Card className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                No se encontraron resultados .onion para esta consulta, o no se
                pudo acceder a Ahmia. Prueba la búsqueda directa en Ahmia.
              </span>
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
