"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addSavedProgram,
  fetchNearestRegion,
  fetchRegions,
  fetchSavedChecklist,
  removeSavedProgram,
} from "@/lib/api";
import type { Program, RegionStat } from "@/lib/types";

export interface GpsLocation {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "pin";
}

interface ToastState {
  message: string;
  href?: string;
  hrefLabel?: string;
}

export type RoleMode = "citizen" | "officer";

interface AppContextValue {
  roleMode: RoleMode;
  setRoleMode: (mode: RoleMode) => void;
  regions: RegionStat[];
  selectedAdmCd: string;
  setSelectedAdmCd: (admCd: string) => void;
  selectedRegion: RegionStat | undefined;
  userCoords: GpsLocation | null;
  setUserCoords: (coords: GpsLocation | null) => void;
  locating: boolean;
  locateMe: () => Promise<GpsLocation | null>;
  largeText: boolean;
  toggleLargeText: () => void;
  sessionId: string;
  savedItems: Program[];
  savedIds: Set<string>;
  toggleSave: (programId: string) => Promise<void>;
  refreshSaved: () => Promise<void>;
  // 비교함 (최대 3건)
  compareList: Program[];
  toggleCompare: (program: Program) => void;
  clearCompare: () => void;
  // 준비 서류 체크 상태 (programId -> docName[])
  checkedDocs: Record<string, string[]>;
  toggleDocCheck: (programId: string, docName: string) => void;
  // 최근 검색 기록
  recentQueries: string[];
  addRecentQuery: (query: string) => void;
  removeRecentQuery: (query: string) => void;
  showToast: (toast: ToastState) => void;
}

const DEFAULT_ADM_CD = "1153054000";
const AppContext = createContext<AppContextValue | null>(null);

function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem("doran_session_id");
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `doran-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem("doran_session_id", generated);
  return generated;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [roleMode, setRoleModeState] = useState<RoleMode>("citizen");
  const [regions, setRegions] = useState<RegionStat[]>([]);
  const [selectedAdmCd, setSelectedAdmCdState] = useState<string>(DEFAULT_ADM_CD);
  const [userCoords, setUserCoords] = useState<GpsLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [savedItems, setSavedItems] = useState<Program[]>([]);
  const [compareList, setCompareList] = useState<Program[]>([]);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, string[]>>({});
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const savedAdm = window.localStorage.getItem("doran_adm_cd");
    if (savedAdm) setSelectedAdmCdState(savedAdm);

    const savedLarge = window.localStorage.getItem("doran_large_text") === "true";
    setLargeText(savedLarge);
    document.documentElement.dataset.largeText = savedLarge ? "true" : "false";

    try {
      const storedDocs = window.localStorage.getItem("doran_checked_docs");
      if (storedDocs) setCheckedDocs(JSON.parse(storedDocs) as Record<string, string[]>);
    } catch {
      // ignore invalid JSON
    }

    try {
      const storedQueries = window.localStorage.getItem("doran_recent_queries");
      if (storedQueries) setRecentQueries(JSON.parse(storedQueries) as string[]);
    } catch {
      // ignore
    }

    const sid = getOrCreateSessionId();
    setSessionId(sid);

    fetchRegions()
      .then((list) => setRegions(list))
      .catch(() => setRegions([]));

    fetchSavedChecklist(sid)
      .then((res) => setSavedItems(res.items))
      .catch(() => setSavedItems([]));
  }, []);

  const setRoleMode = useCallback(
    (mode: RoleMode) => {
      setRoleModeState(mode);
      showToast({
        message:
          mode === "officer"
            ? "주민센터 상담 보조 모드로 전환했어요. 1장 안내지 출력이 가능합니다."
            : "일반 주민 모드로 전환했어요.",
      });
    },
    [showToast],
  );

  const setSelectedAdmCd = useCallback((admCd: string) => {
    setSelectedAdmCdState(admCd);
    setUserCoords(null);
    window.localStorage.setItem("doran_adm_cd", admCd);
  }, []);

  const locateMe = useCallback(async (): Promise<GpsLocation | null> => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      showToast({ message: "이 브라우저에서는 위치 확인을 지원하지 않아요." });
      return null;
    }

    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        });
      });

      const lat = Number(pos.coords.latitude.toFixed(5));
      const lng = Number(pos.coords.longitude.toFixed(5));

      try {
        const nearest = await fetchNearestRegion(lat, lng);
        if (nearest.inServiceArea) {
          setSelectedAdmCdState(nearest.region.admCd);
          window.localStorage.setItem("doran_adm_cd", nearest.region.admCd);
          const nextLoc: GpsLocation = {
            lat,
            lng,
            label: `내 현재 위치 (${nearest.region.sigungu} ${nearest.region.dong} 인근)`,
            source: "gps",
          };
          setUserCoords(nextLoc);
          showToast({ message: `현재 위치(${nearest.region.dong} 인근)로 맞췄어요.` });
          return nextLoc;
        }
        const nextLoc: GpsLocation = {
          lat,
          lng,
          label: "내 현재 위치 (시범 권역 외 · 전국 자원 우선)",
          source: "gps",
        };
        setUserCoords(nextLoc);
        showToast({
          message: `현재 위치가 시범 권역(${nearest.region.sigungu}) 밖이에요. 동네 선택이나 지도 클릭으로 바꿀 수 있어요.`,
        });
        return nextLoc;
      } catch {
        const nextLoc: GpsLocation = { lat, lng, label: "내 현재 위치", source: "gps" };
        setUserCoords(nextLoc);
        showToast({ message: "현재 GPS 위치로 기준을 잡았어요." });
        return nextLoc;
      }
    } catch {
      showToast({
        message: "위치 권한을 확인할 수 없어요. 동네 선택이나 지도 클릭을 이용해 주세요.",
      });
      return null;
    } finally {
      setLocating(false);
    }
  }, [showToast]);

  const toggleLargeText = useCallback(() => {
    setLargeText((prev) => {
      const next = !prev;
      window.localStorage.setItem("doran_large_text", String(next));
      document.documentElement.dataset.largeText = next ? "true" : "false";
      return next;
    });
  }, []);

  const refreshSaved = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetchSavedChecklist(sessionId);
    setSavedItems(res.items);
  }, [sessionId]);

  const savedIds = new Set(savedItems.map((item) => item.id));

  const toggleSave = useCallback(
    async (programId: string) => {
      const sid = sessionId || getOrCreateSessionId();
      if (!sessionId) setSessionId(sid);
      const exists = savedItems.some((item) => item.id === programId);
      const updated = exists
        ? await removeSavedProgram(sid, programId)
        : await addSavedProgram(sid, programId);
      setSavedItems(updated.items);
      showToast(
        exists
          ? { message: "체크리스트에서 뺐어요." }
          : { message: "체크리스트에 저장했어요.", href: "/saved", hrefLabel: "목록 보기" },
      );
    },
    [sessionId, savedItems, showToast],
  );

  const toggleCompare = useCallback(
    (program: Program) => {
      setCompareList((prev) => {
        const exists = prev.some((p) => p.id === program.id);
        if (exists) {
          return prev.filter((p) => p.id !== program.id);
        }
        if (prev.length >= 3) {
          showToast({ message: "비교함에는 최대 3개까지 담을 수 있어요." });
          return prev;
        }
        showToast({ message: `'${program.title.slice(0, 16)}…' 비교함에 담았어요.` });
        return [...prev, program];
      });
    },
    [showToast],
  );

  const clearCompare = useCallback(() => setCompareList([]), []);

  const toggleDocCheck = useCallback((programId: string, docName: string) => {
    setCheckedDocs((prev) => {
      const current = prev[programId] || [];
      const nextList = current.includes(docName)
        ? current.filter((d) => d !== docName)
        : [...current, docName];
      const next = { ...prev, [programId]: nextList };
      window.localStorage.setItem("doran_checked_docs", JSON.stringify(next));
      return next;
    });
  }, []);

  const addRecentQuery = useCallback((query: string) => {
    const clean = query.trim();
    if (!clean) return;
    setRecentQueries((prev) => {
      const next = [clean, ...prev.filter((q) => q !== clean)].slice(0, 5);
      window.localStorage.setItem("doran_recent_queries", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeRecentQuery = useCallback((query: string) => {
    setRecentQueries((prev) => {
      const next = prev.filter((q) => q !== query);
      window.localStorage.setItem("doran_recent_queries", JSON.stringify(next));
      return next;
    });
  }, []);

  const selectedRegion = regions.find((r) => r.admCd === selectedAdmCd) || regions[0];

  return (
    <AppContext.Provider
      value={{
        roleMode,
        setRoleMode,
        regions,
        selectedAdmCd,
        setSelectedAdmCd,
        selectedRegion,
        userCoords,
        setUserCoords,
        locating,
        locateMe,
        largeText,
        toggleLargeText,
        sessionId,
        savedItems,
        savedIds,
        toggleSave,
        refreshSaved,
        compareList,
        toggleCompare,
        clearCompare,
        checkedDocs,
        toggleDocCheck,
        recentQueries,
        addRecentQuery,
        removeRecentQuery,
        showToast,
      }}
    >
      {children}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#191f28] px-5 py-3 text-sm font-semibold text-white shadow-xl md:bottom-7"
        >
          <span>{toast.message}</span>
          {toast.href && toast.hrefLabel ? (
            <Link href={toast.href} className="font-bold text-teal-300 underline underline-offset-2">
              {toast.hrefLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
