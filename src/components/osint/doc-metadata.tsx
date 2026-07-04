"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileText,
  Loader2,
  Upload,
  User,
  Laptop,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
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

interface DocMetadataResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  format: string;
  metadata: Record<string, string>;
  notes: string[];
}

const ACCEPTED_EXT = [".pdf", ".docx", ".xlsx", ".pptx"];
const MAX_SIZE = 15 * 1024 * 1024;

export function DocMetadataTool() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocMetadataResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      const name = (file.name || "").toLowerCase();
      const dotIdx = name.lastIndexOf(".");
      const ext = dotIdx >= 0 ? name.slice(dotIdx) : "";
      if (!ACCEPTED_EXT.includes(ext)) {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: "Formatos soportados: PDF, DOCX, XLSX, PPTX.",
        });
        return;
      }
      if (file.size > MAX_SIZE) {
        toast({
          variant: "destructive",
          title: "Archivo demasiado grande",
          description: "El tamaño máximo es 15 MB.",
        });
        return;
      }
      setLoading(true);
      setResult(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/osint/document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al extraer metadatos");
        setResult(data as DocMetadataResult);
        saveHistory({ tool: "document", query: file.name, results: data });
        toast({
          title: "Metadatos extraídos",
          description: `Se procesó ${file.name}.`,
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
    },
    [toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const metaEntries = result
    ? Object.entries(result.metadata)
        .map(([k, v]) => ({ key: k, value: String(v) }))
        .sort((a, b) => a.key.localeCompare(b.key))
    : [];

  const author =
    result?.metadata.Author ||
    result?.metadata.LastModifiedBy ||
    result?.metadata.Creator;
  const software =
    result?.metadata.Producer ||
    result?.metadata.Creator ||
    result?.metadata.Application ||
    result?.metadata.AppVersion;

  return (
    <ToolShell
      title="Metadatos de Documentos"
      description="Sube o arrastra un archivo PDF, Word (.docx), Excel (.xlsx) o PowerPoint (.pptx) para extraer sus metadatos ocultos: autor original, fechas de creación y modificación, software usado (ej. 'Adobe Illustrator 2023') y a veces rutas de archivos internas."
      icon={<FileText className="h-6 w-6" />}
    >
      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={`rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 text-center transition-colors ${
          dragOver
            ? "border-foreground bg-accent/30"
            : "border-border bg-muted/20"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            Arrastra un documento aquí o haz clic para seleccionar
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, XLSX, PPTX · máx. 15 MB · procesado localmente en el
            servidor
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.pptx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Seleccionar documento
        </Button>
      </div>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Extrayendo metadatos...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* File info */}
          <Card className="p-4 flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="text-sm font-medium truncate font-mono">
                {result.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {(result.fileSize / 1024).toFixed(1)} KB · {result.fileType}
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="gap-1">
                  <FileCheck className="h-3 w-3" /> {result.format}
                </Badge>
                {author && (
                  <Badge variant="outline" className="gap-1">
                    <User className="h-3 w-3" /> Autor
                  </Badge>
                )}
                {software && (
                  <Badge variant="outline" className="gap-1">
                    <Laptop className="h-3 w-3" /> Software
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Author & Software — most interesting for OSINT */}
          {(author || software) && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Datos destacados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {author && (
                  <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Autor / Creador
                    </span>
                    <span className="font-mono text-sm break-all">{author}</span>
                  </div>
                )}
                {software && (
                  <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Laptop className="h-3 w-3" /> Software
                    </span>
                    <span className="font-mono text-sm break-all">
                      {software}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                El autor y el software pueden revelar quién creó el documento y
                con qué herramienta. Muchos documentos conservan esta
                información incluso después de haber sido renombrados o
                reenviados.
              </p>
            </Card>
          )}

          {/* All metadata */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">
              Todos los metadatos ({metaEntries.length})
            </h3>
            {metaEntries.length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-2/5">Campo</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metaEntries.map((e) => (
                      <TableRow key={e.key}>
                        <TableCell className="font-mono text-xs font-medium align-top">
                          {e.key}
                        </TableCell>
                        <TableCell className="text-xs break-all font-mono">
                          {e.value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se encontraron metadatos en este documento. Puede que hayan
                sido eliminados intencionalmente (muchas herramientas permiten
                &quot;limpiar&quot; metadatos antes de publicar).
              </p>
            )}
          </Card>

          {/* Notes */}
          {result.notes && result.notes.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Notas
              </h3>
              <ul className="flex flex-col gap-2">
                {result.notes.map((note, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground font-mono"
                  >
                    • {note}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}
