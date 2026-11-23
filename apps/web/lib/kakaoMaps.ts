"use client";

export interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

export interface KakaoMapInstance {
  setCenter: (latlng: KakaoLatLng) => void;
  panTo: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  getLevel: () => number;
  setBounds: (bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void;
  addControl: (control: unknown, position: unknown) => void;
}

export interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
}

export interface KakaoOverlayLike {
  setMap: (map: KakaoMapInstance | null) => void;
}

export interface KakaoMapsNamespace {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  ZoomControl: new () => unknown;
  ControlPosition: { BOTTOMRIGHT: unknown };
  Circle: new (options: {
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle?: string;
    fillColor: string;
    fillOpacity: number;
  }) => KakaoOverlayLike;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement | string;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
  }) => KakaoOverlayLike;
  event: {
    addListener: (target: unknown, type: string, handler: (event: { latLng: KakaoLatLng }) => void) => void;
  };
}

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMapsNamespace;
    };
  }
}

let kakaoLoadPromise: Promise<KakaoMapsNamespace | null> | null = null;

export function getKakaoMapKey(): string {
  return (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "").trim();
}

export function loadKakaoMapsSdk(): Promise<KakaoMapsNamespace | null> {
  const key = getKakaoMapKey();
  if (!key || typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (window.kakao?.maps?.Map) {
    return Promise.resolve(window.kakao.maps);
  }
  if (kakaoLoadPromise) {
    return kakaoLoadPromise;
  }

  kakaoLoadPromise = new Promise((resolve) => {
    const existing = document.getElementById("doran-kakao-maps-sdk") as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(window.kakao?.maps || null));
      } else {
        resolve(null);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "doran-kakao-maps-sdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.onload = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(window.kakao?.maps || null));
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      kakaoLoadPromise = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return kakaoLoadPromise;
}
