"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Globe, List, Map as MapIcon, Search } from "lucide-react";
import { useApp } from "@/components/AppContext";
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
    <div className="flex h-[460px] items-center justify-center rounded-2xl border border-[#e5e8eb] bg-[#eef1f5] text-sm text-[#8b95a1]">
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

  const mapCenter: [number, number] = userCoords
    ? [userCoords.lat, userCoords.lng]
    : selectedRegion
      ? [selectedRegion.center.coordinates[1], selectedRegion.center.coordinates[0]]
      : [37.492, 126.888];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#191f28]">공공자원 전체 탐색</h1>
          <p className="mt-1.5 text-base text-[#4e5968]">
            복지·교육·문화 자원을 분야·비용·운영시간으로 필터링하고 리스트나 지도로 확인하세요.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#e5e8eb] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold ${
              viewMode === "list" ? "bg-[#191f28] text-white" : "text-[#4e5968] hover:bg-[#f2f4f6]"
            }`}
          >
            <List className="h-4 w-4" />
            리스트
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold ${
              viewMode === "map" ? "bg-[#191f28] text-white" : "text-[#4e5968] hover:bg-[#f2f4f6]"
            }`}
          >
            <MapIcon className="h-4 w-4" />
            지도 ({locatedPrograms.length})
          </button>
        </div>
      </div>

      <section className="grid gap-3 rounded-2xl border border-[#e5e8eb] bg-white p-5 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8b95a1]" />
          <input
            type="text"
            aria-label="키워드 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="키워드 검색 (예: 악기, 월세, 어르신, 영어)"
            className="w-full rounded-xl border border-[#d1d6db] bg-[#f9fafb] py-2.5 pr-3.5 pl-10 text-sm text-[#191f28] focus:border-[#0d6e6e] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          aria-label="분야 필터"
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryType | "")}
          className="rounded-xl border border-[#d1d6db] bg-[#f9fafb] px-3.5 py-2.5 text-sm font-semibold text-[#191f28]"
        >
          <option value="">전체 분야</option>
          {(Object.keys(CATEGORY_LABELS) as CategoryType[]).map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          aria-label="비용 필터"
          value={costType}
          onChange={(e) => setCostType(e.target.value as CostType | "")}
          className="rounded-xl border border-[#d1d6db] bg-[#f9fafb] px-3.5 py-2.5 text-sm font-semibold text-[#191f28]"
        >
          <option value="">전체 비용</option>
          {(Object.keys(COST_LABELS) as CostType[]).map((key) => (
            <option key={key} value={key}>
              {COST_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          aria-label="운영시간 필터"
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          className="rounded-xl border border-[#d1d6db] bg-[#f9fafb] px-3.5 py-2.5 text-sm font-semibold text-[#191f28]"
        >
          <option value="">전체 시간대</option>
          {Object.entries(TIME_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between pt-1 sm:col-span-2 lg:col-span-5">
          <p className="text-sm font-semibold text-[#4e5968]">총 {programs.length}개의 공공자원</p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#4e5968]">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="h-4 w-4 rounded accent-[#0d6e6e]"
            />
            마감된 사업 포함
          </label>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-60 animate-pulse rounded-2xl border border-[#e5e8eb] bg-white" />
          ))}
        </div>
      ) : viewMode === "map" ? (
        <div className="space-y-7">
          <ExploreMap programs={locatedPrograms} center={mapCenter} />

          {onlineOrNationwide.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-[#191f28]">
                <Globe className="h-5 w-5 text-[#0d6e6e]" />
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
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-12 text-center text-base text-[#6b7684]">
          선택한 조건에 맞는 공공자원이 없습니다. 필터를 초기화해 보세요.
        </div>
      )}
    </div>
  );
}
