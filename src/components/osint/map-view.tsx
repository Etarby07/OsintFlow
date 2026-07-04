"use client";

import { useEffect, useRef } from "react";

interface MapViewProps {
  lat: number;
  lon: number;
  label?: string;
  className?: string;
}

/**
 * Minimalist dark-themed Leaflet map. Loads Leaflet dynamically inside
 * useEffect to avoid any window references during SSR.
 */
export function MapView({ lat, lon, label, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      // Fix default marker icon paths (bundled by Leaflet).
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(containerRef.current, {
        center: [lat, lon],
        zoom: 11,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      // CartoDB Dark Matter — clean black/grey tiles, fits OsintFlow theme.
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      const marker = L.marker([lat, lon]).addTo(map);
      if (label) marker.bindPopup(label);
    }

    init();
    mapRef.current = map;

    return () => {
      cancelled = true;
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
  }, [lat, lon]);

  return (
    <div
      ref={containerRef}
      className={`rounded-md border border-border overflow-hidden h-64 w-full ${className ?? ""}`}
      role="application"
      aria-label="Mapa de geolocalización"
    />
  );
}
