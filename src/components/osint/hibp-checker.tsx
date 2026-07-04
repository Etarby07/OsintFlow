"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Search,
  Globe,
  Calendar,
  Users,
  BadgeCheck,
  Info,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface Breach {
  name: string;
  domain?: string;
  date: string;
  dataClasses: string[];
  pwnCount?: number;
  description?: string;
  isVerified?: boolean;
}

interface HibpResult {
  email: string;
  source: "hibp" | "local";
  breaches: Breach[];
  notes: string[];
}

function formatCount(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("es-ES");
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function HibpCheckerTool() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HibpResult | null>(null);
  const { toast } = useToast();

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Introduce un correo electrónico.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint/hibp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la comprobación");
      setResult(data);
      saveHistory({ tool: "hibp", query: trimmed, results: data });
      toast({
        title: "Comprobación completada",
        description:
          data.breaches.length > 0
            ? `Aparece en ${data.breaches.length} filtración${
                data.breaches.length === 1 ? "" : "es"
              }.`
            : "No aparece en filtraciones conocidas.",
        variant: data.breaches.length > 0 ? "destructive" : "default",
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
  }

  return (
    <ToolShell
      title="Comprobador de Filtraciones"
      description="Comprueba si un correo electrónico aparece en filtraciones de datos conocidas usando HaveIBeenPwned. Si se configura una API key (HIBP_API_KEY), se consulta la base de datos en tiempo real; si no, se usa una base de datos local de muestra."
      icon={<ShieldAlert className="h-6 w-6" />}
    >
      <form onSubmit={handleCheck} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ej: alguien@dominio.com"
          type="email"
          className="font-mono"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Comprobando..." : "Comprobar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando filtraciones de datos conocidas...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary banner */}
          <Card
            className={`p-5 flex items-center gap-4 ${
              result.breaches.length > 0
                ? "border-foreground/40 bg-foreground/5"
                : ""
            }`}
          >
            {result.breaches.length > 0 ? (
              <ShieldAlert className="h-8 w-8 shrink-0" />
            ) : (
              <ShieldCheck className="h-8 w-8 shrink-0 text-foreground" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold font-mono">
                {result.email}
              </span>
              <span className="text-sm text-muted-foreground">
                {result.breaches.length > 0
                  ? `Aparece en ${result.breaches.length} filtración${
                      result.breaches.length === 1 ? "" : "es"
                    } conocida${
                      result.breaches.length === 1 ? "" : "s"
                    }.`
                  : "No aparece en filtraciones conocidas."}
              </span>
            </div>
            <Badge
              variant="outline"
              className="ml-auto shrink-0 font-mono text-[10px] uppercase"
            >
              {result.source === "hibp" ? "HaveIBeenPwned" : "DB local"}
            </Badge>
          </Card>

          {/* Source note for local */}
          {result.source === "local" && (
            <Card className="p-4 flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Resultados obtenidos de una base de datos local de muestra
                (~12 brechas conocidas). Para una verificación completa en
                tiempo real con la base de datos de HaveIBeenPwned, configura la
                variable de entorno{" "}
                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                  HIBP_API_KEY
                </code>{" "}
                — obtén una en{" "}
                <a
                  href="https://haveibeenpwned.com/API/Key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  haveibeenpwned.com/API/Key
                </a>
                .
              </p>
            </Card>
          )}

          {/* Breach cards */}
          {result.breaches.length > 0 && (
            <div className="flex flex-col gap-3">
              {result.breaches.map((b) => {
                const date = formatDate(b.date);
                return (
                  <Card key={`${b.name}-${b.date}`} className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold">{b.name}</h3>
                            {b.isVerified !== undefined && (
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1"
                              >
                                <BadgeCheck className="h-3 w-3" />
                                {b.isVerified ? "Verificada" : "Sin verificar"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {date}
                              </span>
                            )}
                            {b.pwnCount != null && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {formatCount(b.pwnCount)} cuentas
                              </span>
                            )}
                            {b.domain && (
                              <a
                                href={`https://${b.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:text-foreground underline"
                              >
                                <Globe className="h-3 w-3" />
                                {b.domain}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Data classes */}
                      {b.dataClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {b.dataClasses.map((dc) => (
                            <Badge
                              key={dc}
                              variant="secondary"
                              className="text-[10px] font-mono"
                            >
                              {dc}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      {b.description && (
                        <p
                          className="text-xs text-muted-foreground leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: b.description.replace(
                              /<\/?[^>]+(>|$)/g,
                              ""
                            ),
                          }}
                        />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Observaciones</h3>
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
