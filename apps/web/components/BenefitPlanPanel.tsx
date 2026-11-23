"use client";

import { useState } from "react";
import { ArrowRight, Printer } from "lucide-react";
import {
  CATEGORY_LABELS,
  type ActionPlanStep,
  type BenefitSummary,
  type HiddenGem,
} from "@/lib/types";

interface BenefitPlanPanelProps {
  summaryMessage?: string;
  benefitSummary?: BenefitSummary | null;
  hiddenGems?: HiddenGem[];
  actionPlan?: ActionPlanStep[];
  consolidatedDocs?: string[];
  onSelectProgram: (programId: string) => void;
  onOpenGuide: () => void;
}

export function BenefitPlanPanel({
  summaryMessage,
  benefitSummary,
  hiddenGems = [],
  actionPlan = [],
  consolidatedDocs = [],
  onSelectProgram,
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
    <section className="overflow-hidden rounded-3xl border border-[#dfe4ea] bg-white shadow-xs">
      {/* 상단: AI 답변 + 핵심 혜택 수치 (한눈에 끝!) */}
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-3xl space-y-3">
            <span className="inline-block text-sm font-extrabold text-[#0d6e6e]">맞춤 분석 결과</span>
            {summaryMessage ? (
              <p className="text-[18px] leading-relaxed font-semibold text-[#111827] sm:text-[19px]">
                {summaryMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 pt-1">
              {monthlyMan > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-[#4b5563]">월 최대</span>
                  <span className="text-2xl font-black text-[#111827] sm:text-[28px]">
                    {monthlyMan.toLocaleString()}만원
                  </span>
                </div>
              ) : null}

              {annualMan > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-[#4b5563]">연 환급·바우처</span>
                  <span className="text-2xl font-black text-[#111827] sm:text-[28px]">
                    {annualMan.toLocaleString()}만원
                  </span>
                </div>
              ) : null}

              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[#4b5563]">무료 시설·강좌</span>
                <span className="text-2xl font-black text-[#0d6e6e] sm:text-[28px]">
                  {benefitSummary.freeResourceCount}곳
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#374151]"
          >
            <Printer className="h-4 w-4" />
            <span>1장 요약지 인쇄</span>
          </button>
        </div>

        {/* 보조 정보는 접어두고 필요할 때만 펼쳐 보기 (시선 분산 원천 차단) */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#eef1f5] pt-4">
          <button
            type="button"
            onClick={() => toggleTab("plan")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === "plan"
                ? "bg-[#111827] text-white"
                : "bg-[#f3f5f8] text-[#374151] hover:bg-[#e5e9f0]"
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
                  ? "bg-[#0d6e6e] text-white"
                  : "bg-[#edf7f7] text-[#0d6e6e] hover:bg-[#dff1f1]"
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
                activeTab === "docs"
                  ? "bg-[#111827] text-white"
                  : "bg-[#f3f5f8] text-[#374151] hover:bg-[#e5e9f0]"
              }`}
            >
              공통 서류 {consolidatedDocs.length}종 {activeTab === "docs" ? "▲" : "▼"}
            </button>
          ) : null}
        </div>
      </div>

      {/* 펼쳐진 탭 본문 */}
      {activeTab !== "none" ? (
        <div className="border-t border-[#eef1f5] bg-[#fafbfc] px-6 py-6 sm:px-8">
          {activeTab === "plan" ? (
            <ol className="divide-y divide-[#e5e9f0]">
              {actionPlan.map((step, idx) => (
                <li key={step.phase} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d6e6e] text-sm font-extrabold text-white">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-lg font-extrabold text-[#111827]">{step.title}</p>
                    <p className="mt-1 text-base text-[#374151]">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {activeTab === "hidden" ? (
            <div className="divide-y divide-[#e5e9f0]">
              {hiddenGems.map((gem) => (
                <button
                  key={gem.program.id}
                  type="button"
                  onClick={() => onSelectProgram(gem.program.id)}
                  className="group flex w-full items-center justify-between gap-4 py-4 text-left first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#0d6e6e]">
                      {CATEGORY_LABELS[gem.program.category]} · {gem.program.cost.description}
                    </p>
                    <p className="text-lg font-extrabold text-[#111827] group-hover:text-[#0d6e6e]">
                      {gem.program.title}
                    </p>
                    <p className="text-base text-[#374151]">{gem.reason}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#6b7280] transition-transform group-hover:translate-x-1 group-hover:text-[#0d6e6e]" />
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === "docs" ? (
            <div className="space-y-3">
              <p className="text-base font-medium text-[#374151]">
                여러 지원사업에 공통으로 쓰이는 서류입니다. 한 번에 준비하면 신청이 빨라집니다.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {consolidatedDocs.map((doc) => (
                  <span
                    key={doc}
                    className="rounded-xl border border-[#dfe4ea] bg-white px-4 py-2.5 text-base font-bold text-[#111827]"
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
