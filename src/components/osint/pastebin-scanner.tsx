"use client";

import { useState } from "react";
import {
  FileSearch,
  Loader2,
  Search,
  ExternalLink,
  Info,
  Code,
  AlertCircle,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface SearchLink {
  site: string;
  dork: string;
  url: string;
}

interface GithubItem {
  repo: string;
  name: string;
  html_url: string;
  score?: number;
}

interface PastebinResult {
  term: string;
  searchLinks: SearchLink[];
  githubResults: GithubItem[];
  notes: string[];
}

export function PastebinScannerTool() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PastebinResult | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Término requerido",
        description: "Introduce un email, dominio o término.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/pastebin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResult(data);
      saveHistory({ tool: "pastebin", query: trimmed, results: data });
      toast({
        title: "Búsqueda completada",
        description: `${data.searchLinks.length} enlaces + ${data.githubResults.length} resultado(s) GitHub.`,
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
      title="Escáner de Fugas en Pastebin y Gists"
      description="Introduce un email, dominio o término para buscar si ha sido publicado en repositorios de texto públicos (Pastebin, GitHub Gists, etc.) donde podrían filtrarse credenciales o datos internos."
      icon={<FileSearch className="h-6 w-6" />}
    >
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ej: alguien@empresa.com  o  empresa.com"
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
          Generando enlaces de dorks y consultando GitHub code search...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSearch className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="text-sm font-medium font-mono">
                  {result.term}
                </span>
                <span className="text-xs text-muted-foreground">
                  {result.searchLinks.length} enlaces de búsqueda ·{" "}
                  {result.githubResults.length} resultados en GitHub
                </span>
              </div>
            </div>
          </Card>

          {/* Search links */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Enlaces de búsqueda</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Cada botón abre una búsqueda de Google con el operador{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">
                site:
              </code>{" "}
              aplicado al sitio correspondiente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.searchLinks.map((link) => (
                <div
                  key={link.site}
                  className="border border-border rounded-md p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{link.site}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Google dork
                    </Badge>
                  </div>
                  <code className="font-mono text-[11px] text-muted-foreground break-all">
                    {link.dork}
                  </code>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-fit"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Abrir en Google
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* GitHub results */}
          {result.githubResults.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Code className="h-4 w-4" />
                <h3 className="text-sm font-semibold">
                  Resultados de GitHub
                </h3>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {result.githubResults.length} encontrado
                  {result.githubResults.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
                {result.githubResults.map((item, i) => (
                  <div
                    key={`${item.html_url}-${i}`}
                    className="border border-border rounded-md p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs truncate">
                        {item.repo}
                      </span>
                      {typeof item.score === "number" && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          score {item.score.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    {item.name && (
                      <span className="text-xs text-muted-foreground">
                        {item.name}
                      </span>
                    )}
                    {item.html_url && (
                      <a
                        href={item.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline hover:text-foreground mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Ethical notice */}
          <Card className="p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Si encuentras credenciales filtradas en un paste, notifícalo al
              propietario de forma responsable. No uses datos encontrados para
              acceder a cuentas ajenas: eso es un delito.
            </p>
          </Card>

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
