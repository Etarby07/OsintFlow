"use client";

import { useState } from "react";
import { UserSearch, Loader2, ExternalLink, Search, CheckCircle2, XCircle } from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface ProfileResult {
  platform: string;
  url: string;
  exists: boolean;
  status: number;
}

export function UserSearchTool() {
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileResult[] | null>(null);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = alias.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Alias requerido",
        description: "Introduce un alias o nickname para buscar.",
      });
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/osint/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResults(data.profiles);
      saveHistory({ tool: "user", query: trimmed, results: data.profiles });
      toast({
        title: "Búsqueda completada",
        description: `Se analizaron ${data.profiles.length} plataformas. ${
          data.profiles.filter((p: ProfileResult) => p.exists).length
        } perfiles encontrados.`,
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

  const found = results?.filter((p) => p.exists) ?? [];
  const notFound = results?.filter((p) => !p.exists) ?? [];

  return (
    <ToolShell
      title="Búsqueda de Usuario"
      description="Introduce un alias y OsintFlow comprobará en decenas de redes sociales y foros públicos si existe un perfil con ese nombre, devolviendo enlaces directos."
      icon={<UserSearch className="h-6 w-6" />}
    >
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="ej: johndoe"
          className="font-mono"
          autoComplete="off"
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
          Comprobando plataformas públicas. Esto puede tardar unos segundos...
        </Card>
      )}

      {results && !loading && (
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <Card className="p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-foreground" />
              <span className="text-sm">
                <strong>{found.length}</strong> perfiles encontrados
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <span className="text-sm">{notFound.length} sin resultados</span>
            </div>
          </Card>

          {found.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Perfiles encontrados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {found.map((p) => (
                  <a
                    key={p.platform}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        {p.platform}
                      </span>
                      <span className="text-xs text-muted-foreground truncate font-mono">
                        {p.url}
                      </span>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 ml-2 text-muted-foreground group-hover:text-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {notFound.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sin resultados
              </h3>
              <div className="flex flex-wrap gap-2">
                {notFound.map((p) => (
                  <Badge
                    key={p.platform}
                    variant="outline"
                    className="text-muted-foreground"
                  >
                    {p.platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
