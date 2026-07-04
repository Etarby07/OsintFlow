"use client";

import {
  UserSearch,
  Mail,
  Globe,
  Phone,
  Image as ImageIcon,
  History,
  Radar,
  ArrowRight,
  Link2,
  ScanSearch,
  SearchCode,
  Network,
  FileText,
  ShieldAlert,
  KeyRound,
} from "lucide-react";
import { ToolId, TOOLS } from "@/lib/osint/types";
import { Card } from "@/components/ui/card";

const ICONS: Record<ToolId, React.ElementType> = {
  dashboard: Radar,
  user: UserSearch,
  email: Mail,
  ipdomain: Globe,
  phone: Phone,
  exif: ImageIcon,
  link: Link2,
  image: ScanSearch,
  dorks: SearchCode,
  subdomain: Network,
  document: FileText,
  hibp: ShieldAlert,
  pgp: KeyRound,
  history: History,
};

export function Dashboard({
  onNavigate,
}: {
  onNavigate: (id: ToolId) => void;
}) {
  const cards = TOOLS.filter((t) => t.id !== "dashboard");

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
          Reúne trece herramientas de investigación en una interfaz minimalista:
          busca usuarios en redes sociales, analiza correos, reconoce IPs y
          dominios, localiza teléfonos, extrae metadatos de imágenes y
          documentos, sigue enlaces acortados, escanea subdominios y mucho más.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((tool) => {
          const Icon = ICONS[tool.id];
          return (
            <Card
              key={tool.id}
              className="p-5 cursor-pointer hover:bg-accent/40 transition-colors group border-border"
              onClick={() => onNavigate(tool.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
                  <Icon className="h-5 w-5" />
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
