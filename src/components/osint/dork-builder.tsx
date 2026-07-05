"use client";

import { useMemo, useState } from "react";
import {
  SearchCode,
  Copy,
  Search,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { ToolShell } from "@/components/osint/tool-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveHistory } from "@/lib/osint/history-client";

interface DorkFields {
  site: string;
  terms: string;
  intitle: string;
  inurl: string;
  filetype: string;
  exclude: string;
}

const FILETYPE_OPTIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "sql",
  "xml",
  "log",
  "conf",
];

const EMPTY_FIELDS: DorkFields = {
  site: "",
  terms: "",
  intitle: "",
  inurl: "",
  filetype: "none",
  exclude: "",
};

interface Preset {
  label: string;
  fields: DorkFields;
}

const PRESETS: Preset[] = [
  {
    label: "Documentos PDF confidenciales en un dominio",
    fields: {
      site: "",
      terms: "confidencial",
      intitle: "",
      inurl: "",
      filetype: "pdf",
      exclude: "",
    },
  },
  {
    label: "Archivos de configuración expuestos",
    fields: {
      site: "",
      terms: "",
      intitle: "",
      inurl: "",
      filetype: "conf",
      exclude: "",
    },
  },
  {
    label: "Listados de directorios",
    fields: {
      site: "",
      terms: "",
      intitle: "index of",
      inurl: "",
      filetype: "none",
      exclude: "",
    },
  },
  {
    label: "Archivos SQL expuestos",
    fields: {
      site: "",
      terms: "",
      intitle: "",
      inurl: "",
      filetype: "sql",
      exclude: "",
    },
  },
  {
    label: "Presentaciones PPT con datos",
    fields: {
      site: "",
      terms: "",
      intitle: "",
      inurl: "",
      filetype: "pptx",
      exclude: "",
    },
  },
  {
    label: "Archivos de log expuestos",
    fields: {
      site: "",
      terms: "",
      intitle: "",
      inurl: "",
      filetype: "log",
      exclude: "",
    },
  },
];

function buildDork(f: DorkFields): string {
  const parts: string[] = [];
  if (f.site.trim()) parts.push(`site:${f.site.trim()}`);
  if (f.filetype && f.filetype !== "none")
    parts.push(`filetype:${f.filetype}`);
  if (f.terms.trim()) {
    const t = f.terms.trim();
    parts.push(t.includes(" ") ? `"${t}"` : t);
  }
  if (f.intitle.trim()) parts.push(`intitle:${f.intitle.trim()}`);
  if (f.inurl.trim()) parts.push(`inurl:${f.inurl.trim()}`);
  if (f.exclude.trim()) {
    const excludes = f.exclude.trim().split(/\s+/).filter(Boolean);
    for (const ex of excludes) parts.push(`-${ex}`);
  }
  return parts.join(" ");
}

export function DorkBuilderTool() {
  const [fields, setFields] = useState<DorkFields>(EMPTY_FIELDS);
  const { toast } = useToast();

  const dork = useMemo(() => buildDork(fields), [fields]);

  function update<K extends keyof DorkFields>(key: K, value: DorkFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCopy() {
    if (!dork) return;
    try {
      await navigator.clipboard.writeText(dork);
      toast({ title: "Dork copiado", description: dork });
    } catch {
      toast({
        variant: "destructive",
        title: "No se pudo copiar",
        description: "Copia manualmente el texto del campo.",
      });
    }
  }

  function handleSearch() {
    if (!dork) return;
    saveHistory({ tool: "dorks", query: dork, results: { dork } });
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(dork)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function applyPreset(p: Preset) {
    setFields(p.fields);
    toast({ title: "Ejemplo cargado", description: p.label });
  }

  function handleReset() {
    setFields(EMPTY_FIELDS);
  }

  return (
    <ToolShell
      title="Generador de Google Dorks"
      description="Construye operadores de búsqueda avanzada de Google sin necesidad de aprender la sintaxis. Rellena los campos y OsintFlow generará el Dork listo para buscar."
      icon={<SearchCode className="h-6 w-6" />}
    >
      {/* Form fields */}
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-site">Sitio (site:)</Label>
            <Input
              id="dork-site"
              value={fields.site}
              onChange={(e) => update("site", e.target.value)}
              placeholder="ejemplo.com"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-filetype">Tipo de archivo (filetype:)</Label>
            <Select
              value={fields.filetype}
              onValueChange={(v) => update("filetype", v)}
            >
              <SelectTrigger id="dork-filetype" className="font-mono w-full">
                <SelectValue placeholder="ninguno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ninguno</SelectItem>
                {FILETYPE_OPTIONS.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {ft}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-terms">Palabras clave</Label>
            <Input
              id="dork-terms"
              value={fields.terms}
              onChange={(e) => update("terms", e.target.value)}
              placeholder="palabras clave"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-exclude">Excluir (-)</Label>
            <Input
              id="dork-exclude"
              value={fields.exclude}
              onChange={(e) => update("exclude", e.target.value)}
              placeholder="términos a excluir, separados por espacio"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-intitle">En el título (intitle:)</Label>
            <Input
              id="dork-intitle"
              value={fields.intitle}
              onChange={(e) => update("intitle", e.target.value)}
              placeholder="ej: login"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dork-inurl">En la URL (inurl:)</Label>
            <Input
              id="dork-inurl"
              value={fields.inurl}
              onChange={(e) => update("inurl", e.target.value)}
              placeholder="ej: admin"
              className="font-mono"
              autoComplete="off"
            />
          </div>
        </div>
      </Card>

      {/* Generated dork */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <Label htmlFor="dork-output">Dork generado</Label>
          <Input
            id="dork-output"
            readOnly
            value={dork}
            placeholder="(rellena los campos para generar el dork)"
            className="font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={!dork}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button
              type="button"
              onClick={handleSearch}
              disabled={!dork}
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar en Google
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick examples */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Ejemplos rápidos</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Usa estos operadores de forma ética y solo sobre datos públicos.
        </span>
      </p>
    </ToolShell>
  );
}
