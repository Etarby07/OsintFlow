"use client";

import { useState } from "react";
import {
  FolderSearch,
  Loader2,
  Search,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
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

interface FoundItem {
  path: string;
  status: number;
  location?: string;
}

interface DirBusterResult {
  url: string;
  scanned: number;
  found: FoundItem[];
  notes: string[];
}

function statusBadge(status: number): {
  label: string;
  className: string;
} {
  if (status === 200)
    return {
      label: "Existente",
      className: "border-foreground/40 text-foreground",
    };
  if (status === 401 || status === 403)
    return {
      label: "Protegido",
      className: "border-destructive text-destructive",
    };
  if (status >= 300 && status < 400)
    return {
      label: "Redirección",
      className: "border-border text-muted-foreground",
    };
  return {
    label: String(status),
    className: "border-border text-muted-foreground",
  };
}

export function DirBusterTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DirBusterResult | null>(null);
  const { toast } = useToast();

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "URL requerida",
        description: "Introduce una URL (ej: https://tudominio.com).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/dirbuster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el escaneo");
      setResult(data as DirBusterResult);
      saveHistory({ tool: "dirbuster", query: trimmed, results: data });
      toast({
        title: "Escaneo completado",
        description: `${(data as DirBusterResult).found.length} rutas encontradas de ${
          (data as DirBusterResult).scanned
        } sondeadas.`,
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
      title="Buscador de Directorios Expuestos"
      description="Introduce una URL y OsintFlow escanea rutas comunes (/admin/, /.git/, /backup.zip, /robots.txt...) para encontrar paneles de administración, copias de seguridad o archivos de configuración expuestos públicamente."
      icon={<FolderSearch className="h-6 w-6" />}
    >
      {/* Prominent ethical disclaimer FIRST */}
      <Card className="p-4 border-destructive/40 bg-muted/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Aviso legal</span>
            <span className="text-xs text-muted-foreground">
              Solo escanea sitios de tu propiedad o para los que tienes
              autorización explícita. Escanear sitios sin permiso puede ser
              ilegal.
            </span>
          </div>
        </div>
      </Card>

      <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tudominio.com"
          className="font-mono"
          autoComplete="off"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Escaneando..." : "Escanear"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sondeando rutas comunes...</span>
          </div>
          <span className="text-xs">
            Escaneando ~70 rutas comunes; esto puede tardar hasta 90 segundos.
          </span>
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <FolderSearch className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium font-mono break-all">
                    {result.url}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.scanned} rutas sondeadas
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> {result.found.length}{" "}
                encontradas
              </Badge>
            </div>
          </Card>

          {/* Found table */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Rutas encontradas</h3>
            {result.found.length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Ruta</TableHead>
                      <TableHead className="w-1/4">Estado</TableHead>
                      <TableHead className="w-1/6 text-right">Abrir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.found.map((f) => {
                      const meta = statusBadge(f.status);
                      return (
                        <TableRow key={f.path}>
                          <TableCell className="font-mono text-xs break-all">
                            {f.path}
                            {f.location && (
                              <span className="block text-[10px] text-muted-foreground mt-1 font-mono break-all">
                                → {f.location}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>
                              {meta.label} ({f.status})
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href={`${result.url}${f.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs underline hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Abrir
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se encontraron rutas interesantes. Todas respondieron 404 o
                no se pudieron alcanzar.
              </p>
            )}
          </Card>

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5" />
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
