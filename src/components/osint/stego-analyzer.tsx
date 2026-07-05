"use client";

import { useState, useRef, useCallback } from "react";
import {
  ScanLine,
  Loader2,
  Upload,
  AlertTriangle,
  ShieldAlert,
  FileWarning,
  Hash,
  Binary,
  FileText,
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

interface PlaneStat {
  channel: string;
  onesPercent: number;
}

interface StegoResult {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  channels: number;
  lsbHexPreview: string;
  lsbAsciiPreview: string;
  detectedSignature: string | null;
  planeStats: PlaneStat[];
  textFragments: string[];
  notes: string[];
}

export function StegoTool() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StegoResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const extOk = [".png", ".bmp", ".jpg", ".jpeg"].some((ext) =>
        lower.endsWith(ext)
      );
      if (!extOk && !file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: "Selecciona una imagen PNG, BMP o JPG.",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Archivo demasiado grande",
          description: "El tamaño máximo es 10 MB.",
        });
        return;
      }
      setLoading(true);
      setResult(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/osint/stego", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al analizar la imagen");
        setResult(data as StegoResult);
        saveHistory({ tool: "stego", query: file.name, results: data });
        toast({
          title: "Análisis LSB completado",
          description: `Procesada ${file.name} (${(data as StegoResult).width}×${
            (data as StegoResult).height
          }).`,
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

  return (
    <ToolShell
      title="Analizador de Esteganografía"
      description="Sube una imagen PNG o BMP para analizar el plano LSB (Least Significant Bit) y detectar posibles mensajes ocultos incrustados por herramientas de esteganografía."
      icon={<ScanLine className="h-6 w-6" />}
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
            PNG, BMP, JPG · máx. 10 MB · análisis LSB en el servidor
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.bmp,.jpg,.jpeg,image/*"
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
          Extrayendo el plano LSB y buscando firmas ocultas...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* File info */}
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate font-mono">
                {result.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {(result.fileSize / 1024).toFixed(1)} KB · {result.width}×
                {result.height} · {result.channels} canal
                {result.channels > 1 ? "es" : ""}
              </span>
            </div>
          </Card>

          {/* Detected signature */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileWarning className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Firma detectada</h3>
            </div>
            {result.detectedSignature ? (
              <div className="flex items-center gap-3 rounded-md border border-foreground/40 bg-muted/30 p-3">
                <ShieldAlert className="h-5 w-5 text-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium font-mono">
                    {result.detectedSignature}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Los primeros bytes del LSB coinciden con la cabecera de un
                    archivo conocido; es probable que exista contenido incrustado.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se detectó ninguna firma de archivo conocida en el LSB. Esto
                no descarta la presencia de esteganografía: el payload puede
                estar cifrado, comprimido o disperso con un PRNG.
              </p>
            )}
          </Card>

          {/* Plane stats */}
          {result.planeStats.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Binary className="h-5 w-5" />
                <h3 className="text-sm font-semibold">
                  Estadísticas LSB por canal
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">Canal</TableHead>
                    <TableHead>% de bits a 1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.planeStats.map((p) => {
                    const dev = Math.abs(p.onesPercent - 50);
                    return (
                      <TableRow key={p.channel}>
                        <TableCell className="font-mono text-xs font-medium">
                          {p.channel}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {p.onesPercent.toFixed(2)}%
                            </span>
                            {dev < 2 && (
                              <Badge
                                variant="outline"
                                className="border-foreground/40 text-foreground"
                              >
                                ~ aleatorio
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Una distribución cercana al 50% sugiere datos aleatorios o
                cifrados; las imágenes naturales suelen desviarse de ese valor.
              </p>
            </Card>
          )}

          {/* Hex preview */}
          {result.lsbHexPreview && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Vista previa Hex</h3>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                {result.lsbHexPreview}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Primeros 256 bytes del LSB en hexadecimal.
              </p>
            </Card>
          )}

          {/* ASCII preview */}
          {result.lsbAsciiPreview && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Vista previa ASCII</h3>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                {result.lsbAsciiPreview}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Primeros 512 bytes del LSB; los caracteres no imprimibles se
                muestran como ".".
              </p>
            </Card>
          )}

          {/* Text fragments */}
          {result.textFragments.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5" />
                <h3 className="text-sm font-semibold">
                  Fragmentos de texto detectados ({result.textFragments.length})
                </h3>
              </div>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {result.textFragments.map((frag, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-muted/30 p-2"
                  >
                    <span className="text-xs font-mono break-all">{frag}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Runs de caracteres ASCII imprimibles de 8+ bytes hallados en el
                LSB. Pueden ser texto incrustado o ruido.
              </p>
            </Card>
          )}

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
