"use client";

import { Radar, ArrowRight } from "lucide-react";
import {
  ToolId,
  ToolCategory,
  TOOLS,
  CATEGORY_ORDER,
} from "@/lib/osint/types";
import { Card } from "@/components/ui/card";

const CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  Sistema: "Inicio y configuración de la aplicación.",
  "Personas e Identidad":
    "Investiga individuos a partir de alias, correos, teléfonos y nombres.",
  "Infraestructura y Red":
    "Analiza IPs, dominios, subdominios y la postura de seguridad de sitios web.",
  "Contenido y Archivos":
    "Extrae metadatos ocultos y busca mensajes en imágenes y documentos.",
  "Fugas y Dark Web":
    "Detecta credenciales y datos filtrados en brechas, pastebins y la red Tor.",
  "Búsqueda y Enlaces":
    "Sigue enlaces, construye dorks y decodifica texto sospechoso.",
  "Localización y Seguimiento":
    "Geolocaliza redes Wi-Fi y rastrea vuelos y barcos en tiempo real.",
};

export function Dashboard({
  onNavigate,
}: {
  onNavigate: (id: ToolId) => void;
}) {
  const tools = TOOLS.filter(
    (t) => t.id !== "dashboard" && t.id !== "settings"
  );
  const toolCount = TOOLS.filter((t) => t.id !== "dashboard").length;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
            <Radar className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">OsintFlow</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Un panel centralizado de inteligencia de fuentes abiertas (OSINT).
          Reúne <strong className="text-foreground">{toolCount} herramientas</strong>{" "}
          de investigación en una interfaz minimalista: busca usuarios en redes
          sociales, analiza correos e IPs, extrae metadatos de imágenes y
          documentos, escanea subdominios, rastrea vuelos y mucho más.
        </p>
      </header>

      {CATEGORY_ORDER.filter((c) => c !== "Sistema").map((cat) => {
        const catTools = tools.filter((t) => t.category === cat);
        if (catTools.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold">{cat}</h2>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_DESCRIPTIONS[cat]}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catTools.map((tool) => {
                return (
                  <Card
                    key={tool.id}
                    className="p-5 cursor-pointer hover:bg-accent/40 transition-colors group border-border"
                    onClick={() => onNavigate(tool.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40 text-xs font-mono uppercase">
                        {tool.id.slice(0, 2)}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="font-medium text-base mb-1">{tool.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-lg border border-border bg-muted/20 p-5">
        <h2 className="text-sm font-semibold mb-2">¿Qué es OSINT?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <strong className="text-foreground">OSINT</strong> (Open Source
          Intelligence, o Inteligencia de Fuentes Abiertas) es la práctica de
          recopilar y analizar información disponible públicamente en internet
          con el fin de responder a una pregunta de investigación. OsintFlow
          automatiza consultas que un analista haría manualmente, ahorrando
          tiempo y centralizando los resultados.
        </p>
      </div>
    </section>
  );
}
