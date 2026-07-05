"use client";

import { useSyncExternalStore, useState } from "react";
import { Radar, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditsCredits } from "@/components/osint/credits";

const STORAGE_KEY = "osintflow_welcome_seen_v1";

// useSyncExternalStore lets us read localStorage without a setState-in-effect.
// The "welcome seen" flag is treated as an external store; the dialog is open
// when the store reports the flag is NOT set.
const emptySubscribe = () => () => {};

function getWelcomeSeenSnapshot(): boolean {
  if (typeof window === "undefined") return true; // SSR: treat as seen (closed)
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return true; // SSR: closed
}

export function WelcomeDialog() {
  const seen = useSyncExternalStore(
    emptySubscribe,
    getWelcomeSeenSnapshot,
    getServerSnapshot
  );
  const [dismissed, setDismissed] = useState(false);
  const open = !seen && !dismissed;

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
              <Radar className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <DialogTitle className="text-xl">Bienvenido a OsintFlow</DialogTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                Panel de Inteligencia de Fuentes Abiertas
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            OsintFlow reúne más de 20 herramientas de investigación OSINT en
            una sola interfaz minimalista: búsqueda de usuarios, análisis de
            emails e IPs, metadatos de imágenes y documentos, escaneo de
            subdominios, búsqueda en la dark web y mucho más. Todas las
            búsquedas se guardan en tu historial local y puedes exportarlas en
            JSON o CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/20 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Aviso ético:</strong> usa esta
            herramienta solo con datos públicos y dentro de la legalidad. No la
            utilices para acosar, vigilar o suplantar a personas. Respeta el
            RGPD y la legislación vigente.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Créditos
          </span>
          <CreditsCredits />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button onClick={handleDismiss} className="flex-1">
            Comenzar a usar OsintFlow
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Este aviso solo se muestra la primera vez. Puedes volver a verlo
          desde la sección <strong className="text-foreground">Ajustes</strong>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
