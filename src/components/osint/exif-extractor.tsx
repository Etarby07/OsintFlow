"use client";

import { useState, useRef, useCallback } from "react";
import { Image as ImageIcon, Loader2, Upload, MapPin, Camera, Calendar, FileCode } from "lucide-react";
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

interface ExifResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  metadata: Record<string, unknown>;
  gps?: {
    lat?: number;
    lon?: number;
    url?: string;
  };
}

export function ExifExtractorTool() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExifResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: "Selecciona un archivo de imagen (JPG, PNG, TIFF...).",
        });
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
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
        const res = await fetch("/api/osint/exif", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al extraer metadatos");
        setResult(data);
        saveHistory({ tool: "exif", query: file.name, results: data });
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

  // Build a flat, readable list of metadata fields.
  const metaEntries: { key: string; value: string }[] = result
    ? Object.entries(result.metadata)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => {
          let val: string;
          if (v instanceof Date) {
            val = v.toLocaleString();
          } else if (typeof v === "object") {
            val = JSON.stringify(v);
          } else {
            val = String(v);
          }
          return { key: k, value: val };
        })
        .sort((a, b) => a.key.localeCompare(b.key))
    : [];

  return (
    <ToolShell
      title="Extractor de Metadatos EXIF"
      description="Sube o arrastra una imagen y OsintFlow extraerá sus metadatos ocultos: coordenadas GPS, modelo de cámara, fecha de captura, software, ajustes de exposición y mucho más."
      icon={<ImageIcon className="h-6 w-6" />}
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
            Arrastra una imagen aquí o haz clic para seleccionar
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, TIFF, HEIC · máx. 15 MB · procesado localmente en el servidor
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
          Seleccionar imagen
        </Button>
      </div>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Extrayendo metadatos EXIF, GPS, IPTC y XMP...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* File info + preview */}
          <Card className="p-4 flex flex-col sm:flex-row gap-4 items-start">
            {result.fileType.startsWith("image/") && (
              // We don't have the image bytes back, but show a generic icon.
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="text-sm font-medium truncate font-mono">
                {result.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {(result.fileSize / 1024).toFixed(1)} KB · {result.fileType}
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {result.gps?.lat != null && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" /> GPS
                  </Badge>
                )}
                {metaEntries.some((e) =>
                  /make|model|lens/i.test(e.key)
                ) && (
                  <Badge variant="outline" className="gap-1">
                    <Camera className="h-3 w-3" /> Cámara
                  </Badge>
                )}
                {metaEntries.some((e) =>
                  /date|time/i.test(e.key)
                ) && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" /> Fecha
                  </Badge>
                )}
                {metaEntries.some((e) =>
                  /software/i.test(e.key)
                ) && (
                  <Badge variant="outline" className="gap-1">
                    <FileCode className="h-3 w-3" /> Software
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* GPS */}
          {result.gps?.lat != null && result.gps?.lon != null && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Geolocalización GPS</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                  <span className="font-mono text-xs">
                    Latitud: {result.gps.lat.toFixed(6)} · Longitud:{" "}
                    {result.gps.lon.toFixed(6)}
                  </span>
                  <a
                    href={result.gps.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline hover:text-foreground"
                  >
                    Ver en mapa →
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Las coordenadas GPS pueden revelar el lugar exacto donde se
                  tomó la foto. Si compartes imágenes, considera eliminar los
                  metadatos.
                </p>
              </div>
            </Card>
          )}

          {/* Metadata table */}
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
                No se encontraron metadatos en esta imagen. Puede que hayan sido
                eliminados previamente (redes sociales suelen hacerlo).
              </p>
            )}
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
