"use client";

import { useState, useEffect, useCallback } from "react";
import { History, Loader2, Download, Trash2, FileJson, FileSpreadsheet, RefreshCw } from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface HistoryItem {
  id: string;
  tool: string;
  toolLabel: string;
  query: string;
  results: string;
  createdAt: string;
}

export function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [detail, setDetail] = useState<HistoryItem | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?tool=${filter}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cargar el historial.",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al borrar");
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Investigación eliminada" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar." });
    }
  }

  async function handleClearAll() {
    if (!confirm("¿Seguro que quieres borrar TODO el historial? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      const res = await fetch(`/api/history`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al borrar");
      setItems([]);
      toast({ title: "Historial borrado" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo borrar." });
    }
  }

  function handleExport(format: "json" | "csv") {
    const url = `/api/history/export?format=${format}&tool=${filter}`;
    window.open(url, "_blank");
    toast({
      title: `Exportando como ${format.toUpperCase()}`,
      description: "La descarga comenzará en una nueva pestaña.",
    });
  }

  return (
    <ToolShell
      title="Historial y Exportación"
      description="Todas las búsquedas que realizas se guardan localmente en la base de datos de la aplicación. Aquí puedes revisarlas, filtrarlas, eliminarlas y exportarlas en formato JSON o CSV."
      icon={<History className="h-6 w-6" />}
    >
      <Card className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas las herramientas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las herramientas</SelectItem>
              <SelectItem value="user">Búsqueda de Usuario</SelectItem>
              <SelectItem value="email">Análisis de Email</SelectItem>
              <SelectItem value="ipdomain">IP y Dominio</SelectItem>
              <SelectItem value="phone">Teléfono</SelectItem>
              <SelectItem value="exif">Metadatos EXIF</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={items.length === 0}
          >
            <FileJson className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={items.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={items.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Borrar todo
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando historial...
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <History className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Sin investigaciones guardadas</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Realiza tu primera búsqueda en cualquiera de las herramientas y
            aparecerá aquí automáticamente.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setDetail(item)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-xs font-mono uppercase">
                  {item.tool.slice(0, 2)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {item.toolLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("es-ES")}
                    </span>
                  </div>
                  <span className="text-sm font-medium truncate font-mono mt-0.5">
                    {item.query}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetail(item);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{detail?.toolLabel}</Badge>
              <span className="font-mono text-sm">{detail?.query}</span>
            </DialogTitle>
            <DialogDescription>
              {detail ? new Date(detail.createdAt).toLocaleString("es-ES") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto rounded-md border border-border bg-muted/20 p-3 max-h-[60vh]">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {detail ? JSON.stringify(safeParse(detail.results), null, 2) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </ToolShell>
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
