// Shared types for OsintFlow tools
export type ToolId =
  | "dashboard"
  | "user"
  | "email"
  | "ipdomain"
  | "phone"
  | "exif"
  | "link"
  | "image"
  | "dorks"
  | "subdomain"
  | "document"
  | "hibp"
  | "pgp"
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
    description: "WHOIS, DNS, geolocalización en mapa y detección de WAF.",
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
    id: "link",
    label: "Analizador de Enlaces",
    description: "Sigue redirecciones de URLs acortadas y consulta Wayback.",
  },
  {
    id: "image",
    label: "Búsqueda Inversa de Imágenes",
    description: "Genera enlaces de búsqueda inversa en Google, Yandex, TinEye y Bing.",
  },
  {
    id: "dorks",
    label: "Generador de Dorks",
    description: "Construye operadores de búsqueda avanzada de Google.",
  },
  {
    id: "subdomain",
    label: "Escáner de Subdominios",
    description: "Descubre subdominios vía Certificate Transparency (crt.sh).",
  },
  {
    id: "document",
    label: "Metadatos de Documentos",
    description: "Extrae metadatos de PDF, Word y Excel (autor, fechas, software).",
  },
  {
    id: "hibp",
    label: "Filtraciones HIBP",
    description: "Comprueba correos en filtraciones con HaveIBeenPwned.",
  },
  {
    id: "pgp",
    label: "Claves PGP",
    description: "Busca claves públicas PGP asociadas a un email.",
  },
  {
    id: "history",
    label: "Historial",
    description: "Revisa y exporta tus investigaciones previas.",
  },
];
