"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { loadKakaoMapsSdk, type KakaoMapInstance, type KakaoOverlayLike } from "@/lib/kakaoMaps";
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
  const [engine, setEngine] = useState<"loading" | "kakao" | "leaflet">("loading");
  const kakaoMapRef = useRef<KakaoMapInstance | null>(null);
  const kakaoOverlaysRef = useRef<KakaoOverlayLike[]>([]);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let active = true;
    loadKakaoMapsSdk().then((ns) => {
      if (!active) return;
      setEngine(ns ? "kakao" : "leaflet");
    });
    return () => {
      active = false;
    };
  }, []);

  // Kakao Maps 렌더링
  useEffect(() => {
    if (engine !== "kakao" || !containerRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao.maps;
    if (!kakaoMapRef.current) {
      kakaoMapRef.current = new kakao.Map(containerRef.current, {
        center: new kakao.LatLng(center[0], center[1]),
        level: 5,
      });
      kakaoMapRef.current.addControl(new kakao.ZoomControl(), kakao.ControlPosition.BOTTOMRIGHT);
    }
    const map = kakaoMapRef.current;
    kakaoOverlaysRef.current.forEach((ov) => ov.setMap(null));
    kakaoOverlaysRef.current = [];

    const located = programs.filter((p) => p.location?.coordinates?.length === 2);
    const bounds = new kakao.LatLngBounds();

    located.forEach((p) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const pos = new kakao.LatLng(lat, lng);
      bounds.extend(pos);

      const link = document.createElement("a");
      link.href = `/programs/${p.id}`;
      link.style.cssText =
        "display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9999px;background:#ffffff;color:#111827;font-size:13px;font-weight:700;border:1.5px solid #cfd6df;box-shadow:0 3px 10px rgba(17,24,39,0.16);white-space:nowrap;text-decoration:none;";
      link.innerHTML = `<span style="width:8px;height:8px;border-radius:9999px;background:${color}"></span><span>${p.provider.slice(0, 10)}</span>`;

      const ov = new kakao.CustomOverlay({ position: pos, yAnchor: 0.5, content: link });
      ov.setMap(map);
      kakaoOverlaysRef.current.push(ov);
    });

    if (located.length > 0) {
      map.setBounds(bounds, 48, 48, 48, 48);
    }
  }, [engine, programs, center]);

  // Leaflet Fallback 렌더링
  useEffect(() => {
    if (engine !== "leaflet" || !containerRef.current) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(containerRef.current).setView(center, 13);
      L.tileLayer(CARTO_VOYAGER_TILE, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        maxZoom: 19,
      }).addTo(leafletMapRef.current);
    } else {
      leafletMapRef.current.setView(center, 13);
    }

    const map = leafletMapRef.current;
    const markers = L.layerGroup().addTo(map);
    const located = programs.filter((p) => p.location?.coordinates?.length === 2);

    located.forEach((p) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const icon = L.divIcon({
        className: "",
        iconSize: [128, 34],
        iconAnchor: [64, 17],
        html: `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:9999px;background:#ffffff;color:#111827;font-size:13px;font-weight:700;border:1.5px solid #cfd6df;box-shadow:0 2px 8px rgba(17,24,39,0.14);white-space:nowrap;"><span style="width:8px;height:8px;border-radius:9999px;background:${color}"></span><span>${p.provider.slice(0, 9)}</span></div>`,
      });
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(
        `<div style="min-width:200px;font-family:sans-serif">
          <div style="font-size:12px;font-weight:700;color:${color}">${CATEGORY_LABELS[p.category]}</div>
          <div style="font-size:14px;font-weight:700;margin:3px 0 4px">${p.title}</div>
          <div style="font-size:13px;color:#374151;margin-bottom:6px">${p.address || p.provider}</div>
          <a href="/programs/${p.id}" style="font-size:13px;font-weight:700;color:#0d6e6e">자세히 보기 →</a>
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
  }, [engine, programs, center]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="공공자원 위치 지도"
      className="h-[500px] w-full overflow-hidden rounded-2xl border border-[#dfe4ea] bg-[#eef1f5]"
    />
  );
}
