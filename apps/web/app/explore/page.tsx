"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Globe, List, Map as MapIcon, RotateCcw, Search } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { PageHeader } from "@/components/PageHeader";
import { ProgramCard } from "@/components/ProgramCard";
import { fetchPrograms } from "@/lib/api";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  TIME_LABELS,
  type CategoryType,
  type CostType,
  type Program,
} from "@/lib/types";

const ExploreMap = dynamic(() => import("@/components/ExploreMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-2xl border border-line bg-fill text-sm text-faint">
      지도를 불러오는 중…
    </div>
  ),
});

export default function ExplorePage() {
  const { selectedRegion, userCoords } = useApp();
  const [category, setCategory] = useState<CategoryType | "">("");
  const [costType, setCostType] = useState<CostType | "">("");
  const [timeSlot, setTimeSlot] = useState("");
  const [keyword, setKeyword] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      fetchPrograms({
        category,
        costType,
        timeSlot: timeSlot || undefined,
        q: keyword.trim() || undefined,
        includeClosed,
        limit: 60,
      })
        .then(setPrograms)
        .catch(() => setPrograms([]))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [category, costType, timeSlot, keyword, includeClosed]);

  const locatedPrograms = programs.filter((p) => p.location?.coordinates?.length === 2);
  const onlineOrNationwide = programs.filter((p) => !p.location);
  const hasFilters = Boolean(category || costType || timeSlot || keyword.trim() || includeClosed);

  const resetFilters = () => {
    setCategory("");
    setCostType("");
    setTimeSlot("");
    setKeyword("");
    setIncludeClosed(false);
  };

  const mapCenter: [number, number] = userCoords
    ? [userCoords.lat, userCoords.lng]
    : selectedRegion
      ? [selectedRegion.center.coordinates[1], selectedRegion.center.coordinates[0]]
      : [37.492, 126.888];

  return (
    <div className="space-y-6">
      <PageHeader
        title="공공자원 전체 탐색"
        description="복지·교육·문화 자원을 분야·비용·운영시간으로 필터링하고 리스트나 지도로 확인하세요."
        actions={
          <div className="inline-flex rounded-xl bg-surface p-1 shadow-card ring-1 ring-line/70">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                viewMode === "list" ? "bg-pine text-white" : "text-muted hover:bg-fill hover:text-ink"
              }`}
            >
              <List className="h-4 w-4" />
              리스트
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              aria-pressed={viewMode === "map"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                viewMode === "map" ? "bg-pine text-white" : "text-muted hover:bg-fill hover:text-ink"
              }`}
            >
              <MapIcon className="h-4 w-4" />
              지도 ({locatedPrograms.length})
            </button>
          </div>
        }
      />

      <section className="z-20 grid gap-3 rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line/70 sm:grid-cols-2 lg:sticky lg:top-[76px] lg:grid-cols-4">
        <div>
          <label htmlFor="explore-keyword" className="mb-1.5 block text-xs font-bold text-subtle">
            키워드
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="explore-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 악기, 월세, 어르신, 영어"
              className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pr-3.5 pl-10 text-sm text-ink placeholder-faint focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="explore-category" className="mb-1.5 block text-xs font-bold text-subtle">
            분야
          </label>
          <select
            id="explore-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryType | "")}
            className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
          >
            <option value="">전체 분야</option>
            {(Object.keys(CATEGORY_LABELS) as CategoryType[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="explore-cost" className="mb-1.5 block text-xs font-bold text-subtle">
            비용
          </label>
          <select
            id="explore-cost"
            value={costType}
            onChange={(e) => setCostType(e.target.value as CostType | "")}
            className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
          >
            <option value="">전체 비용</option>
            {(Object.keys(COST_LABELS) as CostType[]).map((key) => (
              <option key={key} value={key}>
                {COST_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="explore-time" className="mb-1.5 block text-xs font-bold text-subtle">
            운영시간
          </label>
          <select
            id="explore-time"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
          >
            <option value="">전체 시간대</option>
            {Object.entries(TIME_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fill pt-3 sm:col-span-2 lg:col-span-4">
          <p className="text-sm font-bold text-ink">
            총 {programs.length}개의 공공자원
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand-soft"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                필터 초기화
              </button>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(e) => setIncludeClosed(e.target.checked)}
                className="h-4 w-4 rounded accent-brand"
              />
              마감된 사업 포함
            </label>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-60 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      ) : viewMode === "map" ? (
        <div className="space-y-7">
          <ExploreMap programs={locatedPrograms} center={mapCenter} />

          {onlineOrNationwide.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-ink">
                <Globe className="h-5 w-5 text-brand" />
                <span>좌표가 없는 전국·온라인 대상 자원 ({onlineOrNationwide.length}건)</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {onlineOrNationwide.map((prog) => (
                  <ProgramCard key={prog.id} program={prog} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : programs.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((prog) => (
            <ProgramCard key={prog.id} program={prog} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <Search className="h-9 w-9 text-line-strong" aria-hidden="true" />
          <p className="mt-3 text-base font-bold text-ink">조건에 맞는 공공자원이 없어요</p>
          <p className="mt-1 text-sm text-muted">검색어를 줄이거나 필터를 초기화해 보세요.</p>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-strong"
            >
              <RotateCcw className="h-4 w-4" />
              필터 초기화
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
