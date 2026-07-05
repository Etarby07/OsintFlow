// Shared types for OsintFlow tools
export type ToolId =
  | "dashboard"
  // People & identity
  | "user"
  | "email"
  | "phone"
  | "pgp"
  | "pep"
  | "emailgen"
  // Infrastructure & network
  | "ipdomain"
  | "anonymity"
  | "subdomain"
  | "whoishistory"
  | "techstack"
  | "headers"
  | "dirbuster"
  // Content & files
  | "exif"
  | "document"
  | "stego"
  | "image"
  | "webcam"
  // Leaks & dark web
  | "hibp"
  | "pastebin"
  | "darkweb"
  // Links & search
  | "link"
  | "dorks"
  | "decoder"
  // Tracking & location
  | "wifi"
  | "tracking"
  | "callerid"
  // System
  | "history"
  | "settings";

export type ToolCategory =
  | "Personas e Identidad"
  | "Infraestructura y Red"
  | "Contenido y Archivos"
  | "Fugas y Dark Web"
  | "Búsqueda y Enlaces"
  | "Localización y Seguimiento"
  | "Sistema";

export interface ToolMeta {
  id: ToolId;
  label: string;
  description: string;
  category: ToolCategory;
}

export const TOOLS: ToolMeta[] = [
  {
    id: "dashboard",
    label: "Panel",
    description: "Resumen general de OsintFlow",
    category: "Sistema",
  },
  // People & identity
  {
    id: "user",
    label: "Búsqueda de Usuario",
    description: "Encuentra perfiles en redes sociales a partir de un alias.",
    category: "Personas e Identidad",
  },
  {
    id: "email",
    label: "Análisis de Email",
    description: "Comprueba filtraciones y registros de un correo.",
    category: "Personas e Identidad",
  },
  {
    id: "phone",
    label: "Teléfono",
    description: "País, operador y asociación con apps de mensajería.",
    category: "Personas e Identidad",
  },
  {
    id: "callerid",
    label: "Spam y Caller ID",
    description: "Identifica quién llama y si el número es spam.",
    category: "Personas e Identidad",
  },
  {
    id: "pgp",
    label: "Claves PGP",
    description: "Busca claves públicas PGP asociadas a un email.",
    category: "Personas e Identidad",
  },
  {
    id: "pep",
    label: "PEP y Sanciones",
    description: "Busca personas en listas PEP y de sanciones.",
    category: "Personas e Identidad",
  },
  {
    id: "emailgen",
    label: "Generador de Emails",
    description: "Genera y verifica combinaciones de email por SMTP.",
    category: "Personas e Identidad",
  },
  // Infrastructure & network
  {
    id: "ipdomain",
    label: "IP y Dominio",
    description: "WHOIS, DNS, geolocalización en mapa y detección de WAF.",
    category: "Infraestructura y Red",
  },
  {
    id: "anonymity",
    label: "Detector de Anonimato",
    description: "Detecta VPN, proxy, Tor o hosting en una IP.",
    category: "Infraestructura y Red",
  },
  {
    id: "subdomain",
    label: "Escáner de Subdominios",
    description: "Descubre subdominios vía Certificate Transparency (crt.sh).",
    category: "Infraestructura y Red",
  },
  {
    id: "whoishistory",
    label: "Historial WHOIS",
    description: "Historial de IPs y DNS inversa de un dominio.",
    category: "Infraestructura y Red",
  },
  {
    id: "techstack",
    label: "Tecnologías Web",
    description: "Detecta el stack tecnológico de una web (Wappalyzer-like).",
    category: "Infraestructura y Red",
  },
  {
    id: "headers",
    label: "Cabeceras de Seguridad",
    description: "Analiza HSTS, CSP y otras cabeceras HTTP de seguridad.",
    category: "Infraestructura y Red",
  },
  {
    id: "dirbuster",
    label: "Directorios Expuestos",
    description: "Busca rutas comunes expuestas (/admin, /.git, /backup...).",
    category: "Infraestructura y Red",
  },
  // Content & files
  {
    id: "exif",
    label: "Metadatos EXIF",
    description: "Extrae metadatos ocultos de imágenes (GPS, cámara...).",
    category: "Contenido y Archivos",
  },
  {
    id: "document",
    label: "Metadatos de Documentos",
    description: "Extrae metadatos de PDF, Word y Excel (autor, fechas, software).",
    category: "Contenido y Archivos",
  },
  {
    id: "stego",
    label: "Esteganografía",
    description: "Analiza el plano LSB de imágenes para detectar mensajes ocultos.",
    category: "Contenido y Archivos",
  },
  {
    id: "image",
    label: "Búsqueda Inversa de Imágenes",
    description: "Enlaces de búsqueda inversa en Google, Yandex, TinEye y Bing.",
    category: "Contenido y Archivos",
  },
  {
    id: "webcam",
    label: "Cámaras Web Públicas",
    description: "Dorks para encontrar cámaras IP y streams públicos.",
    category: "Contenido y Archivos",
  },
  // Leaks & dark web
  {
    id: "hibp",
    label: "Filtraciones HIBP",
    description: "Comprueba correos en filtraciones con HaveIBeenPwned.",
    category: "Fugas y Dark Web",
  },
  {
    id: "pastebin",
    label: "Pastebin y Gists",
    description: "Busca si un término aparece en Pastebin o GitHub Gists.",
    category: "Fugas y Dark Web",
  },
  {
    id: "darkweb",
    label: "Dark Web (Ahmia)",
    description: "Busca en la red Tor a través del motor Ahmia.",
    category: "Fugas y Dark Web",
  },
  // Links & search
  {
    id: "link",
    label: "Analizador de Enlaces",
    description: "Sigue redirecciones de URLs acortadas y consulta Wayback.",
    category: "Búsqueda y Enlaces",
  },
  {
    id: "dorks",
    label: "Generador de Dorks",
    description: "Construye operadores de búsqueda avanzada de Google.",
    category: "Búsqueda y Enlaces",
  },
  {
    id: "decoder",
    label: "Decodificador Universal",
    description: "Decodifica/codifica Base64, Hex, URL, hashes y ROT13.",
    category: "Búsqueda y Enlaces",
  },
  // Tracking & location
  {
    id: "wifi",
    label: "Geolocalizador Wi-Fi",
    description: "Localiza redes Wi-Fi por SSID/BSSID vía WiGLE.",
    category: "Localización y Seguimiento",
  },
  {
    id: "tracking",
    label: "Vuelos y Barcos",
    description: "Rastrea vuelos (OpenSky) y barcos (MMSI) en tiempo real.",
    category: "Localización y Seguimiento",
  },
  // System
  {
    id: "history",
    label: "Historial",
    description: "Revisa y exporta tus investigaciones previas.",
    category: "Sistema",
  },
  {
    id: "settings",
    label: "Ajustes",
    description: "Configuración, información y créditos.",
    category: "Sistema",
  },
];

// Category order for the sidebar
export const CATEGORY_ORDER: ToolCategory[] = [
  "Sistema",
  "Personas e Identidad",
  "Infraestructura y Red",
  "Contenido y Archivos",
  "Fugas y Dark Web",
  "Búsqueda y Enlaces",
  "Localización y Seguimiento",
];
