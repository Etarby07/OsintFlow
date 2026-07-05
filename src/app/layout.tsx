import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OsintFlow — Panel de Inteligencia de Fuentes Abiertas",
  description:
    "OsintFlow es un panel OSINT centralizado para buscar usuarios, analizar emails, reconocer IPs y dominios, localizar teléfonos y extraer metadatos EXIF.",
  keywords: [
    "OSINT",
    "inteligencia",
    "ciberseguridad",
    "Sherlock",
    "WHOIS",
    "DNS",
    "EXIF",
    "investigación",
  ],
  authors: [{ name: "OsintFlow" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
