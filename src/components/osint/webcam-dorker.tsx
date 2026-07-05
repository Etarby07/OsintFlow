"use client";

import { useState } from "react";
import {
  Video,
  Search,
  ExternalLink,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface Preset {
  title: string;
  dork: string;
  description: string;
}

const PRESETS: Preset[] = [
  {
    title: "Axis Communications (vista en vivo)",
    dork: 'inurl:"/view.shtml" "Live View - Axis"',
    description:
      "Cámaras Axis expuestas con la página de visualización por defecto (Live View).",
  },
  {
    title: "Axis (vista índice)",
    dork: 'inurl:"/view/index.shtml" Axis',
    description:
      "Páginas índice de cámaras Axis que listan los streams disponibles.",
  },
  {
    title: "Mobotix",
    dork: 'inurl:"/control/userimage.html" Mobotix',
    description:
      "Interfaz de control de cámaras Mobotix que muestra la imagen de usuario.",
  },
  {
    title: "Panasonic Network Camera",
    dork: 'intitle:"Network Camera" Panasonic',
    description:
      "Cámaras de red Panasonic cuyo título de página indica 'Network Camera'.",
  },
  {
    title: "Webcam genérica (Network Camera)",
    dork: 'inurl:"view/index.shtml" "Network Camera"',
    description:
      "Cámaras IP genéricas con la página de índice típica 'Network Camera'.",
  },
  {
    title: "Axis en puerto 8080",
    dork: 'inurl:":8080" "Live View - Axis"',
    description:
      "Cámaras Axis servidas en el puerto 8080, habitualmente expuestas por configuración casera.",
  },
  {
    title: "webcamXP 5",
    dork: 'intitle:"webcamXP 5"',
    description:
      "Streams gestionados con el software webcamXP 5, muy usado en webcams de aficionados.",
  },
  {
    title: "yawcam (AXIS pattern)",
    dork: 'intitle:"Live View / - AXIS"',
    description:
      "Cámaras con la plantilla 'Live View / - AXIS' que también usan algunos clones de yawcam.",
  },
  {
    title: "Foscam",
    dork: 'inurl:"/cgi-bin/viewer/video.jpg" Foscam',
    description:
      "Cámaras Foscam que exponen el endpoint CGI de imagen estática de video.",
  },
  {
    title: "Blue Iris (webview)",
    dork: 'intitle:"Blue Iris" webview',
    description:
      "Servidores Blue Iris con la vista web accesible públicamente.",
  },
];

export function WebcamDorkerTool() {
  const [keyword, setKeyword] = useState("");
  const { toast } = useToast();

  function openPreset(p: Preset) {
    saveHistory({ tool: "webcam", query: p.title, results: { dork: p.dork } });
    const url = `https://www.google.com/search?q=${encodeURIComponent(p.dork)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast({
      title: "Búsqueda abierta en Google",
      description: p.title,
    });
  }

  function searchCustom(e: React.FormEvent) {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw) {
      toast({
        variant: "destructive",
        title: "Palabra clave requerida",
        description: "Escribe una marca o término para buscar.",
      });
      return;
    }
    saveHistory({ tool: "webcam", query: kw, results: { keyword: kw } });
    // Build the URL exactly as specified.
    const url = `https://www.google.com/search?q=inurl:"view.shtml"+${encodeURIComponent(
      kw
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast({
      title: "Búsqueda abierta en Google",
      description: `inurl:"view.shtml" ${kw}`,
    });
  }

  return (
    <ToolShell
      title="Buscador de Cámaras Web Públicas"
      description="Genera búsquedas avanzadas (Dorks) para encontrar cámaras IP y streams públicos de marcas como Axis, Mobotix o Panasonic. Los resultados se abren en Google en una nueva pestaña."
      icon={<Video className="h-6 w-6" />}
    >
      {/* Ethical disclaimer */}
      <Card className="p-4 border-border bg-muted/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Aviso ético y legal</h3>
            <p className="text-xs text-muted-foreground">
              Esta herramienta solo debe usarse para acceder a cámaras
              públicas. No accedas a cámaras privadas sin autorización; podría
              ser ilegal.
            </p>
          </div>
        </div>
      </Card>

      {/* Preset dorks */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Dorks predefinidos</h3>
        </div>
        {PRESETS.map((p) => (
          <Card key={p.title} className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{p.title}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      dork
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => openPreset(p)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir en Google
                </Button>
              </div>
              <code className="text-xs font-mono bg-muted/60 border border-border rounded-md p-2 break-all">
                {p.dork}
              </code>
            </div>
          </Card>
        ))}
      </div>

      {/* Custom search */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Búsqueda personalizada</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Escribe una marca (Axis, Foscam...) o cualquier término y OsintFlow
            lo combinará con <code className="font-mono">inurl:&quot;view.shtml&quot;</code> para
            buscarlo en Google.
          </p>
          <form
            onSubmit={searchCustom}
            className="flex flex-col sm:flex-row gap-2"
          >
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ej: Axis, Foscam, Panasonic..."
              className="font-mono"
              autoComplete="off"
            />
            <Button type="submit" className="shrink-0">
              <Search className="h-4 w-4 mr-2" />
              Buscar en Google
            </Button>
          </form>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Recuerda: la mayoría de cámaras IP expuestas son privadas. Solo
          visualiza las que el propietario haya hecho públicas
          explícitamente.
        </span>
      </p>
    </ToolShell>
  );
}
