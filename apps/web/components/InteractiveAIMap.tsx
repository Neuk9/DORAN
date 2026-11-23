"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  loadKakaoMapsSdk,
  type KakaoMapInstance,
  type KakaoMapsNamespace,
  type KakaoOverlayLike,
} from "@/lib/kakaoMaps";
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
  const [engine, setEngine] = useState<"loading" | "kakao" | "leaflet">("loading");

  // Kakao refs
  const kakaoNsRef = useRef<KakaoMapsNamespace | null>(null);
  const kakaoMapRef = useRef<KakaoMapInstance | null>(null);
  const kakaoOverlaysRef = useRef<KakaoOverlayLike[]>([]);

  // Leaflet fallback refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletLayerRef = useRef<L.LayerGroup | null>(null);

  const onClickMapRef = useRef(onClickMapLocation);
  const onSelectProgramRef = useRef(onSelectProgram);
  const onSelectRegionRef = useRef(onSelectRegion);

  useEffect(() => {
    onClickMapRef.current = onClickMapLocation;
    onSelectProgramRef.current = onSelectProgram;
    onSelectRegionRef.current = onSelectRegion;
  }, [onClickMapLocation, onSelectProgram, onSelectRegion]);

  // 1) 엔진 결정: NEXT_PUBLIC_KAKAO_MAP_KEY가 있고 SDK 로드 성공 시 카카오맵, 아니면 Leaflet fallback
  useEffect(() => {
    let active = true;
    loadKakaoMapsSdk().then((ns) => {
      if (!active) return;
      if (ns) {
        kakaoNsRef.current = ns;
        setEngine("kakao");
      } else {
        setEngine("leaflet");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // 2A) 카카오맵 초기화
  useEffect(() => {
    if (engine !== "kakao" || !containerRef.current || !kakaoNsRef.current || kakaoMapRef.current) return;
    const kakao = kakaoNsRef.current;
    const map = new kakao.Map(containerRef.current, {
      center: new kakao.LatLng(anchor.lat, anchor.lng),
      level: 5,
    });
    map.addControl(new kakao.ZoomControl(), kakao.ControlPosition.BOTTOMRIGHT);
    kakao.event.addListener(map, "click", (evt) => {
      const lat = Number(evt.latLng.getLat().toFixed(5));
      const lng = Number(evt.latLng.getLng().toFixed(5));
      onClickMapRef.current(lat, lng);
    });
    kakaoMapRef.current = map;
    return () => {
      kakaoOverlaysRef.current.forEach((ov) => ov.setMap(null));
      kakaoOverlaysRef.current = [];
      kakaoMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // 2B) 카카오맵 마커 / 격차 버블 렌더링
  useEffect(() => {
    if (engine !== "kakao" || !kakaoNsRef.current || !kakaoMapRef.current) return;
    const kakao = kakaoNsRef.current;
    const map = kakaoMapRef.current;

    kakaoOverlaysRef.current.forEach((ov) => ov.setMap(null));
    kakaoOverlaysRef.current = [];

    const addOverlay = (ov: KakaoOverlayLike) => {
      ov.setMap(map);
      kakaoOverlaysRef.current.push(ov);
    };

    // 기준 생활권 반경 원
    addOverlay(
      new kakao.Circle({
        center: new kakao.LatLng(anchor.lat, anchor.lng),
        radius: 2500,
        strokeWeight: 1,
        strokeColor: "#0d6e6e",
        strokeOpacity: 0.45,
        strokeStyle: "dashed",
        fillColor: "#0d6e6e",
        fillOpacity: 0.05,
      }),
    );

    // 기준 위치 점
    addOverlay(
      new kakao.CustomOverlay({
        position: new kakao.LatLng(anchor.lat, anchor.lng),
        yAnchor: 0.5,
        zIndex: 10,
        content: `<div title="${escapeHtml(anchor.label)}" style="width:16px;height:16px;border-radius:9999px;background:#0d6e6e;border:3px solid #ffffff;box-shadow:0 0 0 4px rgba(13,110,110,0.22), 0 2px 6px rgba(0,0,0,0.25);"></div>`,
      }),
    );

    if (pendingPin) {
      addOverlay(
        new kakao.CustomOverlay({
          position: new kakao.LatLng(pendingPin.lat, pendingPin.lng),
          yAnchor: 0.5,
          zIndex: 25,
          content: `<div style="width:18px;height:18px;border-radius:9999px;background:#111827;border:3px solid #ffffff;box-shadow:0 0 0 5px rgba(17,24,39,0.22);"></div>`,
        }),
      );
    }

    if (mode === "gap") {
      regions.forEach((region) => {
        const [lng, lat] = region.center.coordinates;
        const color = getGapColor(region.scores.gapIndex);
        const isCurrent = region.admCd === selectedRegionAdmCd;
        const gapLabel =
          region.scores.gapIndex > 0 ? `+${region.scores.gapIndex}` : `${region.scores.gapIndex}`;

        addOverlay(
          new kakao.Circle({
            center: new kakao.LatLng(lat, lng),
            radius: Math.max(380, Math.min(750, 380 + Math.max(0, region.scores.gapIndex) * 6)),
            strokeWeight: isCurrent ? 3 : 2,
            strokeColor: isCurrent ? "#111827" : "#ffffff",
            strokeOpacity: 0.9,
            fillColor: color,
            fillOpacity: isCurrent ? 0.45 : 0.3,
          }),
        );

        const el = document.createElement("button");
        el.type = "button";
        el.style.cssText = `display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;font-weight:700;color:${
          isCurrent ? "#ffffff" : "#111827"
        };background:${isCurrent ? "#111827" : "rgba(255,255,255,0.96)"};padding:4px 10px;border-radius:999px;border:1.5px solid ${
          isCurrent ? "#111827" : "#dfe4ea"
        };white-space:nowrap;box-shadow:0 3px 10px rgba(17,24,39,0.16);`;
        el.innerHTML = `<span style="width:8px;height:8px;border-radius:999px;background:${color}"></span><span>${escapeHtml(
          region.dong,
        )}</span><span style="color:${isCurrent ? "#fda4af" : color}">${gapLabel}</span>`;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectRegionRef.current(region);
        };

        addOverlay(
          new kakao.CustomOverlay({
            position: new kakao.LatLng(lat, lng),
            yAnchor: 0.5,
            zIndex: isCurrent ? 20 : 12,
            content: el,
          }),
        );
      });
      return;
    }

    // mode === "resources"
    const located = programs.filter((p) => p.location?.coordinates?.length === 2);
    const bounds = new kakao.LatLngBounds();
    bounds.extend(new kakao.LatLng(anchor.lat, anchor.lng));
    let nearbyCount = 0;

    located.forEach((p, idx) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const active = p.id === selectedProgramId || p.id === hoveredProgramId;
      const label = shortPlaceLabel(p);

      const el = document.createElement("button");
      el.type = "button";
      el.title = `${CATEGORY_LABELS[p.category]} · ${p.title}`;
      el.style.cssText = `display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:9999px;background:${
        active ? "#111827" : "#ffffff"
      };color:${active ? "#ffffff" : "#111827"};font-size:13px;font-weight:700;border:1.5px solid ${
        active ? "#111827" : "#cfd6df"
      };box-shadow:${
        active ? "0 8px 20px rgba(17,24,39,0.3)" : "0 3px 10px rgba(17,24,39,0.15)"
      };white-space:nowrap;transform:${active ? "scale(1.06) translateY(-2px)" : "scale(1)"};transition:all 120ms ease;`;
      el.innerHTML = `<span style="width:8px;height:8px;border-radius:9999px;background:${color};flex-shrink:0"></span><span>${escapeHtml(
        label,
      )}</span>`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectProgramRef.current(p.id);
      };

      addOverlay(
        new kakao.CustomOverlay({
          position: new kakao.LatLng(lat, lng),
          yAnchor: 0.5,
          zIndex: active ? 30 : 15 - Math.min(idx, 10),
          content: el,
        }),
      );

      if (Math.abs(lat - anchor.lat) < 0.15 && Math.abs(lng - anchor.lng) < 0.15) {
        bounds.extend(new kakao.LatLng(lat, lng));
        nearbyCount += 1;
      }
    });

    if (nearbyCount > 0 && !selectedProgramId) {
      map.setBounds(bounds, 56, 40, 56, 40);
    }
  }, [
    engine,
    programs,
    regions,
    mode,
    anchor,
    pendingPin,
    selectedProgramId,
    hoveredProgramId,
    selectedRegionAdmCd,
  ]);

  // 카카오맵 선택/기준 이동
  useEffect(() => {
    if (engine !== "kakao" || !kakaoNsRef.current || !kakaoMapRef.current) return;
    const kakao = kakaoNsRef.current;
    const map = kakaoMapRef.current;
    if (selectedProgramId && mode === "resources") {
      const target = programs.find((p) => p.id === selectedProgramId);
      if (target?.location?.coordinates?.length === 2) {
        const [lng, lat] = target.location.coordinates;
        map.panTo(new kakao.LatLng(lat, lng));
      }
    }
  }, [engine, selectedProgramId, programs, mode]);

  useEffect(() => {
    if (engine !== "kakao" || !kakaoNsRef.current || !kakaoMapRef.current) return;
    kakaoMapRef.current.panTo(new kakaoNsRef.current.LatLng(anchor.lat, anchor.lng));
  }, [engine, anchor.lat, anchor.lng]);

  // 3A) Leaflet Fallback 초기화
  useEffect(() => {
    if (engine !== "leaflet" || !containerRef.current || leafletMapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView([anchor.lat, anchor.lng], 13);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(CARTO_VOYAGER_TILE, {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onClickMapRef.current(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    });

    leafletLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      leafletLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // 3B) Leaflet Fallback 렌더링
  useEffect(() => {
    if (engine !== "leaflet" || !leafletMapRef.current || !leafletLayerRef.current) return;
    const map = leafletMapRef.current;
    const layer = leafletLayerRef.current;
    layer.clearLayers();

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

    L.marker([anchor.lat, anchor.lng], {
      icon: L.divIcon({
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: `<div style="width:16px;height:16px;border-radius:9999px;background:#0d6e6e;border:3px solid #ffffff;box-shadow:0 0 0 4px rgba(13,110,110,0.18), 0 2px 6px rgba(0,0,0,0.22);"></div>`,
      }),
      zIndexOffset: 400,
    })
      .bindTooltip(`기준: ${escapeHtml(anchor.label)}`, { direction: "top", offset: [0, -10] })
      .addTo(layer);

    if (pendingPin) {
      L.marker([pendingPin.lat, pendingPin.lng], {
        icon: L.divIcon({
          className: "",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#111827;border:3px solid #ffffff;box-shadow:0 0 0 5px rgba(17,24,39,0.2);"></div>`,
        }),
        zIndexOffset: 950,
      }).addTo(layer);
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
          color: isCurrent ? "#111827" : "#ffffff",
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

        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            iconSize: [128, 30],
            iconAnchor: [64, -8],
            html: `<div style="display:inline-flex;align-items:center;gap:5px;pointer-events:none;font-size:13px;font-weight:700;color:${
              isCurrent ? "#ffffff" : "#111827"
            };background:${
              isCurrent ? "#111827" : "rgba(255,255,255,0.96)"
            };padding:3px 10px;border-radius:999px;border:1.5px solid ${
              isCurrent ? "#111827" : "#dfe4ea"
            };white-space:nowrap;box-shadow:0 2px 8px rgba(17,24,39,0.12)"><span style="width:8px;height:8px;border-radius:999px;background:${color}"></span>${escapeHtml(
              region.dong,
            )} <span style="color:${isCurrent ? "#fda4af" : color}">${gapLabel}</span></div>`,
          }),
          interactive: false,
          zIndexOffset: isCurrent ? 600 : 200,
        }).addTo(layer);
      });
      return;
    }

    const located = programs.filter((p) => p.location?.coordinates?.length === 2);
    located.forEach((p, idx) => {
      if (!p.location) return;
      const [lng, lat] = p.location.coordinates;
      const color = PIN_COLOR[p.category];
      const active = p.id === selectedProgramId || p.id === hoveredProgramId;
      const label = shortPlaceLabel(p);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          iconSize: [136, 36],
          iconAnchor: [68, 18],
          html: `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:9999px;background:${
            active ? "#111827" : "#ffffff"
          };color:${active ? "#ffffff" : "#111827"};font-size:13px;font-weight:700;border:1.5px solid ${
            active ? "#111827" : "#cfd6df"
          };box-shadow:${
            active ? "0 6px 18px rgba(17,24,39,0.28)" : "0 2px 8px rgba(17,24,39,0.14)"
          };white-space:nowrap;transform:${
            active ? "scale(1.06) translateY(-2px)" : "scale(1)"
          };transition:all 140ms ease;"><span style="width:8px;height:8px;border-radius:9999px;background:${color};flex-shrink:0"></span><span>${escapeHtml(
            label,
          )}</span></div>`,
        }),
        zIndexOffset: active ? 900 : 100 - idx,
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
    });

    if (located.length > 0 && !selectedProgramId) {
      const nearbyPoints: [number, number][] = [[anchor.lat, anchor.lng]];
      located.forEach((p) => {
        if (!p.location) return;
        const [lng, lat] = p.location.coordinates;
        if (Math.abs(lat - anchor.lat) < 0.15 && Math.abs(lng - anchor.lng) < 0.15) {
          nearbyPoints.push([lat, lng]);
        }
      });
      if (nearbyPoints.length > 1) {
        map.fitBounds(L.latLngBounds(nearbyPoints), { padding: [44, 44], maxZoom: 14 });
      }
    }
  }, [
    engine,
    programs,
    regions,
    mode,
    anchor,
    pendingPin,
    selectedProgramId,
    hoveredProgramId,
    selectedRegionAdmCd,
  ]);

  useEffect(() => {
    if (engine !== "leaflet" || !leafletMapRef.current || !selectedProgramId || mode !== "resources") return;
    const target = programs.find((p) => p.id === selectedProgramId);
    if (target?.location?.coordinates?.length === 2) {
      const [lng, lat] = target.location.coordinates;
      leafletMapRef.current.flyTo([lat, lng], Math.max(leafletMapRef.current.getZoom(), 14), {
        duration: 0.4,
      });
    }
  }, [engine, selectedProgramId, programs, mode]);

  useEffect(() => {
    if (engine !== "leaflet" || !leafletMapRef.current) return;
    leafletMapRef.current.flyTo([anchor.lat, anchor.lng], 13, { duration: 0.4 });
  }, [engine, anchor.lat, anchor.lng]);

  return (
    <div
      ref={containerRef}
      aria-label={engine === "kakao" ? "카카오맵 공공자원 지도" : "공공자원 지도"}
      className="h-full w-full"
    />
  );
}
