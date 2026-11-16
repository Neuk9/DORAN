"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import type { Program } from "@/lib/api";

type Props = { programs: Program[] };

export function MapView({ programs }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([35.85, 128.6], 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      programs
        .filter((program) => program.lat != null && program.lng != null)
        .slice(0, 30)
        .forEach((program) => {
          const marker = L.circleMarker([program.lat as number, program.lng as number], {
            radius: 7,
          }).addTo(map as import("leaflet").Map);
          const label = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = program.title;
          label.appendChild(title);
          label.appendChild(document.createElement("br"));
          label.appendChild(document.createTextNode(program.provider ?? ""));
          marker.bindPopup(label);
        });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [programs]);

  return (
    <div
      ref={ref}
      aria-label="자원 지도"
      role="img"
      style={{ height: "320px", borderRadius: "12px", marginTop: "1rem" }}
    />
  );
}
