"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { CATEGORY_LABELS, type Program } from "@/lib/types";

interface ExploreMapProps {
  programs: Program[];
  center?: [number, number];
}

const PIN_COLOR = {
  welfare: "#059669",
  education: "#2563eb",
  culture: "#d97706",
};

const CARTO_VOYAGER_TILE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export default function ExploreMap({ programs, center = [37.492, 126.888] }: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView(center, 13);
      L.tileLayer(CARTO_VOYAGER_TILE, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        maxZoom: 19,
      }).addTo(mapRef.current);
    } else {
      mapRef.current.setView(center, 13);
    }

    const map = mapRef.current;
    const markers = L.layerGroup().addTo(map);

    const located = programs.filter((p) => p.location?.coordinates?.length === 2);
    located.forEach((p) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const icon = L.divIcon({
        className: "",
        iconSize: [110, 30],
        iconAnchor: [55, 15],
        html: `<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:9999px;background:#ffffff;color:#191f28;font-size:11.5px;font-weight:700;border:1.5px solid #d1d6db;box-shadow:0 2px 8px rgba(25,31,40,0.14);white-space:nowrap;"><span style="width:7px;height:7px;border-radius:9999px;background:${color}"></span><span>${p.provider.slice(0, 9)}</span></div>`,
      });
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(
        `<div style="min-width:190px;font-family:sans-serif">
          <div style="font-size:11px;font-weight:700;color:${color}">${CATEGORY_LABELS[p.category]}</div>
          <div style="font-size:13px;font-weight:700;margin:2px 0 4px">${p.title}</div>
          <div style="font-size:12px;color:#4e5968;margin-bottom:6px">${p.address || p.provider}</div>
          <a href="/programs/${p.id}" style="font-size:12px;font-weight:700;color:#0d6e6e">자세히 보기 →</a>
        </div>`,
      );
      marker.addTo(markers);
    });

    if (located.length > 0) {
      const bounds = L.latLngBounds(
        located.map((p) => [p.location!.coordinates[1], p.location!.coordinates[0]] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    }

    return () => {
      markers.remove();
    };
  }, [programs, center]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="공공자원 위치 지도"
      className="h-[460px] w-full overflow-hidden rounded-2xl border border-[#e5e8eb] bg-[#eef1f5]"
    />
  );
}
