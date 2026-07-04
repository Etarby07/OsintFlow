"use client";

import { useState } from "react";
import {
  UserCheck,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Globe,
  Fingerprint,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface MatchResult {
  caption: string;
  schema: string;
  countries: string[];
  topics: string[];
  datasets: string[];
  summary: string;
  url: string;
}

interface SearchLink {
  label: string;
  url: string;
}

interface PepResult {
  name: string;
  country: string;
  matches: MatchResult[];
  searchLinks: SearchLink[];
  notes: string[];
}

export function PepCheckTool() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PepResult | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
        description: "Introduce un nombre completo.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/pep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          country: country.trim(),
        }),
      });
      const data = (await res.json()) as PepResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResult(data);
      saveHistory({
        tool: "pep",
        query: `${trimmed}${country.trim() ? ` (${country.trim()})` : ""}`,
        results: data,
      });
      toast({
        title: "Búsqueda completada",
        description:
          data.matches.length > 0
            ? `${data.matches.length} coincidencia${
                data.matches.length === 1 ? "" : "s"
              } potencial${
                data.matches.length === 1 ? "" : "es"
              }`
            : "Sin coincidencias en listas de sanciones/PEP.",
        variant: data.matches.length > 0 ? "destructive" : "default",
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
      title="Buscador de Personas (PEP y Sanciones)"
      description="Introduce un nombre completo (y opcionalmente un país) para buscar en listas públicas de Personas Expuestas Políticamente (PEP), sanciones internacionales y bases de datos de due diligence (vía OpenSanctions)."
      icon={<UserCheck className="h-6 w-6" />}
    >
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo: ej. Juan Pérez"
          className="font-mono"
          autoComplete="off"
        />
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="País (opcional): ES"
          className="sm:w-44 font-mono"
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
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando OpenSanctions y construyendo dorks...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card
            className={`p-5 flex items-center gap-4 ${
              result.matches.length > 0
                ? "border-foreground/40 bg-foreground/5"
                : ""
            }`}
          >
            {result.matches.length > 0 ? (
              <ShieldAlert className="h-8 w-8 shrink-0" />
            ) : (
              <ShieldCheck className="h-8 w-8 shrink-0 text-foreground" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold">{result.name}</span>
              <span className="text-sm text-muted-foreground">
                {result.matches.length > 0
                  ? `${result.matches.length} coincidencia${
                      result.matches.length === 1 ? "" : "s"
                    } potencial${
                      result.matches.length === 1 ? "" : "es"
                    } en listas de sanciones / PEP`
                  : "Sin coincidencias en listas de sanciones/PEP."}
              </span>
            </div>
            <Badge
              variant="outline"
              className="ml-auto shrink-0 font-mono text-[10px] uppercase"
            >
              OpenSanctions
            </Badge>
          </Card>

          {/* Match cards */}
          {result.matches.length > 0 && (
            <div className="flex flex-col gap-3">
              {result.matches.map((m, i) => (
                <Card key={`${m.url}-${i}`} className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h3 className="text-sm font-semibold break-words">
                            {m.caption}
                          </h3>
                          {m.schema && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono"
                            >
                              {m.schema}
                            </Badge>
                          )}
                        </div>
                        {m.datasets.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {m.datasets.slice(0, 4).join(", ")}
                              {m.datasets.length > 4
                                ? ` +${m.datasets.length - 4}`
                                : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline hover:text-foreground shrink-0"
                      >
                        Abrir ficha <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {(m.countries.length > 0 || m.topics.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.countries.map((c) => (
                          <Badge
                            key={`c-${c}`}
                            variant="secondary"
                            className="text-[10px] font-mono"
                          >
                            {c}
                          </Badge>
                        ))}
                        {m.topics.map((t) => (
                          <Badge
                            key={`t-${t}`}
                            variant="outline"
                            className="text-[10px] font-mono"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {m.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {m.summary}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Additional searches */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Búsquedas adicionales</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Estos enlaces abren búsquedas en Google (dorks) y en la web de
              OpenSanctions para que verifiques manualmente.
            </p>
            <div className="flex flex-wrap gap-2">
              {result.searchLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono hover:bg-muted transition-colors"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
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
                <li>
                  Resultado orientativo, no constituye asesoramiento legal ni
                  una verificación oficial de identidad. Cualquier decisión de
                  compliance debe contrastar fuentes adicionales.
                </li>
              </ul>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}
