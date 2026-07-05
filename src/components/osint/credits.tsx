"use client";

import { Github, Youtube, MessageCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// OsintFlow author credits. Links are the correct, real profiles.
const CREDITS = [
  {
    platform: "GitHub",
    handle: "etarby07",
    url: "https://github.com/etarby07",
    icon: Github,
    description: "Código fuente y proyectos",
    copyable: false,
  },
  {
    platform: "YouTube",
    handle: "etarby07",
    url: "https://www.youtube.com/@etarby07",
    icon: Youtube,
    description: "Vídeos y tutoriales",
    copyable: false,
  },
  {
    platform: "Discord",
    handle: "etarby07",
    // Discord usernames don't expose a direct clickable profile URL (they need
    // a numeric user ID). The correct way to share it is the handle itself,
    // which the user copies and adds on Discord. The button opens the app.
    url: "https://discord.com",
    icon: MessageCircle,
    description: "Usuario de Discord (cópialo y añádeme)",
    copyable: true,
  },
] as const;

export function CreditsCredits() {
  const { toast } = useToast();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {CREDITS.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.platform}
            className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-4"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold">{c.platform}</span>
                <span className="text-xs text-muted-foreground">
                  {c.description}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-mono truncate">{c.handle}</code>
              {c.copyable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(c.handle);
                      toast({ title: "Copiado", description: c.handle });
                    } catch {
                      toast({
                        variant: "destructive",
                        title: "No se pudo copiar",
                      });
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar
                </Button>
              ) : (
                <Button asChild type="button" variant="outline" size="sm">
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
