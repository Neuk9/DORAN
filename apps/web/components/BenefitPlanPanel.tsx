"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink, MapPin, Navigation, Phone, Printer } from "lucide-react";
import {
  CATEGORY_LABELS,
  formatDistanceWithWalk,
  type ActionPlanStep,
  type BenefitSummary,
  type HiddenGem,
  type RecommendedProgram,
} from "@/lib/types";

interface BenefitPlanPanelProps {
  summaryMessage?: string;
  benefitSummary?: BenefitSummary | null;
  topRecommendations?: RecommendedProgram[];
  hiddenGems?: HiddenGem[];
  actionPlan?: ActionPlanStep[];
  consolidatedDocs?: string[];
  onSelectProgram: (programId: string) => void;
  onFocusMap?: (programId: string) => void;
  onOpenGuide: () => void;
}

export function BenefitPlanPanel({
  summaryMessage,
  benefitSummary,
  topRecommendations = [],
  hiddenGems = [],
  actionPlan = [],
  consolidatedDocs = [],
  onSelectProgram,
  onFocusMap,
  onOpenGuide,
}: BenefitPlanPanelProps) {
  const [activeTab, setActiveTab] = useState<"none" | "plan" | "hidden" | "docs">("none");

  if (!benefitSummary) return null;

  const monthlyMan = Math.round(benefitSummary.estimatedMonthlyKRW / 10000);
  const annualMan = Math.round(benefitSummary.estimatedAnnualKRW / 10000);

  const toggleTab = (tab: "plan" | "hidden" | "docs") => {
    setActiveTab((prev) => (prev === tab ? "none" : tab));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* 상단: AI 답변 + 핵심 혜택 수치 */}
      <div className="px-6 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-3xl space-y-2.5">
            <span className="inline-flex items-center rounded-md bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand">
              맞춤 분석 결과
            </span>
            {summaryMessage ? (
              <p className="text-[19px] leading-relaxed font-bold tracking-[-0.02em] text-ink sm:text-[21px]">
                {summaryMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 pt-1">
              {monthlyMan > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-muted">월 최대</span>
                  <span className="text-2xl font-black text-brand sm:text-[30px]">
                    {monthlyMan.toLocaleString()}만원
                  </span>
                </div>
              ) : null}

              {annualMan > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-muted">연 환급·바우처</span>
                  <span className="text-2xl font-black text-brand sm:text-[30px]">
                    {annualMan.toLocaleString()}만원
                  </span>
                </div>
              ) : null}

              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-muted">무료 시설·강좌</span>
                <span className="text-2xl font-black text-ink sm:text-[30px]">
                  {benefitSummary.freeResourceCount}곳
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-pine px-4 py-2.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-strong"
          >
            <Printer className="h-4 w-4" />
            <span>1장 요약지 인쇄</span>
          </button>
        </div>

        {/* 맞춤 분석 직후 1클릭 바로 신청 · 장소 찾기 */}
        {topRecommendations.length > 0 ? (
          <div className="mt-6 space-y-2.5 border-t border-line pt-5">
            <p className="text-xs font-bold text-subtle">바로 신청 · 장소 찾기 (상위 추천)</p>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {topRecommendations.slice(0, 2).map(({ program }) => {
                const dist = formatDistanceWithWalk(program.distanceKm);
                const kakaoRouteUrl =
                  program.location?.coordinates?.length === 2
                    ? `https://map.kakao.com/link/to/${encodeURIComponent(program.title)},${program.location.coordinates[1]},${program.location.coordinates[0]}`
                    : null;

                return (
                  <div
                    key={program.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-fill-soft/80 p-4 sm:flex-row sm:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProgram(program.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-[15px] font-extrabold text-ink hover:text-brand">
                        {program.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-muted">
                        {program.provider}
                        {dist ? ` · ${dist}` : " · 온라인 신청"}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {program.applyInfo.url ? (
                        <a
                          href={program.applyInfo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-strong"
                        >
                          <span>바로 신청</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}

                      {kakaoRouteUrl ? (
                        <a
                          href={kakaoRouteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand"
                        >
                          <Navigation className="h-3.5 w-3.5 text-brand" />
                          <span>길찾기</span>
                        </a>
                      ) : null}

                      {program.location && onFocusMap ? (
                        <button
                          type="button"
                          onClick={() => onFocusMap(program.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-muted transition-colors hover:text-ink"
                          title="지도에서 위치 보기"
                        >
                          <MapPin className="h-3.5 w-3.5 text-brand" />
                          <span>지도</span>
                        </button>
                      ) : null}

                      {!program.applyInfo.url && program.applyInfo.phone ? (
                        <a
                          href={`tel:${program.applyInfo.phone}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>전화 문의</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* 보조 정보는 접어두고 필요할 때만 펼쳐 보기 (시선 분산 원천 차단) */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          <button
            type="button"
            onClick={() => toggleTab("plan")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === "plan" ? "bg-pine text-white" : "bg-fill text-ink-soft hover:bg-line"
            }`}
          >
            신청 · 이용 순서 {activeTab === "plan" ? "▲" : "▼"}
          </button>

          {hiddenGems.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleTab("hidden")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === "hidden"
                  ? "bg-brand text-white"
                  : "bg-brand-soft text-brand hover:bg-brand-line/40"
              }`}
            >
              연계 숨은 혜택 {hiddenGems.length}건 {activeTab === "hidden" ? "▲" : "▼"}
            </button>
          ) : null}

          {consolidatedDocs.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleTab("docs")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === "docs" ? "bg-pine text-white" : "bg-fill text-ink-soft hover:bg-line"
              }`}
            >
              공통 서류 {consolidatedDocs.length}종 {activeTab === "docs" ? "▲" : "▼"}
            </button>
          ) : null}
        </div>
      </div>

      {/* 펼쳐진 탭 본문 */}
      {activeTab !== "none" ? (
        <div className="border-t border-fill bg-fill-soft px-6 py-6 sm:px-8">
          {activeTab === "plan" ? (
            <ol className="divide-y divide-line">
              {actionPlan.map((step, idx) => (
                <li key={step.phase} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-lg font-extrabold text-ink">{step.title}</p>
                    <p className="mt-1 text-base text-ink-soft">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {activeTab === "hidden" ? (
            <div className="divide-y divide-line">
              {hiddenGems.map((gem) => (
                <button
                  key={gem.program.id}
                  type="button"
                  onClick={() => onSelectProgram(gem.program.id)}
                  className="group flex w-full items-center justify-between gap-4 py-4 text-left first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-brand">
                      {CATEGORY_LABELS[gem.program.category]} · {gem.program.cost.description}
                    </p>
                    <p className="text-lg font-extrabold text-ink group-hover:text-brand">
                      {gem.program.title}
                    </p>
                    <p className="text-base text-ink-soft">{gem.reason}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === "docs" ? (
            <div className="space-y-3">
              <p className="text-base font-medium text-ink-soft">
                여러 지원사업에 공통으로 쓰이는 서류입니다. 한 번에 준비하면 신청이 빨라집니다.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {consolidatedDocs.map((doc) => (
                  <span
                    key={doc}
                    className="rounded-xl border border-line bg-white px-4 py-2.5 text-base font-bold text-ink"
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
