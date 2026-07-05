"use client";

import { useState, useRef, useCallback } from "react";
import {
  ScanSearch,
  Loader2,
  Upload,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface EngineLink {
  name: string;
  description: string;
  url: string;
}

const URL_ENGINES = (url: string): EngineLink[] => [
  {
    name: "Google Lens",
    description: "Mejor cobertura web",
    url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Yandex Images",
    description: "Mejor para rostros",
    url: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(url)}`,
  },
  {
    name: "TinEye",
    description: "Busca duplicados exactos",
    url: `https://tineye.com/search/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Bing Visual Search",
    description: "Alternativa de Microsoft",
    url: `https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=${encodeURIComponent(url)}`,
  },
];

const UPLOAD_ENGINES: EngineLink[] = [
  {
    name: "Google Lens",
    description: "Mejor cobertura web",
    url: "https://lens.google.com/",
  },
  {
    name: "Yandex Images",
    description: "Mejor para rostros",
    url: "https://yandex.com/images/",
  },
  {
    name: "TinEye",
    description: "Busca duplicados exactos",
    url: "https://tineye.com/",
  },
  {
    name: "Bing Visual Search",
    description: "Alternativa de Microsoft",
    url: "https://www.bing.com/visualsearch",
  },
];

export function ReverseImageTool() {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [urlEngines, setUrlEngines] = useState<EngineLink[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Upload tab state
  const [dragOver, setDragOver] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showUploadEngines, setShowUploadEngines] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "URL requerida",
        description: "Pega la URL de una imagen (https://...).",
      });
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      toast({
        variant: "destructive",
        title: "URL no válida",
        description: "La URL debe empezar con http:// o https://",
      });
      return;
    }
    setLoading(true);
    setUrlEngines(null);
    setPreviewUrl(null);
    try {
      const engines = URL_ENGINES(trimmed);
      setUrlEngines(engines);
      setPreviewUrl(trimmed);
      saveHistory({
        tool: "image",
        query: trimmed,
        results: { engines },
      });
      toast({
        title: "Enlaces generados",
        description: "Haz clic en cada motor para abrir la búsqueda inversa.",
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
  };

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: "Selecciona un archivo de imagen (JPG, PNG, WEBP...).",
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
      // Revoke previous preview URL to avoid leaks
      if (filePreview) URL.revokeObjectURL(filePreview);
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
      setFileName(file.name);
      setShowUploadEngines(true);
      saveHistory({
        tool: "image",
        query: file.name,
        results: { engines: UPLOAD_ENGINES, mode: "upload" },
      });
      toast({
        title: "Imagen cargada",
        description:
          "Abre cada motor y sube la imagen manualmente desde su página.",
      });
    },
    [filePreview, toast]
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
      title="Búsqueda Inversa de Imágenes"
      description="Sube una imagen o pega su URL para generar enlaces listos para hacer clic en las búsquedas inversas de Google Lens, Yandex, TinEye y Bing. Útil para detectar fotos de perfil falsas o encontrar el origen de una imagen."
      icon={<ScanSearch className="h-6 w-6" />}
    >
      <Tabs defaultValue="url" className="w-full">
        <TabsList>
          <TabsTrigger value="url">Por URL</TabsTrigger>
          <TabsTrigger value="upload">Subir imagen</TabsTrigger>
        </TabsList>

        {/* ---------- URL TAB ---------- */}
        <TabsContent value="url">
          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <form
                onSubmit={handleUrlSubmit}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Input
                  type="url"
                  placeholder="https://...jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" disabled={loading} className="shrink-0">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ScanSearch className="h-4 w-4 mr-2" />
                  )}
                  Generar enlaces
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Pega la URL directa de una imagen (.jpg, .png, .webp). Debe ser
                accesible públicamente.
              </p>
            </Card>

            {previewUrl && (
              <Card className="p-4 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Vista previa de la imagen"
                    className="max-h-full max-w-full object-contain"
                    onError={() => {
                      toast({
                        variant: "destructive",
                        title: "No se pudo cargar la vista previa",
                        description:
                          "La URL puede no ser accesible o estar protegida. Los enlaces siguen funcionando.",
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium">Imagen de origen</span>
                  <span className="text-xs text-muted-foreground break-all font-mono">
                    {previewUrl}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Haz clic en cada motor para abrir la búsqueda inversa usando
                    esta imagen.
                  </span>
                </div>
              </Card>
            )}

            {urlEngines && (
              <div className="grid gap-4 sm:grid-cols-2">
                {urlEngines.map((engine) => (
                  <Card key={engine.name} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {engine.name}
                      </span>
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {engine.description}
                    </span>
                    <a
                      href={engine.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir búsqueda
                      </Button>
                    </a>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------- UPLOAD TAB ---------- */}
        <TabsContent value="upload">
          <div className="flex flex-col gap-4">
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
                  JPG, PNG, WEBP · máx. 15 MB · la imagen no se sube a internet
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
              >
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar imagen
              </Button>
            </div>

            {filePreview && (
              <Card className="p-4 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden">
                  <img
                    src={filePreview}
                    alt="Vista previa de la imagen subida"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    Imagen cargada localmente
                  </span>
                  <span className="text-xs text-muted-foreground break-all font-mono">
                    {fileName}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Los motores externos no aceptan archivos locales mediante
                    URL. Abre cada motor y sube la imagen manualmente desde su
                    página de búsqueda.
                  </span>
                </div>
              </Card>
            )}

            {showUploadEngines && (
              <div className="grid gap-4 sm:grid-cols-2">
                {UPLOAD_ENGINES.map((engine) => (
                  <Card key={engine.name} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {engine.name}
                      </span>
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {engine.description}
                    </span>
                    <a
                      href={engine.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir página de subida
                      </Button>
                    </a>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </ToolShell>
  );
}
