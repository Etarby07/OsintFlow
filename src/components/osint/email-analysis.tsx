"use client";

import { useState } from "react";
import { Mail, Loader2, Search, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
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

interface EmailResult {
  email: string;
  valid: boolean;
  domain: string;
  mxRecords: string[];
  gravatar: { exists: boolean; url: string };
  breaches: { name: string; date: string; count: string }[];
  platforms: { name: string; registered: boolean; url: string }[];
  notes: string[];
}

export function EmailAnalysisTool() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailResult | null>(null);
  const { toast } = useToast();

  async function handleAnalyze(e: React.FormEvent) {
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
      const res = await fetch("/api/osint/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el análisis");
      setResult(data);
      saveHistory({ tool: "email", query: trimmed, results: data });
      toast({
        title: "Análisis completado",
        description: data.valid
          ? "Correo válido. Revisa los detalles."
          : "El formato del correo no es válido.",
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
      title="Análisis de Email"
      description="Introduce un correo electrónico para validar su formato, consultar los registros MX del dominio, comprobar si tiene avatar público en Gravatar y revisar si aparece en filtraciones de seguridad conocidas."
      icon={<Mail className="h-6 w-6" />}
    >
      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ej: usuario@dominio.com"
          type="email"
          className="font-mono"
          autoComplete="off"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? "Analizando..." : "Analizar"}
        </Button>
      </form>

      {loading && (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando formato, consultando DNS y filtraciones...
        </Card>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Validity banner */}
          <Card className="p-4 flex items-center gap-3">
            {result.valid ? (
              <ShieldCheck className="h-5 w-5 text-foreground" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium font-mono">{result.email}</span>
              <span className="text-xs text-muted-foreground">
                {result.valid
                  ? "Formato de correo válido"
                  : "Formato de correo no válido"}
              </span>
            </div>
          </Card>

          {/* Breaches */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Filtraciones conocidas</h3>
            </div>
            {result.breaches.length > 0 ? (
              <div className="flex flex-col gap-2">
                {result.breaches.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{b.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Fecha: {b.date} · Registros: {b.count}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-foreground/30">
                      Comprometido
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se ha encontrado este correo en filtraciones públicas
                conocidas en la base de datos local.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Nota: la base de datos local es una muestra educativa. Para una
              verificación completa usa{" "}
              <a
                href="https://haveibeenpwned.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                HaveIBeenPwned
              </a>
              .
            </p>
          </Card>

          {/* Details table */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Detalles técnicos</h3>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground w-1/3">
                    Dominio
                  </TableCell>
                  <TableCell className="font-mono">{result.domain}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Registros MX
                  </TableCell>
                  <TableCell>
                    {result.mxRecords.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {result.mxRecords.map((mx) => (
                          <span key={mx} className="font-mono text-xs">
                            {mx}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        No encontrados
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Gravatar
                  </TableCell>
                  <TableCell>
                    {result.gravatar.exists ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={result.gravatar.url}
                          alt="Gravatar"
                          className="h-8 w-8 rounded-full border border-border"
                        />
                        <span className="text-xs">Avatar público encontrado</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Sin avatar público
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          {/* Platforms */}
          {result.platforms.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">
                Registro en plataformas
              </h3>
              <div className="flex flex-col gap-2">
                {result.platforms.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3"
                  >
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.registered ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline hover:text-foreground"
                      >
                        Posiblemente registrado →
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No detectado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

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
