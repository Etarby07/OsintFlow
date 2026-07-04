// Shared types for OsintFlow tools
export type ToolId =
  | "dashboard"
  | "user"
  | "email"
  | "ipdomain"
  | "phone"
  | "exif"
  | "history";

export interface ToolMeta {
  id: ToolId;
  label: string;
  description: string;
}

export const TOOLS: ToolMeta[] = [
  {
    id: "dashboard",
    label: "Panel",
    description: "Resumen general de OsintFlow",
  },
  {
    id: "user",
    label: "Búsqueda de Usuario",
    description: "Encuentra perfiles en redes sociales a partir de un alias.",
  },
  {
    id: "email",
    label: "Análisis de Email",
    description: "Comprueba filtraciones y registros de un correo.",
  },
  {
    id: "ipdomain",
    label: "IP y Dominio",
    description: "WHOIS, DNS, geolocalización y detección de WAF.",
  },
  {
    id: "phone",
    label: "Teléfono",
    description: "País, operador y asociación con apps de mensajería.",
  },
  {
    id: "exif",
    label: "Metadatos EXIF",
    description: "Extrae metadatos ocultos de imágenes (GPS, cámara...).",
  },
  {
    id: "history",
    label: "Historial",
    description: "Revisa y exporta tus investigaciones previas.",
  },
];
