"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bookmark,
  Building2,
  Check,
  Clock,
  Crosshair,
  Globe,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  PhoneCall,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { BenefitPlanPanel } from "@/components/BenefitPlanPanel";
import { ExcludedTransparencyPanel } from "@/components/ExcludedTransparencyPanel";
import type { MapAnchor } from "@/components/InteractiveAIMap";
import { OfficerGuideModal } from "@/components/OfficerGuideModal";
import { ProgramDetailDrawer } from "@/components/ProgramDetailDrawer";
import { fetchPrograms, postChatRecommend } from "@/lib/api";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  formatDeadlineBadge,
  formatDistanceWithWalk,
  type CategoryType,
  type ChatRecommendResponse,
  type Program,
  type RecommendedProgram,
  type RegionStat,
  type UserProfile,
} from "@/lib/types";

const InteractiveAIMap = dynamic(() => import("@/components/InteractiveAIMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[460px] w-full items-center justify-center rounded-3xl bg-[#eef1f5] text-sm text-[#8b95a1]">
      지도를 준비하고 있습니다…
    </div>
  ),
});

const ROTATING_PLACEHOLDERS = [
  "예: 서울 구로구에 사는 20대 대학생인데, 주말에 무료로 악기를 배울 수 있는 곳이나 청년 지원금이 있을까?",
  "예: 가리봉동에 혼자 사는 70세 어르신인데 돌봄 서비스나 무료 스마트폰 교실이 궁금해요",
  "예: 개봉동 맞벌이 가족인데 아이돌봄 서비스나 주말에 아이와 갈 도서관 프로그램 알려줘",
  "예: 저소득 가구인데 난방비 바우처나 문화누리카드 혜택을 받을 수 있을까요?",
];

const EXAMPLE_CARDS = [
  {
    tag: "청년 · 문화·복지",
    title: "주말에 무료로 악기 배울 곳이나 청년 지원금",
    query:
      "서울 구로구에 사는 20대 대학생인데, 주말에 무료로 악기를 배울 수 있는 곳이나 청년 지원금이 있을까?",
  },
  {
    tag: "어르신 · 돌봄·교육",
    title: "독거 어르신 돌봄 서비스와 무료 스마트폰 교실",
    query: "가리봉동에 사는 70세 독거 어르신인데 돌봄 서비스나 무료 스마트폰 교육이 궁금해요",
  },
  {
    tag: "저소득 · 생활지원",
    title: "난방비 바우처와 문화누리카드 신청 가능 여부",
    query: "저소득 가구인데 난방비 지원이나 문화누리카드 같은 혜택을 받을 수 있나요?",
  },
  {
    tag: "가족 · 아동돌봄",
    title: "맞벌이 가정 아이돌봄과 주말 어린이 도서관",
    query: "개봉동 맞벌이 가족인데 아이돌봄 서비스나 주말 어린이 도서관 프로그램 있을까요?",
  },
];

const AGE_PRESETS = [
  { label: "20대", age: 24, groups: ["youth", "student"] },
  { label: "30대", age: 33, groups: ["youth"] },
  { label: "40~50대", age: 45, groups: ["family"] },
  { label: "65세+", age: 68, groups: ["senior"] },
];

const CATEGORY_DOT: Record<CategoryType, string> = {
  welfare: "bg-emerald-600",
  education: "bg-blue-600",
  culture: "bg-amber-600",
};

type SortKey = "relevance" | "distance" | "deadline";

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function HomeAISearchPage() {
  const {
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
    savedIds,
    toggleSave,
    compareList,
    toggleCompare,
    recentQueries,
    addRecentQuery,
    removeRecentQuery,
    showToast,
  } = useApp();

  const [query, setQuery] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [mapMode, setMapMode] = useState<"resources" | "gap">("resources");
  const [resultTab, setResultTab] = useState<"all" | "map" | "online">("all");
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);

  const [basePrograms, setBasePrograms] = useState<Program[]>([]);
  const [aiResult, setAiResult] = useState<ChatRecommendResponse | null>(null);
  const [editableProfile, setEditableProfile] = useState<UserProfile | null>(null);
  const [drawerProgramId, setDrawerProgramId] = useState<string | null>(null);
  const [hoveredProgramId, setHoveredProgramId] = useState<string | null>(null);
  const [focusedMapProgramId, setFocusedMapProgramId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userCoords) {
      fetchPrograms({
        lat: userCoords.lat,
        lng: userCoords.lng,
        radiusKm: 5,
        includeOnline: true,
        limit: 20,
      })
        .then(setBasePrograms)
        .catch(() => setBasePrograms([]));
      return;
    }
    const region = regions.find((r) => r.admCd === selectedAdmCd);
    if (region) {
      fetchPrograms({
        lat: region.center.coordinates[1],
        lng: region.center.coordinates[0],
        radiusKm: 5,
        includeOnline: true,
        limit: 20,
      })
        .then(setBasePrograms)
        .catch(() => setBasePrograms([]));
    } else {
      fetchPrograms({ admCd: selectedAdmCd, limit: 20 })
        .then(setBasePrograms)
        .catch(() => setBasePrograms([]));
    }
  }, [selectedAdmCd, userCoords, regions]);

  const anchor: MapAnchor = useMemo(() => {
    if (userCoords) {
      return { lat: userCoords.lat, lng: userCoords.lng, label: userCoords.label };
    }
    if (selectedRegion) {
      return {
        lat: selectedRegion.center.coordinates[1],
        lng: selectedRegion.center.coordinates[0],
        label: `${selectedRegion.sigungu} ${selectedRegion.dong}`,
      };
    }
    return { lat: 37.4852, lng: 126.8965, label: "구로구 구로3동" };
  }, [userCoords, selectedRegion]);

  const runSearch = useCallback(
    async (
      message: string,
      opts?: {
        overrideProfile?: UserProfile;
        pin?: { lat: number; lng: number } | null;
        admCd?: string;
        skipHistory?: boolean;
      },
    ) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      setMapMode("resources");
      setResultTab("all");
      if (!opts?.skipHistory && trimmed !== "조건 재검색") {
        addRecentQuery(trimmed);
      }
      try {
        const activePin = opts?.pin !== undefined ? opts.pin : userCoords;
        const data = await postChatRecommend({
          message: trimmed,
          admCd: opts?.admCd || selectedAdmCd,
          lat: activePin?.lat,
          lng: activePin?.lng,
          overrideProfile: opts?.overrideProfile,
          limit: 12,
        });
        setAiResult(data);
        setEditableProfile(data.profile || null);
        const firstLocated = data.recommendations.find((r) => r.program.location);
        setFocusedMapProgramId(firstLocated?.program.id || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [userCoords, selectedAdmCd, addRecentQuery],
  );

  const toggleVoiceInput = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      showToast({ message: "이 브라우저에서는 음성 입력을 지원하지 않아요. 크롬·사파리에서 이용해 보세요." });
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      if (spoken.trim()) {
        setQuery(spoken.trim());
        void runSearch(spoken.trim());
      }
    };
    recognition.onerror = () => {
      setListening(false);
      showToast({ message: "음성 인식 권한을 확인하거나 다시 말씀해 주세요." });
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleLocateMe = async () => {
    const loc = await locateMe();
    if (loc && query.trim() && aiResult && !aiResult.crisis) {
      void runSearch(query, { pin: { lat: loc.lat, lng: loc.lng }, skipHistory: true });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void runSearch(query);
    }
  };

  const confirmPendingLocation = () => {
    if (!pendingPin) return;
    const nextPin = pendingPin;
    setUserCoords({ lat: nextPin.lat, lng: nextPin.lng, label: "지도에서 지정한 위치", source: "pin" });
    setPendingPin(null);
    if (query.trim() && aiResult) {
      void runSearch(query, { pin: nextPin, skipHistory: true });
    }
  };

  const resetSearch = () => {
    setQuery("");
    setAiResult(null);
    setEditableProfile(null);
    setDrawerProgramId(null);
    setFocusedMapProgramId(null);
    setSortBy("relevance");
    setError(null);
  };

  const toggleCategoryChip = (cat: CategoryType) => {
    if (!editableProfile) return;
    const exists = editableProfile.categories.includes(cat);
    const nextCategories = exists
      ? editableProfile.categories.filter((c) => c !== cat)
      : [...editableProfile.categories, cat];
    const nextProfile = { ...editableProfile, categories: nextCategories };
    setEditableProfile(nextProfile);
    void runSearch(query || "조건 재검색", { overrideProfile: nextProfile, skipHistory: true });
  };

  const toggleFreeChip = () => {
    if (!editableProfile) return;
    const nextProfile = { ...editableProfile, preferFree: !editableProfile.preferFree };
    setEditableProfile(nextProfile);
    void runSearch(query || "조건 재검색", { overrideProfile: nextProfile, skipHistory: true });
  };

  const applyAgePreset = (age: number, groups: string[]) => {
    if (!editableProfile) return;
    const nextProfile: UserProfile = {
      ...editableProfile,
      age,
      targetGroups: groups,
    };
    setEditableProfile(nextProfile);
    void runSearch(query || "조건 재검색", { overrideProfile: nextProfile, skipHistory: true });
  };

  const handleSelectRegionFromMap = useCallback(
    (region: RegionStat) => {
      setPendingPin(null);
      setSelectedAdmCd(region.admCd);
    },
    [setSelectedAdmCd],
  );

  const recommendations: RecommendedProgram[] = useMemo(
    () => (aiResult && !aiResult.crisis ? aiResult.recommendations : []),
    [aiResult],
  );

  const allItems = useMemo(
    () =>
      recommendations.length > 0
        ? recommendations.map((r) => ({ program: r.program, rec: r }))
        : basePrograms.map((p) => ({ program: p, rec: null as RecommendedProgram | null })),
    [recommendations, basePrograms],
  );

  const displayedItems = useMemo(() => {
    const filtered =
      resultTab === "map"
        ? allItems.filter((i) => Boolean(i.program.location))
        : resultTab === "online"
          ? allItems.filter((i) => !i.program.location)
          : [...allItems];

    if (sortBy === "distance") {
      filtered.sort((a, b) => (a.program.distanceKm ?? 999) - (b.program.distanceKm ?? 999));
    } else if (sortBy === "deadline") {
      const deadlineTs = (p: Program) =>
        p.isAlwaysOpen || !p.deadline ? Number.POSITIVE_INFINITY : new Date(p.deadline).getTime();
      filtered.sort((a, b) => deadlineTs(a.program) - deadlineTs(b.program));
    }
    return filtered;
  }, [allItems, resultTab, sortBy]);

  const allPrograms = useMemo(() => allItems.map((i) => i.program), [allItems]);
  const locatedCount = allPrograms.filter((p) => Boolean(p.location)).length;
  const onlineCount = allPrograms.length - locatedCount;

  const drawerEntry = useMemo(
    () => allItems.find((i) => i.program.id === drawerProgramId) || null,
    [allItems, drawerProgramId],
  );

  const hasSearched = Boolean(aiResult);

  return (
    <div className="space-y-9">
      {/* 주민센터 상담 보조 모드 전용 업무 배너 */}
      {roleMode === "officer" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191f28] bg-[#191f28] px-5 py-3.5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-5 w-5 text-teal-300" />
            </span>
            <div>
              <p className="text-sm font-extrabold">
                행정복지센터(주민센터) 민원 상담 보조 모드 활성 중
              </p>
              <p className="text-xs text-slate-300">
                민원인 상황을 입력하면 통합 구비서류가 정리된 1장 원스톱 안내지를 즉시 인쇄·전달할 수
                있으며, 비식별 수요가 지역 격차 지표에 자동 누적됩니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiResult && !aiResult.crisis && recommendations.length > 0 ? (
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-extrabold text-[#191f28] hover:bg-teal-400"
              >
                <Printer className="h-4 w-4" />
                <span>1장 민원 안내지 출력</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setRoleMode("citizen")}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              주민 모드로 전환
            </button>
          </div>
        </div>
      ) : null}

      {/* ============================================================
          1. AI 검색 히어로 컴포저 (주 기능)
         ============================================================ */}
      <section
        className={
          hasSearched
            ? "space-y-4"
            : "relative overflow-hidden rounded-[32px] border border-[#e5e8eb] bg-white px-5 py-10 text-center shadow-xs sm:px-10 sm:py-12"
        }
        style={
          !hasSearched
            ? {
                backgroundImage:
                  "radial-gradient(circle at 50% 0%, rgba(13,110,110,0.07) 0%, rgba(255,255,255,0) 62%)",
              }
            : undefined
        }
      >
        <div className={hasSearched ? "" : "mx-auto max-w-4xl"}>
          {!hasSearched ? (
            <div className="mb-8 space-y-3.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6ebeb] bg-[#f0fafa] px-3.5 py-1.5 text-xs font-bold text-[#0d6e6e]">
                <span className="h-2 w-2 rounded-full bg-[#0d6e6e]" />
                <span>복지 · 교육 · 문화 공공자원 통합 매칭</span>
              </div>
              <h1 className="text-3xl font-extrabold leading-[1.22] tracking-tight text-[#191f28] sm:text-[44px]">
                내 상황과 위치를 말하면,
                <br className="hidden sm:block" /> 받을 수 있는 혜택과 시설을 찾아드려요
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-[#4e5968] sm:text-[17px]">
                복잡한 복지 제도 이름을 몰라도 일상 말이나 음성으로 물어보세요. 자격요건, 이동 거리, 비용,
                운영시간을 함께 따져 신청 가능한 자원만 골라드립니다.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border-2 border-[#d1d6db] bg-white p-4 text-left shadow-sm transition-all focus-within:border-[#0d6e6e] focus-within:shadow-md sm:p-5"
          >
            <label htmlFor="main-ai-search" className="sr-only">
              상황과 필요한 도움을 일상 말로 입력해 주세요
            </label>

            <textarea
              id="main-ai-search"
              rows={hasSearched ? 2 : 3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
              className="w-full resize-none bg-transparent px-2 py-1 text-base leading-relaxed text-[#191f28] placeholder-[#8b95a1] focus:outline-none sm:text-[18px]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#f2f4f6] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleLocateMe()}
                  disabled={locating}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors ${
                    userCoords?.source === "gps"
                      ? "border-[#0d6e6e] bg-[#edf7f7] text-[#0d6e6e]"
                      : "border-[#d1d6db] bg-white text-[#191f28] hover:bg-[#f6f7f9]"
                  }`}
                >
                  <LocateFixed
                    className={`h-4 w-4 ${locating ? "animate-spin text-[#0d6e6e]" : "text-[#0d6e6e]"}`}
                  />
                  <span>
                    {locating
                      ? "위치 확인 중…"
                      : userCoords?.source === "gps"
                        ? "현재 GPS 위치"
                        : "내 현재 위치"}
                  </span>
                </button>

                <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 py-2 text-sm font-semibold text-[#191f28]">
                  <MapPin className="h-4 w-4 text-[#0d6e6e]" />
                  <label htmlFor="composer-region-select" className="sr-only">
                    검색 기준 동네
                  </label>
                  <select
                    id="composer-region-select"
                    value={selectedAdmCd}
                    onChange={(e) => setSelectedAdmCd(e.target.value)}
                    className="bg-transparent font-bold text-[#191f28] focus:outline-none"
                  >
                    {regions.map((r) => (
                      <option key={r.admCd} value={r.admCd}>
                        {r.sigungu} {r.dong}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-pressed={listening}
                  aria-label={listening ? "음성 입력 중지" : "한국어 음성으로 질문하기"}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    listening
                      ? "animate-pulse border-rose-500 bg-rose-50 text-rose-700"
                      : "border-[#d1d6db] bg-white text-[#4e5968] hover:border-[#191f28] hover:text-[#191f28]"
                  }`}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{listening ? "듣는 중…" : "음성"}</span>
                </button>

                {userCoords ? (
                  <button
                    type="button"
                    onClick={() => setUserCoords(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7684] hover:text-[#191f28]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>위치 초기화</span>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {hasSearched ? (
                  <button
                    type="button"
                    onClick={resetSearch}
                    className="rounded-xl border border-[#e5e8eb] px-4 py-2.5 text-sm font-semibold text-[#4e5968] hover:bg-[#f6f7f9]"
                  >
                    초기화
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0d6e6e] px-6 py-2.5 text-[15px] font-bold text-white shadow-xs transition-colors hover:bg-[#0a5858] disabled:opacity-45"
                >
                  <Search className="h-4 w-4" />
                  <span>{loading ? "분석 중…" : "맞춤 혜택 찾기"}</span>
                </button>
              </div>
            </div>
          </form>

          {/* 최근 검색어 칩 */}
          {recentQueries.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-left">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b95a1]">
                <Clock className="h-3.5 w-3.5" />
                최근 검색
              </span>
              {recentQueries.map((rq) => (
                <div
                  key={rq}
                  className="inline-flex items-center gap-1 rounded-full border border-[#e5e8eb] bg-[#f9fafb] py-1 pr-1.5 pl-3 text-xs font-medium text-[#333d4b]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(rq);
                      void runSearch(rq);
                    }}
                    className="max-w-[200px] truncate hover:text-[#0d6e6e]"
                  >
                    {rq}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecentQuery(rq)}
                    aria-label="최근 검색어 삭제"
                    className="rounded-full p-0.5 text-[#8b95a1] hover:bg-[#e5e8eb] hover:text-[#191f28]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* 첫 화면: 큼직한 상황별 예시 카드 2x2 */}
          {!hasSearched ? (
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
              {EXAMPLE_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => {
                    setQuery(card.query);
                    void runSearch(card.query);
                  }}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-[#e5e8eb] bg-[#fafbfc] p-4 transition-all hover:border-[#0d6e6e] hover:bg-white hover:shadow-sm"
                >
                  <div>
                    <span className="text-xs font-bold text-[#0d6e6e]">{card.tag}</span>
                    <p className="mt-1 text-[15px] font-bold text-[#191f28] group-hover:text-[#0d6e6e]">
                      {card.title}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#b0b8c1] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0d6e6e]" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void runSearch(query)}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {aiResult?.crisis?.detected ? (
        <section role="alert" className="rounded-3xl border-2 border-rose-500 bg-rose-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 h-8 w-8 shrink-0 text-rose-600" />
            <div className="w-full space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-rose-950">지금 바로 도움을 받으실 수 있어요</h2>
                <p className="mt-1.5 text-base text-rose-900">{aiResult.crisis.message}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {aiResult.crisis.contacts.map((c) => (
                  <a
                    key={c.number}
                    href={`tel:${c.number}`}
                    className="flex flex-col justify-between rounded-2xl border border-rose-200 bg-white p-5 shadow-xs transition-colors hover:border-rose-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold text-[#191f28]">{c.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1 text-base font-extrabold text-white">
                        <PhoneCall className="h-4 w-4" />
                        {c.number}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#4e5968]">{c.description}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ============================================================
          1.5. 도란도란 맞춤 혜택 브리핑 (단일 정갈한 요약 + 탭)
         ============================================================ */}
      {hasSearched && aiResult && !aiResult.crisis && !loading ? (
        <BenefitPlanPanel
          summaryMessage={aiResult.summaryMessage}
          benefitSummary={aiResult.benefitSummary}
          hiddenGems={aiResult.hiddenGems}
          actionPlan={aiResult.actionPlan}
          consolidatedDocs={aiResult.consolidatedDocs}
          onOpenGuide={() => setGuideOpen(true)}
          onSelectProgram={(id) => {
            setDrawerProgramId(id);
            const target = allPrograms.find((p) => p.id === id);
            if (target?.location) {
              setMapMode("resources");
              setFocusedMapProgramId(id);
            }
          }}
        />
      ) : null}

      {/* ============================================================
          2. 메인 콘텐츠: 좌측 넓은 추천 리스트(60%) + 우측 Sticky 지도(40%)
         ============================================================ */}
      {!aiResult?.crisis?.detected ? (
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(400px,1fr)]">
          <div className="space-y-5">
            {/* 검색 결과 시: 중복 큰 박스 없이 깔끔한 1줄 조건 조정 바 */}
            {hasSearched && editableProfile ? (
              <div className="flex flex-wrap items-center gap-2">
                {AGE_PRESETS.map((preset) => {
                  const active =
                    editableProfile.age != null && Math.abs(editableProfile.age - preset.age) <= 5;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyAgePreset(preset.age, preset.groups)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                        active
                          ? "bg-[#0d6e6e] text-white"
                          : "bg-white text-[#374151] ring-1 ring-[#dfe4ea] hover:bg-[#f3f5f8]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <span className="mx-1 h-5 w-px bg-[#dfe4ea]" aria-hidden="true" />

                {(["welfare", "education", "culture"] as CategoryType[]).map((cat) => {
                  const active = editableProfile.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategoryChip(cat)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                        active
                          ? "bg-[#111827] text-white"
                          : "bg-white text-[#374151] ring-1 ring-[#dfe4ea] hover:bg-[#f3f5f8]"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={toggleFreeChip}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                    editableProfile.preferFree
                      ? "bg-[#0d6e6e] text-white"
                      : "bg-white text-[#374151] ring-1 ring-[#dfe4ea] hover:bg-[#f3f5f8]"
                  }`}
                >
                  무료·지원금만
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#111827]">
                    {anchor.label} 주변 공공자원
                  </h2>
                  <p className="mt-1 text-base text-[#374151]">
                    위 검색창에 내 상황을 말하면 자격에 맞는 혜택만 골라 정리해 드려요.
                  </p>
                </div>
                <Link href="/explore" className="text-sm font-bold text-[#0d6e6e] hover:underline">
                  전체 탐색 →
                </Link>
              </div>
            )}

            {/* 탭 + 정렬 컨트롤 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe4ea] pb-3.5">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: `전체 ${allPrograms.length}` },
                  { key: "map", label: `주변 시설 ${locatedCount}` },
                  { key: "online", label: `전국·온라인 ${onlineCount}` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setResultTab(tab.key as "all" | "map" | "online")}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                      resultTab === tab.key
                        ? "bg-[#111827] text-white"
                        : "bg-white text-[#374151] ring-1 ring-[#dfe4ea] hover:bg-[#f3f5f8]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {(
                  [
                    { key: "relevance", label: "맞춤순" },
                    { key: "distance", label: "가까운순" },
                    { key: "deadline", label: "마감임박순" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSortBy(s.key)}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      sortBy === s.key
                        ? "bg-[#edf7f7] font-bold text-[#0d6e6e]"
                        : "text-[#4b5563] hover:text-[#111827]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                <p className="text-base font-bold text-[#0d6e6e]">
                  자격요건과 {anchor.label} 기준 거리를 확인하고 있어요…
                </p>
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-44 animate-pulse rounded-2xl border border-[#dfe4ea] bg-white p-6"
                  >
                    <div className="h-4 w-32 rounded bg-[#eef1f5]" />
                    <div className="mt-3 h-7 w-3/4 rounded bg-[#dfe4ea]" />
                    <div className="mt-3 h-5 w-1/2 rounded bg-[#eef1f5]" />
                    <div className="mt-4 h-4 w-2/3 rounded bg-[#f4f6f9]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {displayedItems.map(({ program, rec }) => {
                  const isSaved = savedIds.has(program.id);
                  const isCompared = compareList.some((p) => p.id === program.id);
                  const hasLocation = Boolean(program.location);
                  const isFocused = program.id === focusedMapProgramId;
                  const distanceHint = formatDistanceWithWalk(program.distanceKm);

                  return (
                    <article
                      key={program.id}
                      onMouseEnter={() => setHoveredProgramId(program.id)}
                      onMouseLeave={() => setHoveredProgramId(null)}
                      onClick={() => {
                        setDrawerProgramId(program.id);
                        if (hasLocation) {
                          setMapMode("resources");
                          setFocusedMapProgramId(program.id);
                        }
                      }}
                      className={`cursor-pointer rounded-2xl border bg-white p-6 transition-all ${
                        isFocused
                          ? "border-[#0d6e6e] shadow-md ring-2 ring-[#0d6e6e]/15"
                          : "border-[#dfe4ea] shadow-2xs hover:border-[#9ca3af] hover:shadow-sm"
                      }`}
                    >
                      {/* 1단: 자격 상태 + 분야·마감 + 액션 */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 text-sm font-bold">
                          {rec ? (
                            rec.eligibility.status === "eligible" ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-emerald-900">
                                <Check className="h-4 w-4 text-emerald-700" />
                                신청 가능
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-amber-950">
                                <ShieldAlert className="h-4 w-4 text-amber-700" />
                                자격 확인 필요
                              </span>
                            )
                          ) : null}

                          <span className="inline-flex items-center gap-1.5 text-[#374151]">
                            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[program.category]}`} />
                            {CATEGORY_LABELS[program.category]}
                          </span>
                          <span className="text-[#cbd5e1]">·</span>
                          <span className="text-[#0d6e6e]">{formatDeadlineBadge(program)}</span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(program);
                            }}
                            aria-label={isCompared ? "비교에서 제거" : "비교함에 담기"}
                            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors ${
                              isCompared
                                ? "border-[#111827] bg-[#111827] text-white"
                                : "border-[#dfe4ea] text-[#374151] hover:bg-[#f3f5f8]"
                            }`}
                          >
                            <Scale className="h-4 w-4" />
                            <span>{isCompared ? "비교 중" : "비교"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleSave(program.id);
                            }}
                            aria-label={isSaved ? "저장 취소" : "체크리스트에 저장"}
                            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors ${
                              isSaved
                                ? "border-[#0d6e6e] bg-[#edf7f7] text-[#0d6e6e]"
                                : "border-[#dfe4ea] text-[#374151] hover:bg-[#f3f5f8]"
                            }`}
                          >
                            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-[#0d6e6e]" : ""}`} />
                            <span>{isSaved ? "저장됨" : "저장"}</span>
                          </button>
                        </div>
                      </div>

                      {/* 2단: 선명한 제목 */}
                      <h3 className="mt-3 text-[21px] font-extrabold leading-snug text-[#111827]">
                        {program.title}
                      </h3>

                      {/* 3단: 핵심 혜택 1줄 강조 */}
                      <p className="mt-2 text-base font-bold text-[#0d6e6e]">
                        {COST_LABELS[program.cost.type]} · {program.cost.description}
                      </p>

                      {/* 핵심 조건/설명 1줄 */}
                      <p className="mt-1.5 line-clamp-1 text-base text-[#374151]">
                        {rec && rec.eligibility.status === "verify_needed" && rec.eligibility.verificationNeeded[0]
                          ? `확인 필요: ${rec.eligibility.verificationNeeded[0]}`
                          : program.summary}
                      </p>

                      {/* 4단: 위치 · 거리 · 운영시간 */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1f5] pt-3.5 text-sm font-medium text-[#374151]">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#111827]">
                            {hasLocation ? (
                              <>
                                <MapPin className="h-4 w-4 text-[#0d6e6e]" />
                                <span>{program.provider}</span>
                              </>
                            ) : (
                              <>
                                <Globe className="h-4 w-4 text-[#0d6e6e]" />
                                <span>전국 · 온라인 신청</span>
                              </>
                            )}
                          </span>
                          {distanceHint ? (
                            <span className="rounded-lg bg-[#edf7f7] px-2.5 py-0.5 text-sm font-bold text-[#0d6e6e]">
                              {distanceHint}
                            </span>
                          ) : null}
                        </div>

                        <span className="font-bold text-[#0d6e6e]">상세 보기 →</span>
                      </div>
                    </article>
                  );
                })}

                {displayedItems.length === 0 ? (
                  <div className="rounded-2xl border border-[#dfe4ea] bg-white p-12 text-center text-base text-[#4b5563]">
                    선택한 분류에 해당하는 공공자원이 없습니다.
                  </div>
                ) : null}

                {/* 환각 제로 · 결정론 필터링 제외 사유 투명 리포트 */}
                {hasSearched && aiResult && !aiResult.crisis ? (
                  <ExcludedTransparencyPanel
                    totalEvaluatedCount={aiResult.totalEvaluatedCount ?? allPrograms.length}
                    totalExcludedCount={aiResult.totalExcludedCount ?? 0}
                    excludedPrograms={aiResult.excludedPrograms ?? []}
                  />
                ) : null}
              </div>
            )}
          </div>

          {/* 우측: Sticky 인터랙티브 지도 + 동네 격차 요약 */}
          <aside className="space-y-4 lg:sticky lg:top-[84px]">
            <div className="relative h-[520px] overflow-hidden rounded-3xl border border-[#e5e8eb] bg-[#eef1f5] shadow-sm lg:h-[calc(100vh-230px)] lg:min-h-[480px]">
              <div className="pointer-events-none absolute top-3.5 right-3.5 left-3.5 z-[450] flex flex-wrap items-center justify-between gap-2">
                <div className="pointer-events-auto inline-flex rounded-xl border border-[#e5e8eb] bg-white/95 p-1 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setMapMode("resources")}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      mapMode === "resources" ? "bg-[#191f28] text-white" : "text-[#4e5968] hover:bg-[#f2f4f6]"
                    }`}
                  >
                    주변 시설 ({locatedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode("gap")}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      mapMode === "gap" ? "bg-rose-600 text-white" : "text-[#4e5968] hover:bg-[#f2f4f6]"
                    }`}
                  >
                    동네 격차 지도
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleLocateMe()}
                  disabled={locating}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border border-[#e5e8eb] bg-white/95 px-3 py-2 text-xs font-bold text-[#191f28] shadow-sm backdrop-blur hover:bg-white"
                >
                  <LocateFixed className={`h-3.5 w-3.5 text-[#0d6e6e] ${locating ? "animate-spin" : ""}`} />
                  <span>내 위치</span>
                </button>
              </div>

              {pendingPin ? (
                <div className="absolute top-16 left-1/2 z-[460] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#191f28] py-2 pr-2.5 pl-4 text-sm font-bold text-white shadow-xl">
                  <button
                    type="button"
                    onClick={confirmPendingLocation}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Crosshair className="h-4 w-4 text-teal-300" />
                    <span>이 위치 기준으로 검색</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPin(null)}
                    aria-label="취소"
                    className="rounded-full p-1 text-slate-300 hover:bg-white/15"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <InteractiveAIMap
                programs={allPrograms}
                regions={regions}
                mode={mapMode}
                anchor={anchor}
                pendingPin={pendingPin}
                selectedProgramId={focusedMapProgramId}
                hoveredProgramId={hoveredProgramId}
                selectedRegionAdmCd={selectedAdmCd}
                onSelectProgram={(id) => {
                  setFocusedMapProgramId(id);
                  setDrawerProgramId(id);
                }}
                onClickMapLocation={(lat, lng) => {
                  if (mapMode === "resources") setPendingPin({ lat, lng });
                }}
                onSelectRegion={handleSelectRegionFromMap}
              />

              <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[450]">
                <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#e5e8eb] bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#4e5968] shadow-xs backdrop-blur">
                  {mapMode === "resources" ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        복지
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        교육
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                        문화
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                        사각지대 높음
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                        보완 필요
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        양호
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedRegion ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#e5e8eb] bg-white px-5 py-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#191f28]">
                      {selectedRegion.sigungu} {selectedRegion.dong} 수요·공급 격차
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                        selectedRegion.scores.gapIndex >= 30
                          ? "bg-rose-100 text-rose-700"
                          : selectedRegion.scores.gapIndex > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {selectedRegion.scores.gapIndex > 0
                        ? `+${selectedRegion.scores.gapIndex}`
                        : selectedRegion.scores.gapIndex}
                      점
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#4e5968]">
                    수요 {selectedRegion.scores.demandIndex} · 공급 {selectedRegion.scores.supplyIndex}
                    {selectedRegion.scores.shortageCategories.length > 0
                      ? ` · 부족 분야: ${selectedRegion.scores.shortageCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}`
                      : " · 전 분야 균형 양호"}
                  </p>
                </div>

                <Link
                  href={`/report/${selectedRegion.admCd}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#191f28] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#333d4b]"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>상세 리포트</span>
                </Link>
              </div>
            ) : null}
          </aside>
        </section>
      ) : null}

      {drawerEntry ? (
        <ProgramDetailDrawer
          program={drawerEntry.program}
          recommendation={drawerEntry.rec}
          onClose={() => setDrawerProgramId(null)}
        />
      ) : null}

      {guideOpen && aiResult && !aiResult.crisis ? (
        <OfficerGuideModal
          result={aiResult}
          locationLabel={anchor.label}
          onClose={() => setGuideOpen(false)}
        />
      ) : null}
    </div>
  );
}
