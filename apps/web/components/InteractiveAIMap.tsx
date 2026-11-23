"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { CATEGORY_LABELS, type Program, type RegionStat } from "@/lib/types";

export interface MapAnchor {
  lat: number;
  lng: number;
  label: string;
}

interface InteractiveAIMapProps {
  programs: Program[];
  regions: RegionStat[];
  mode: "resources" | "gap";
  anchor: MapAnchor;
  pendingPin: { lat: number; lng: number } | null;
  selectedProgramId: string | null;
  hoveredProgramId: string | null;
  selectedRegionAdmCd: string;
  onSelectProgram: (programId: string) => void;
  onClickMapLocation: (lat: number, lng: number) => void;
  onSelectRegion: (region: RegionStat) => void;
}

const PIN_COLOR: Record<Program["category"], string> = {
  welfare: "#059669",
  education: "#2563eb",
  culture: "#d97706",
};

const CARTO_VOYAGER_TILE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortPlaceLabel(program: Program): string {
  const base = program.provider.replace(/구로구\s*|서울특별시\s*|구로문화재단\s*|구로구립\s*/g, "").trim();
  const text = base || program.title;
  return text.length > 10 ? `${text.slice(0, 10)}…` : text;
}

function getGapColor(gapIndex: number): string {
  if (gapIndex >= 30) return "#e11d48";
  if (gapIndex > 0) return "#d97706";
  return "#059669";
}

export default function InteractiveAIMap({
  programs,
  regions,
  mode,
  anchor,
  pendingPin,
  selectedProgramId,
  hoveredProgramId,
  selectedRegionAdmCd,
  onSelectProgram,
  onClickMapLocation,
  onSelectRegion,
}: InteractiveAIMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const onClickMapRef = useRef(onClickMapLocation);
  const onSelectProgramRef = useRef(onSelectProgram);
  const onSelectRegionRef = useRef(onSelectRegion);

  useEffect(() => {
    onClickMapRef.current = onClickMapLocation;
    onSelectProgramRef.current = onSelectProgram;
    onSelectRegionRef.current = onSelectRegion;
  }, [onClickMapLocation, onSelectProgram, onSelectRegion]);

  // 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView([anchor.lat, anchor.lng], 13);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(CARTO_VOYAGER_TILE, {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onClickMapRef.current(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커 / 격차 버블 렌더링
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerMapRef.current.clear();

    // 기준 생활권 반경 (2.5km)
    L.circle([anchor.lat, anchor.lng], {
      radius: 2500,
      color: "#0d6e6e",
      weight: 1,
      opacity: 0.45,
      dashArray: "5 6",
      fillColor: "#0d6e6e",
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(layer);

    // 기준 위치 점
    const anchorIcon = L.divIcon({
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: `<div style="width:16px;height:16px;border-radius:9999px;background:#0d6e6e;border:3px solid #ffffff;box-shadow:0 0 0 4px rgba(13,110,110,0.18), 0 2px 6px rgba(0,0,0,0.22);"></div>`,
    });
    L.marker([anchor.lat, anchor.lng], { icon: anchorIcon, zIndexOffset: 400 })
      .bindTooltip(`기준: ${escapeHtml(anchor.label)}`, { direction: "top", offset: [0, -10] })
      .addTo(layer);

    // 임시 클릭 핀 (사용자가 새 위치를 눌렀을 때)
    if (pendingPin) {
      const pendingIcon = L.divIcon({
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#191f28;border:3px solid #ffffff;box-shadow:0 0 0 5px rgba(25,31,40,0.2);"></div>`,
      });
      L.marker([pendingPin.lat, pendingPin.lng], { icon: pendingIcon, zIndexOffset: 950 }).addTo(layer);
    }

    if (mode === "gap") {
      regions.forEach((region) => {
        const [lng, lat] = region.center.coordinates;
        const color = getGapColor(region.scores.gapIndex);
        const isCurrent = region.admCd === selectedRegionAdmCd;
        const radius = Math.max(18, Math.min(34, 18 + Math.max(0, region.scores.gapIndex) * 0.28));

        const circle = L.circleMarker([lat, lng], {
          radius,
          fillColor: color,
          color: isCurrent ? "#191f28" : "#ffffff",
          weight: isCurrent ? 3 : 2,
          fillOpacity: isCurrent ? 0.88 : 0.72,
        });

        const gapLabel =
          region.scores.gapIndex > 0 ? `+${region.scores.gapIndex}` : `${region.scores.gapIndex}`;
        circle.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRegionRef.current(region);
        });
        circle.addTo(layer);

        const labelIcon = L.divIcon({
          className: "",
          iconSize: [128, 30],
          iconAnchor: [64, -8],
          html: `<div style="display:inline-flex;align-items:center;gap:5px;pointer-events:none;font-size:13px;font-weight:700;color:${
            isCurrent ? "#ffffff" : "#191f28"
          };background:${
            isCurrent ? "#191f28" : "rgba(255,255,255,0.96)"
          };padding:3px 10px;border-radius:999px;border:1.5px solid ${
            isCurrent ? "#191f28" : "#e5e8eb"
          };white-space:nowrap;box-shadow:0 2px 8px rgba(25,31,40,0.12)"><span style="width:8px;height:8px;border-radius:999px;background:${color}"></span>${escapeHtml(
            region.dong,
          )} <span style="color:${isCurrent ? "#fda4af" : color}">${gapLabel}</span></div>`,
        });
        L.marker([lat, lng], { icon: labelIcon, interactive: false, zIndexOffset: isCurrent ? 600 : 200 }).addTo(
          layer,
        );
      });
      return;
    }

    // mode === "resources": 화이트 캡슐 + 컬러 도트 + 기관명 핀
    const located = programs.filter((p) => p.location?.coordinates?.length === 2);
    located.forEach((p, idx) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const isSelected = p.id === selectedProgramId;
      const isHovered = p.id === hoveredProgramId;
      const active = isSelected || isHovered;
      const label = shortPlaceLabel(p);

      const icon = L.divIcon({
        className: "",
        iconSize: [136, 36],
        iconAnchor: [68, 18],
        html: `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:9999px;background:${
          active ? "#191f28" : "#ffffff"
        };color:${active ? "#ffffff" : "#191f28"};font-size:13px;font-weight:700;border:1.5px solid ${
          active ? "#191f28" : "#d1d6db"
        };box-shadow:${
          active ? "0 6px 18px rgba(25,31,40,0.28)" : "0 2px 8px rgba(25,31,40,0.14)"
        };white-space:nowrap;transform:${
          active ? "scale(1.06) translateY(-2px)" : "scale(1)"
        };transition:all 140ms ease;"><span style="width:8px;height:8px;border-radius:9999px;background:${color};flex-shrink:0"></span><span>${escapeHtml(
          label,
        )}</span></div>`,
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 900 : isHovered ? 800 : 100 - idx,
      });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectProgramRef.current(p.id);
      });

      marker.bindTooltip(`${CATEGORY_LABELS[p.category]} · ${escapeHtml(p.title)}`, {
        direction: "top",
        offset: [0, -14],
      });

      marker.addTo(layer);
      markerMapRef.current.set(p.id, marker);
    });
  }, [
    programs,
    regions,
    mode,
    anchor,
    pendingPin,
    selectedProgramId,
    hoveredProgramId,
    selectedRegionAdmCd,
  ]);

  // 선택된 카드로 부드럽게 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedProgramId || mode !== "resources") return;
    const target = programs.find((p) => p.id === selectedProgramId);
    if (target?.location?.coordinates?.length === 2) {
      const [lng, lat] = target.location.coordinates;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.4 });
    }
  }, [selectedProgramId, programs, mode]);

  // 기준 위치 변경 시 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([anchor.lat, anchor.lng], 13, { duration: 0.4 });
  }, [anchor.lat, anchor.lng]);

  return (
    <div
      ref={containerRef}
      aria-label="도란도란 인터랙티브 공공자원 및 지역격차 지도"
      className="h-full w-full"
    />
  );
}
