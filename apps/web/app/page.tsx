"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bookmark,
  Check,
  Clock,
  Crosshair,
  ExternalLink,
  Globe,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  PhoneCall,
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
    <div className="flex h-full min-h-[460px] w-full items-center justify-center rounded-2xl bg-fill text-sm text-subtle">
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

interface SpeechRecognitionResultLike {
  isFinal?: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export default function HomeAISearchPage() {
  const {
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
  const voiceTranscriptRef = useRef("");
  const voiceErrorRef = useRef(false);

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

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setListening(false);
      }
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

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    voiceTranscriptRef.current = "";
    voiceErrorRef.current = false;

    recognition.onresult = (event) => {
      let combined = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript || "";
        combined += piece;
      }
      const trimmed = combined.trim();
      if (trimmed) {
        voiceTranscriptRef.current = trimmed;
        setQuery(trimmed);
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || "";
      if (code === "aborted") {
        setListening(false);
        return;
      }
      voiceErrorRef.current = true;
      setListening(false);
      if (code === "not-allowed" || code === "service-not-allowed") {
        showToast({
          message:
            "마이크 권한이 차단되어 있어요. 브라우저 주소창 권한과 macOS 받아쓰기(Dictation) 설정을 확인해 주세요.",
        });
      } else if (code === "audio-capture") {
        showToast({ message: "연결된 마이크를 찾을 수 없어요. 시스템 사운드 입력 설정을 확인해 주세요." });
      } else if (code === "no-speech") {
        showToast({ message: "목소리가 감지되지 않았어요. 마이크 가까이서 다시 말씀해 주세요." });
      } else if (code === "network") {
        showToast({ message: "음성 인식 서버 연결에 실패했어요. 네트워크 상태를 확인해 주세요." });
      } else {
        showToast({ message: `음성 인식 중 오류가 발생했어요${code ? ` (${code})` : ""}. 다시 시도해 주세요.` });
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const finalText = voiceTranscriptRef.current.trim();
      if (finalText && !voiceErrorRef.current) {
        void runSearch(finalText);
      } else if (!finalText && !voiceErrorRef.current) {
        showToast({ message: "인식된 음성이 없어요. 다시 누르고 또박또박 말씀해 주세요." });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      recognitionRef.current = null;
      showToast({ message: "음성 인식을 시작할 수 없어요. 잠시 후 다시 시도해 주세요." });
    }
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

  const composer = (hero: boolean) => (
    <form
      onSubmit={handleSubmit}
      className={
        hero
          ? "rounded-2xl border border-line-strong bg-surface p-3.5 text-left shadow-lift transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 sm:p-4"
          : "rounded-2xl border border-line bg-surface p-3.5 text-left shadow-card transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 sm:p-4"
      }
    >
      <label htmlFor="main-ai-search" className="sr-only">
        상황과 필요한 도움을 일상 말로 입력해 주세요
      </label>

      <textarea
        id="main-ai-search"
        rows={hero ? 3 : 2}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          listening
            ? "듣고 있어요… 말씀하시면 실시간으로 입력됩니다 (다시 누르면 검색)"
            : ROTATING_PLACEHOLDERS[placeholderIdx]
        }
        className="w-full resize-none bg-transparent px-2 py-1 text-base leading-relaxed text-ink placeholder-faint focus:outline-none sm:text-[18px]"
      />

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-line/70 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleLocateMe()}
            disabled={locating}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              userCoords?.source === "gps"
                ? "bg-brand-soft text-brand ring-1 ring-brand-line"
                : "bg-fill text-ink hover:bg-line/70"
            }`}
          >
            <LocateFixed className={`h-4 w-4 text-brand ${locating ? "animate-spin" : ""}`} />
            <span>
              {locating ? "위치 확인 중…" : userCoords?.source === "gps" ? "현재 GPS 위치" : "내 위치"}
            </span>
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-lg bg-fill px-3 py-2 text-sm font-semibold text-ink">
            <MapPin className="h-4 w-4 text-brand" />
            <label htmlFor="composer-region-select" className="sr-only">
              검색 기준 동네
            </label>
            <select
              id="composer-region-select"
              value={selectedAdmCd}
              onChange={(e) => setSelectedAdmCd(e.target.value)}
              className="bg-transparent font-bold text-ink focus:outline-none"
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
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              listening
                ? "animate-pulse bg-accent-soft text-accent ring-1 ring-accent/30"
                : "bg-fill text-muted hover:text-ink"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{listening ? "듣는 중…" : "음성"}</span>
          </button>

          {userCoords ? (
            <button
              type="button"
              onClick={() => setUserCoords(null)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-subtle hover:bg-fill hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>위치 초기화</span>
            </button>
          ) : null}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {hasSearched ? (
            <button
              type="button"
              onClick={resetSearch}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted hover:bg-fill hover:text-ink"
            >
              초기화
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-brand disabled:opacity-45 sm:w-auto"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? "분석 중…" : "맞춤 혜택 찾기"}</span>
          </button>
        </div>
      </div>
    </form>
  );

  const heroTotalPop = Math.max(selectedRegion?.population.total ?? 1, 1);
  const heroSeniorPct = selectedRegion
    ? Math.round((selectedRegion.population.senior / heroTotalPop) * 1000) / 10
    : 0;
  const heroYouthPct = selectedRegion
    ? Math.round((selectedRegion.population.youth / heroTotalPop) * 1000) / 10
    : 0;
  const heroOtherPct = Math.max(0, Math.round((100 - heroSeniorPct - heroYouthPct) * 10) / 10);

  return (
    <div className="space-y-12">
      {/* ============================================================
          1. 비대칭 에디토리얼 히어로: 좌(자연어 혜택 검색) + 우(우리 동네 실시간 현황)
         ============================================================ */}
      {!hasSearched ? (
        <section className="grid items-start gap-7 pt-4 lg:grid-cols-[1.45fr_0.95fr] lg:gap-10 lg:pt-8">
          {/* 좌측: 핵심 검색 영역 */}
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-[1.22] tracking-[-0.035em] text-ink sm:text-[42px]">
              내 상황과 위치를 말하면,
              <br />
              <span className="text-brand">받을 수 있는 혜택</span>을 찾아드려요
            </h1>

            <div className="mt-7">{composer(true)}</div>

            {/* 빠른 예시 질문 칩 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {EXAMPLE_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => {
                    setQuery(card.query);
                    void runSearch(card.query);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-brand/50 hover:bg-brand-tint hover:text-brand"
                >
                  <span>{card.title}</span>
                  <ArrowRight className="h-3 w-3 text-faint" />
                </button>
              ))}
            </div>

            {recentQueries.length > 0 ? (
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-subtle">
                  <Clock className="h-3.5 w-3.5" />
                  최근
                </span>
                {recentQueries.map((rq) => (
                  <div
                    key={rq}
                    className="inline-flex items-center gap-1 rounded-full bg-fill py-1 pr-1.5 pl-3 text-xs font-medium text-muted"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(rq);
                        void runSearch(rq);
                      }}
                      className="max-w-[180px] truncate hover:text-ink"
                    >
                      {rq}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentQuery(rq)}
                      aria-label="최근 검색어 삭제"
                      className="rounded-full p-0.5 text-faint hover:bg-surface hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* 우측: 우리 동네 실시간 현황 벤토 카드 */}
          {selectedRegion ? (
            <aside className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-card lg:mt-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-subtle">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    <span>우리 동네 현황</span>
                  </div>
                  {selectedRegion.statsYm && selectedRegion.statsYm.length === 6 ? (
                    <span className="rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-bold text-muted">
                      행안부 {selectedRegion.statsYm.slice(0, 4)}.{selectedRegion.statsYm.slice(4)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xl font-extrabold tracking-[-0.02em] text-ink">
                      {selectedRegion.sigungu} {selectedRegion.dong}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      인구 {selectedRegion.population.total.toLocaleString()}명
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        selectedRegion.scores.gapIndex >= 30
                          ? "bg-accent-soft text-accent"
                          : selectedRegion.scores.gapIndex > 5
                            ? "bg-gold-soft text-gold"
                            : "bg-brand-soft text-brand"
                      }`}
                    >
                      {selectedRegion.scores.gapIndex >= 30
                        ? "사각지대 우선 지원"
                        : selectedRegion.scores.gapIndex > 5
                          ? "보완 필요 권역"
                          : "생활권 균형"}
                    </span>
                    <p className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                      격차{" "}
                      {selectedRegion.scores.gapIndex > 0
                        ? `+${selectedRegion.scores.gapIndex}`
                        : selectedRegion.scores.gapIndex}
                    </p>
                  </div>
                </div>

                {/* 인구 비율 바 */}
                <div className="mt-5 rounded-xl bg-fill-soft p-3.5">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-muted">
                    <span>어르신 {heroSeniorPct}%</span>
                    <span>청년 {heroYouthPct}%</span>
                    <span>일반 {heroOtherPct}%</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-line">
                    <div style={{ width: `${heroSeniorPct}%` }} className="bg-accent/80" />
                    <div style={{ width: `${heroYouthPct}%` }} className="bg-brand" />
                    <div style={{ width: `${heroOtherPct}%` }} className="bg-line-strong" />
                  </div>
                </div>

                {/* 생활권 공급 요약 */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "복지", val: selectedRegion.supply.welfare },
                    { label: "교육", val: selectedRegion.supply.education },
                    { label: "문화", val: selectedRegion.supply.culture },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-line bg-canvas/70 px-3 py-2.5 text-center"
                    >
                      <p className="text-[11px] font-semibold text-subtle">{item.label}</p>
                      <p className="mt-0.5 text-base font-extrabold text-ink tabular-nums">
                        {item.val}
                        <span className="ml-0.5 text-xs font-medium text-subtle">곳</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/report/${selectedAdmCd}`}
                className="mt-5 flex items-center justify-between rounded-xl border border-line bg-fill-soft px-4 py-3 text-sm font-bold text-ink transition-colors hover:border-brand/40 hover:bg-brand-tint hover:text-brand"
              >
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand" />
                  <span>격차 리포트 · 필요시설 추천 보기</span>
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          ) : (
            <div className="h-[310px] animate-pulse rounded-2xl border border-line bg-surface lg:mt-2" />
          )}
        </section>
      ) : (
        <section>{composer(false)}</section>
      )}

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
                      <span className="text-base font-bold text-ink">{c.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1 text-base font-extrabold text-white">
                        <PhoneCall className="h-4 w-4" />
                        {c.number}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{c.description}</p>
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
          topRecommendations={aiResult.recommendations}
          hiddenGems={aiResult.hiddenGems}
          actionPlan={aiResult.actionPlan}
          consolidatedDocs={aiResult.consolidatedDocs}
          onOpenGuide={() => setGuideOpen(true)}
          onFocusMap={(id) => {
            setMapMode("resources");
            setFocusedMapProgramId(id);
            document.getElementById("doran-live-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
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
                          ? "bg-brand text-white"
                          : "bg-surface text-ink-soft ring-1 ring-line hover:bg-fill-soft"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

                {(["welfare", "education", "culture"] as CategoryType[]).map((cat) => {
                  const active = editableProfile.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategoryChip(cat)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                        active
                          ? "bg-pine text-white"
                          : "bg-surface text-ink-soft ring-1 ring-line hover:bg-fill-soft"
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
                      ? "bg-brand text-white"
                      : "bg-surface text-ink-soft ring-1 ring-line hover:bg-fill-soft"
                  }`}
                >
                  무료·지원금만
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[26px] font-black tracking-[-0.03em] text-ink">
                    {anchor.label} 주변 공공자원
                  </h2>
                  <p className="mt-1 text-base text-muted">
                    위 검색창에 내 상황을 말하면 자격에 맞는 혜택만 골라 정리해 드려요.
                  </p>
                </div>
                <Link href="/explore" className="text-sm font-bold text-brand hover:underline">
                  전체 탐색 →
                </Link>
              </div>
            )}

            {/* 탭 + 정렬 컨트롤 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
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
                        ? "bg-pine text-white shadow-card"
                        : "bg-surface text-muted ring-1 ring-line hover:text-ink"
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
                        ? "bg-brand-soft font-bold text-brand"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                <p className="text-base font-bold text-brand">
                  자격요건과 {anchor.label} 기준 거리를 확인하고 있어요…
                </p>
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-44 animate-pulse rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70"
                  >
                    <div className="h-4 w-32 rounded bg-fill" />
                    <div className="mt-3 h-7 w-3/4 rounded bg-line" />
                    <div className="mt-3 h-5 w-1/2 rounded bg-fill" />
                    <div className="mt-4 h-4 w-2/3 rounded bg-canvas" />
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
                      className={`group relative cursor-pointer rounded-2xl border bg-surface p-5 transition-colors hover:border-line-strong hover:shadow-card ${
                        isFocused ? "border-brand ring-2 ring-brand/20" : "border-line"
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

                          <span className="inline-flex items-center gap-1.5 text-ink-soft">
                            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[program.category]}`} />
                            {CATEGORY_LABELS[program.category]}
                          </span>
                          <span className="text-line-strong">·</span>
                          <span className="text-brand">{formatDeadlineBadge(program)}</span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(program);
                            }}
                            aria-label={isCompared ? "비교에서 제거" : "비교함에 담기"}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                              isCompared
                                ? "bg-pine text-white"
                                : "bg-fill text-subtle hover:text-ink"
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
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                              isSaved
                                ? "bg-brand text-white"
                                : "bg-fill text-subtle hover:text-ink"
                            }`}
                          >
                            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-white" : ""}`} />
                            <span>{isSaved ? "저장됨" : "저장"}</span>
                          </button>
                        </div>
                      </div>

                      {/* 2단: 선명한 제목 */}
                      <h3 className="mt-3 text-[19px] font-extrabold leading-snug text-ink">
                        {program.title}
                      </h3>

                      {/* 3단: 핵심 혜택 1줄 강조 */}
                      <p className="mt-2 text-base font-bold text-brand">
                        {COST_LABELS[program.cost.type]} · {program.cost.description}
                      </p>

                      {/* 핵심 조건/설명 1줄 */}
                      <p className="mt-1.5 line-clamp-1 text-base text-ink-soft">
                        {rec && rec.eligibility.status === "verify_needed" && rec.eligibility.verificationNeeded[0]
                          ? `확인 필요: ${rec.eligibility.verificationNeeded[0]}`
                          : program.summary}
                      </p>

                      {/* 4단: 위치 · 거리 + 바로 신청 · 길찾기 액션 */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-fill pt-3.5 text-sm font-medium text-ink-soft">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                            {hasLocation ? (
                              <>
                                <MapPin className="h-4 w-4 text-brand" />
                                <span>{program.provider}</span>
                              </>
                            ) : (
                              <>
                                <Globe className="h-4 w-4 text-brand" />
                                <span>전국 · 온라인 신청</span>
                              </>
                            )}
                          </span>
                          {distanceHint ? (
                            <span className="rounded-lg bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                              {distanceHint}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {program.applyInfo.url ? (
                            <a
                              href={program.applyInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-strong"
                            >
                              <span>신청하기</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}

                          {hasLocation && program.location ? (
                            <a
                              href={`https://map.kakao.com/link/to/${encodeURIComponent(program.title)},${program.location.coordinates[1]},${program.location.coordinates[0]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand"
                            >
                              <Navigation className="h-3.5 w-3.5 text-brand" />
                              <span>길찾기</span>
                            </a>
                          ) : null}

                          {program.applyInfo.phone ? (
                            <a
                              href={`tel:${program.applyInfo.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-fill-soft px-2.5 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:text-ink"
                              title={`문의 전화: ${program.applyInfo.phone}`}
                            >
                              <PhoneCall className="h-3.5 w-3.5 text-brand" />
                              <span>전화</span>
                            </a>
                          ) : null}

                          <span className="px-1.5 text-xs font-bold text-subtle group-hover:text-brand">
                            상세 →
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {displayedItems.length === 0 ? (
                  <div className="rounded-2xl bg-surface p-12 text-center text-base text-muted shadow-card ring-1 ring-line/70">
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
          <aside id="doran-live-map" className="scroll-mt-24 space-y-4 lg:sticky lg:top-[80px]">
            <div className="relative h-[420px] overflow-hidden rounded-2xl border border-line bg-fill shadow-card lg:h-[560px]">
              <div className="pointer-events-none absolute top-3.5 right-3.5 left-3.5 z-[450] flex flex-wrap items-center justify-between gap-2">
                <div className="pointer-events-auto inline-flex rounded-xl border border-line bg-white/95 p-1 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setMapMode("resources")}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      mapMode === "resources"
                        ? "bg-pine text-white shadow-card"
                        : "text-muted hover:bg-fill"
                    }`}
                  >
                    주변 시설 ({locatedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode("gap")}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      mapMode === "gap" ? "bg-rose-600 text-white" : "text-muted hover:bg-fill"
                    }`}
                  >
                    동네 격차 지도
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleLocateMe()}
                  disabled={locating}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/95 px-3 py-2 text-xs font-bold text-ink shadow-sm backdrop-blur hover:bg-white"
                >
                  <LocateFixed className={`h-3.5 w-3.5 text-brand ${locating ? "animate-spin" : ""}`} />
                  <span>내 위치</span>
                </button>
              </div>

              {pendingPin ? (
                <div className="absolute top-16 left-1/2 z-[460] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink py-2 pr-2.5 pl-4 text-sm font-bold text-white shadow-xl">
                  <button
                    type="button"
                    onClick={confirmPendingLocation}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Crosshair className="h-4 w-4 text-brand-light" />
                    <span>이 위치 기준으로 검색</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPin(null)}
                    aria-label="취소"
                    className="rounded-full p-1 text-faint hover:bg-white/15"
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
                <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-white/95 px-3.5 py-2 text-xs font-semibold text-muted shadow-xs backdrop-blur">
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
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4 shadow-card ring-1 ring-line/70">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">
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
                  <p className="mt-1 text-xs text-muted">
                    수요 {selectedRegion.scores.demandIndex} · 공급 {selectedRegion.scores.supplyIndex}
                    {selectedRegion.scores.shortageCategories.length > 0
                      ? ` · 부족 분야: ${selectedRegion.scores.shortageCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}`
                      : " · 전 분야 균형 양호"}
                  </p>
                </div>

                <Link
                  href={`/report/${selectedRegion.admCd}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-pine px-4 py-2.5 text-xs font-bold text-white shadow-card hover:bg-brand-strong"
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
