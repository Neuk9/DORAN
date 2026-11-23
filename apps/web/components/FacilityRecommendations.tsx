"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronUp, PlusCircle, TrendingDown, Users } from "lucide-react";
import {
  CATEGORY_LABELS,
  type CategoryType,
  type RecommendedFacility,
  type RegionStat,
} from "@/lib/types";

interface FacilityRecommendationsProps {
  region: RegionStat;
  facilities: RecommendedFacility[];
  onApplyToSimulator: (category: CategoryType, facilityName: string) => void;
}

const PRIORITY_META = {
  urgent: { label: "도입 시급", style: "bg-rose-100 text-rose-800" },
  high: { label: "우선 권장", style: "bg-amber-100 text-amber-900" },
  recommended: { label: "보완 권장", style: "bg-brand-soft text-brand" },
};

export function FacilityRecommendations({
  region,
  facilities,
  onApplyToSimulator,
}: FacilityRecommendationsProps) {
  const [expandedNames, setExpandedNames] = useState<Record<string, boolean>>({});

  if (!facilities.length) return null;

  const toggleExpand = (name: string) => {
    setExpandedNames((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const total = Math.max(region.population.total, 1);
  const seniorPct = Math.round((region.population.senior / total) * 1000) / 10;
  const youthPct = Math.round((region.population.youth / total) * 1000) / 10;
  const otherPct = Math.max(0, Math.round((100 - seniorPct - youthPct) * 10) / 10);
  const vulnPct = Math.round(region.population.vulnerableRatio * 1000) / 10;

  return (
    <section className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-brand" />
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">
            {region.dong}에 필요한 공공시설 추천
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill-soft px-3.5 py-1.5 text-sm font-bold text-ink">
          <Users className="h-4 w-4 text-brand" />
          취약계층 비율 {vulnPct}%
        </span>
      </div>

      {/* 인구 구성 비율 바 */}
      <div className="rounded-xl border border-line bg-fill-soft p-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-ink">
          <span>{region.dong} 인구 구성 ({region.population.total.toLocaleString()}명)</span>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              어르신(65세+) {seniorPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              청년 {youthPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              일반·가족 {otherPct}%
            </span>
          </div>
        </div>

        <div className="flex h-3 w-full overflow-hidden rounded-full bg-fill">
          <div style={{ width: `${seniorPct}%` }} className="bg-rose-500/80" title={`어르신 ${seniorPct}%`} />
          <div style={{ width: `${youthPct}%` }} className="bg-brand" title={`청년 ${youthPct}%`} />
          <div style={{ width: `${otherPct}%` }} className="bg-slate-300" title={`일반·가족 ${otherPct}%`} />
        </div>
      </div>

      {/* 필요 시설 추천 카드 (클릭 시 상세 설명 펼침) */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {facilities.map((item) => {
          const prio = PRIORITY_META[item.priority];
          const isMissing = item.currentInDongCount === 0;
          const isOpen = Boolean(expandedNames[item.name]);

          return (
            <article
              key={item.name}
              className={`rounded-2xl border bg-surface transition-colors ${
                isOpen ? "border-brand/50 shadow-card" : "border-line hover:border-line-strong"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(item.name)}
                aria-expanded={isOpen}
                className="w-full p-5 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-2.5 py-0.5 text-xs font-extrabold ${prio.style}`}>
                      {prio.label}
                    </span>
                    <span className="rounded-md bg-fill px-2.5 py-0.5 text-xs font-bold text-ink">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                        isMissing ? "bg-rose-50 text-rose-700" : "bg-fill-soft text-muted"
                      }`}
                    >
                      {item.currentStatus}
                    </span>
                  </div>
                  <span className="mt-0.5 shrink-0 rounded-lg p-1 text-subtle">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </div>

                <h3 className="mt-3 text-[19px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
                  {item.name}
                </h3>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-brand">{item.targetDemographic}</span>
                  <span className="text-line-strong">·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-ink-soft">
                    <TrendingDown className="h-3.5 w-3.5 text-brand" />
                    격차 약 -{item.estimatedGapReduction}p
                  </span>
                </div>
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t border-line px-5 py-4">
                  <p className="text-[15px] font-medium leading-[1.7] text-ink">{item.rationale}</p>
                  <div className="rounded-xl border border-line bg-fill-soft px-4 py-3 text-[14px] leading-[1.6] text-ink-soft">
                    <span className="font-extrabold text-ink">추천 조성 방안 · </span>
                    {item.deliverySuggestion}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(item.name)}
                  className="text-xs font-bold text-subtle hover:text-ink"
                >
                  {isOpen ? "설명 접기" : "추천 이유 · 조성 방안 보기"}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyToSimulator(item.category, item.name);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>시뮬레이터에 반영</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
