"use client";

import { useState } from "react";
import {
  Cpu,
  Loader2,
  Search,
  AlertCircle,
  FileText,
  Layers,
  ExternalLink,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface Technology {
  category: string;
  name: string;
  version?: string;
  evidence: string;
}

interface TechStackResult {
  url: string;
  finalUrl: string;
  technologies: Technology[];
  title?: string;
  notes: string[];
}

const CATEGORY_ORDER = [
  "Servidor web",
  "Lenguaje / Runtime",
  "CMS",
  "Framework JS",
  "UI / CSS",
  "Analítica",
  "CDN / Hosting",
  "E-commerce",
  "Base de datos / Caché",
];

export function TechStackTool() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TechStackResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "URL requerida",
        description: "Pega una URL para analizar.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/techstack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as TechStackResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "techstack", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: `${data.technologies.length} tecnología(s) detectada(s).`,
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

  // Group technologies by category preserving the canonical order.
  const grouped: { category: string; items: Technology[] }[] = [];
  if (result) {
    const map = new Map<string, Technology[]>();
    for (const t of result.technologies) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    // First the known categories in order, then any extras alphabetically.
    const extras = Array.from(map.keys()).filter(
      (c) => !CATEGORY_ORDER.includes(c)
    );
    extras.sort();
    const ordered = [...CATEGORY_ORDER.filter((c) => map.has(c)), ...extras];
    for (const cat of ordered) {
      const items = map.get(cat);
      if (items && items.length > 0) grouped.push({ category: cat, items });
    }
  }

  return (
    <ToolShell
      title="Analizador de Tecnologías Web"
      description="Introduce una URL y OsintFlow escanea la página para detectar el servidor web, CMS, frameworks frontend, proveedor de hosting, analíticas y plugins que utiliza."
      icon={<Cpu className="h-6 w-6" />}
    >
      <form
        onSubmit={handleAnalyze}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ej: https://example.com"
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
          Descargando la página y detectando tecnologías...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Title + final URL */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Página analizada</h3>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-sm font-mono break-all">
                  {result.finalUrl || result.url}
                </span>
                {result.finalUrl && (
                  <a
                    href={result.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline hover:text-foreground shrink-0"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {result.title && (
                <span className="text-xs text-muted-foreground break-all">
                  Título: {result.title}
                </span>
              )}
              <span className="text-xs text-muted-foreground mt-1">
                {result.technologies.length} tecnología(s) detectada(s)
              </span>
            </div>
          </Card>

          {/* Technologies grouped by category */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Tecnologías detectadas</h3>
            </div>
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No se detectaron tecnologías concretas en esta página.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {grouped.map((g) => (
                  <div key={g.category} className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.category}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((t, i) => (
                        <Badge
                          key={`${t.name}-${i}`}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                          title={t.evidence}
                        >
                          <span className="font-medium">{t.name}</span>
                          {t.version && (
                            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                              {t.version}
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {grouped.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-4">
                Pasa el ratón sobre cada tecnología para ver la evidencia
                utilizada en la detección.
              </p>
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
