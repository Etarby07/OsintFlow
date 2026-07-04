"use client";

import { Settings, RotateCcw, Info, Heart } from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditsCredits } from "@/components/osint/credits";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "osintflow_welcome_seen_v1";

export function SettingsPanel() {
  const { toast } = useToast();

  function resetWelcome() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "Aviso restablecido",
        description:
          "El aviso de bienvenida se mostrará la próxima vez que abras OsintFlow.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo restablecer el aviso.",
      });
    }
  }

  function clearHistory() {
    fetch("/api/history", { method: "DELETE" })
      .then((r) => r.json())
      .then(() => {
        toast({
          title: "Historial borrado",
          description: "Se han eliminado todas las investigaciones guardadas.",
        });
      })
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo borrar el historial.",
        });
      });
  }

  return (
    <ToolShell
      title="Ajustes"
      description="Configuración de OsintFlow, información sobre la aplicación y créditos del autor."
      icon={<Settings className="h-6 w-6" />}
    >
      {/* About */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Sobre OsintFlow</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          OsintFlow es un panel de inteligencia de fuentes abiertas (OSINT) que
          reúne más de 20 herramientas de investigación en una interfaz
          minimalista. Construido con Next.js, TypeScript, Tailwind CSS y
          shadcn/ui. El historial se almacena localmente en una base de datos
          SQLite.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline">Next.js 16</Badge>
          <Badge variant="outline">TypeScript</Badge>
          <Badge variant="outline">Tailwind CSS 4</Badge>
          <Badge variant="outline">Prisma + SQLite</Badge>
          <Badge variant="outline">Docker</Badge>
        </div>
      </Card>

      {/* Credits */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Créditos · Creador</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          OsintFlow es un proyecto de código abierto mantenido por{" "}
          <strong className="text-foreground font-mono">etarby07</strong>.
          Puedes seguir el proyecto y contactar en:
        </p>
        <CreditsCredits />
      </Card>

      {/* Preferences */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Preferencias</h3>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                Aviso de bienvenida
              </span>
              <span className="text-xs text-muted-foreground">
                Vuelve a mostrar el aviso que aparece la primera vez.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={resetWelcome}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restablecer aviso
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Borrar historial</span>
              <span className="text-xs text-muted-foreground">
                Elimina todas las investigaciones guardadas localmente.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearHistory}>
              Borrar todo el historial
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-2">Aviso legal</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          OsintFlow es una herramienta educativa. Solo consulta información
          públicamente accesible. El autor no se hace responsable del uso
          indebido. Usa la aplicación de forma ética y dentro de la legalidad
          vigente (RGPD, LOPDGDD y normativas equivalentes).
        </p>
      </Card>
    </ToolShell>
  );
}
