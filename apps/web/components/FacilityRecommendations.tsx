"use client";

import { Building2, PlusCircle, TrendingDown, Users } from "lucide-react";
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
  recommended: { label: "보완 권장", style: "bg-[#edf7f7] text-[#0d6e6e]" },
};

export function FacilityRecommendations({
  region,
  facilities,
  onApplyToSimulator,
}: FacilityRecommendationsProps) {
  if (!facilities.length) return null;

  const total = Math.max(region.population.total, 1);
  const seniorPct = Math.round((region.population.senior / total) * 1000) / 10;
  const youthPct = Math.round((region.population.youth / total) * 1000) / 10;
  const otherPct = Math.max(0, Math.round((100 - seniorPct - youthPct) * 10) / 10);
  const vulnPct = Math.round(region.population.vulnerableRatio * 1000) / 10;

  return (
    <section className="space-y-5 rounded-3xl border border-[#dfe4ea] bg-white p-6 shadow-xs sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0d6e6e]">
            <Building2 className="h-4 w-4" />
            <span>인구 분포 × 미보유 인프라 교차 분석</span>
          </div>
          <h2 className="mt-1 text-2xl font-extrabold text-[#111827]">
            {region.sigungu} {region.dong}에 가장 필요한 공공시설 추천
          </h2>
          <p className="mt-1 text-base text-[#374151]">
            연령대별 인구 밀집도와 현재 동 내 실제 보유 시설을 대조해 지금 없는 필수 시설을 제안합니다.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#f3f5f8] px-4 py-2 text-sm font-bold text-[#111827]">
          <Users className="h-4 w-4 text-[#0d6e6e]" />
          취약계층 비율 {vulnPct}%
        </span>
      </div>

      {/* 인구 구성 비율 바 */}
      <div className="rounded-2xl bg-[#f6f7f9] p-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-[#111827]">
          <span>{region.dong} 인구 구성 ({region.population.total.toLocaleString()}명)</span>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              어르신(65세+) {seniorPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#0d6e6e]" />
              청년 {youthPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-slate-400" />
              일반·가족 {otherPct}%
            </span>
          </div>
        </div>

        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#dfe4ea]">
          <div style={{ width: `${seniorPct}%` }} className="bg-rose-500" title={`어르신 ${seniorPct}%`} />
          <div style={{ width: `${youthPct}%` }} className="bg-[#0d6e6e]" title={`청년 ${youthPct}%`} />
          <div style={{ width: `${otherPct}%` }} className="bg-slate-400" title={`일반·가족 ${otherPct}%`} />
        </div>
      </div>

      {/* 필요 시설 추천 카드 */}
      <div className="grid gap-5 md:grid-cols-2">
        {facilities.map((item) => {
          const prio = PRIORITY_META[item.priority];
          const isMissing = item.currentInDongCount === 0;

          return (
            <article
              key={item.name}
              className="flex flex-col justify-between rounded-2xl border border-[#dfe4ea] bg-[#fafbfc] p-6 transition-all hover:border-[#0d6e6e] hover:bg-white hover:shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${prio.style}`}>
                    {prio.label}
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#374151] ring-1 ring-[#dfe4ea]">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                      isMissing ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-[#374151]"
                    }`}
                  >
                    {item.currentStatus}
                  </span>
                </div>

                <h3 className="mt-3 text-xl font-extrabold leading-snug text-[#111827]">{item.name}</h3>
                <p className="mt-1 text-sm font-bold text-[#0d6e6e]">핵심 수요층: {item.targetDemographic}</p>
                <p className="mt-2.5 text-base leading-relaxed text-[#374151]">{item.rationale}</p>

                <div className="mt-4 rounded-xl border border-[#e5e9f0] bg-white px-4 py-3 text-sm text-[#374151]">
                  <span className="font-bold text-[#111827]">추천 조성 방안: </span>
                  {item.deliverySuggestion}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e9f0] pt-4">
                <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                  <TrendingDown className="h-4 w-4" />
                  도입 시 격차 약 -{item.estimatedGapReduction}p 개선
                </span>

                <button
                  type="button"
                  onClick={() => onApplyToSimulator(item.category, item.name)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0d6e6e]"
                >
                  <PlusCircle className="h-4 w-4" />
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
