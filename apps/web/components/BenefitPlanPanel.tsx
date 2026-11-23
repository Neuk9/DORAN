"use client";

import { ArrowRight, CheckCircle2, FileStack, Gift, Layers, Wallet } from "lucide-react";
import {
  CATEGORY_LABELS,
  type ActionPlanStep,
  type BenefitSummary,
  type HiddenGem,
} from "@/lib/types";

interface BenefitPlanPanelProps {
  benefitSummary?: BenefitSummary | null;
  hiddenGems?: HiddenGem[];
  actionPlan?: ActionPlanStep[];
  consolidatedDocs?: string[];
  onSelectProgram: (programId: string) => void;
}

export function BenefitPlanPanel({
  benefitSummary,
  hiddenGems = [],
  actionPlan = [],
  consolidatedDocs = [],
  onSelectProgram,
}: BenefitPlanPanelProps) {
  if (!benefitSummary) return null;

  const hasMoney = benefitSummary.estimatedMonthlyKRW > 0 || benefitSummary.estimatedAnnualKRW > 0;

  return (
    <section className="space-y-5">
      {/* 1) 예상 혜택 합산 카드 */}
      <div className="rounded-3xl border border-[#cce4e4] bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[#0d6e6e]">
            <Wallet className="h-5 w-5" />
            <span>내 조건으로 챙길 수 있는 예상 혜택 요약</span>
          </div>
          <span className="text-sm text-[#8b95a1]">중복 수혜 여부는 기관별 최종 확인 필요</span>
        </div>

        <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#191f28] sm:text-[28px]">
          {benefitSummary.headline}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f6f7f9] px-5 py-4">
            <p className="text-sm font-semibold text-[#6b7684]">월 단위 예상 지원</p>
            <p className="mt-1.5 text-2xl font-extrabold text-[#191f28]">
              {benefitSummary.estimatedMonthlyKRW > 0
                ? `최대 ${(benefitSummary.estimatedMonthlyKRW / 10000).toLocaleString()}만원`
                : hasMoney
                  ? "연 단위 지원 중심"
                  : "현물 · 서비스 중심"}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f6f7f9] px-5 py-4">
            <p className="text-sm font-semibold text-[#6b7684]">연 단위 · 바우처 환급</p>
            <p className="mt-1.5 text-2xl font-extrabold text-[#191f28]">
              {benefitSummary.estimatedAnnualKRW > 0
                ? `최대 ${(benefitSummary.estimatedAnnualKRW / 10000).toLocaleString()}만원`
                : `지원금 제도 ${benefitSummary.subsidyCount}건`}
            </p>
          </div>
          <div className="rounded-2xl bg-[#edf7f7] px-5 py-4">
            <p className="text-sm font-semibold text-[#0d6e6e]">무료 이용 시설 · 강좌</p>
            <p className="mt-1.5 text-2xl font-extrabold text-[#0d6e6e]">
              {benefitSummary.freeResourceCount}곳 바로 이용
            </p>
          </div>
        </div>

        {/* 3단계 실행 플랜 */}
        {actionPlan.length > 0 ? (
          <div className="mt-6 border-t border-[#f2f4f6] pt-5">
            <div className="mb-3.5 flex items-center gap-2 text-sm font-bold text-[#333d4b]">
              <Layers className="h-4 w-4 text-[#0d6e6e]" />
              <span>추천 신청 · 이용 순서</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {actionPlan.map((step) => (
                <div
                  key={step.phase}
                  className="rounded-2xl border border-[#e5e8eb] bg-[#fafbfc] p-5"
                >
                  <span className="text-xs font-extrabold text-[#0d6e6e]">{step.phase}</span>
                  <p className="mt-1.5 text-base font-extrabold text-[#191f28]">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#4e5968]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 중복 제거된 통합 구비서류 */}
        {consolidatedDocs.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-2xl bg-[#f9fafb] px-5 py-4 text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#191f28]">
              <FileStack className="h-4 w-4 text-[#0d6e6e]" />
              한 번에 준비하면 좋은 공통 서류
            </span>
            {consolidatedDocs.slice(0, 6).map((doc) => (
              <span
                key={doc}
                className="rounded-xl border border-[#e5e8eb] bg-white px-3 py-1.5 text-sm font-semibold text-[#333d4b]"
              >
                {doc}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* 2) 놓치기 쉬운 숨은 혜택 선제 발굴 */}
      {hiddenGems.length > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6 sm:p-7">
          <div className="flex items-center gap-2 text-base font-extrabold text-[#191f28]">
            <Gift className="h-5 w-5 text-amber-600" />
            <span>질문하지 않으셨지만 함께 챙길 수 있는 숨은 혜택</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hiddenGems.map((gem) => (
              <button
                key={gem.program.id}
                type="button"
                onClick={() => onSelectProgram(gem.program.id)}
                className="group flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-white p-5 text-left transition-all hover:border-[#0d6e6e] hover:shadow-sm"
              >
                <div>
                  <span className="text-xs font-bold text-amber-700">
                    {CATEGORY_LABELS[gem.program.category]} · {gem.program.cost.description}
                  </span>
                  <p className="mt-1.5 text-[17px] font-extrabold leading-snug text-[#191f28] group-hover:text-[#0d6e6e]">
                    {gem.program.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#4e5968]">{gem.reason}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#0d6e6e]">
                  <CheckCircle2 className="h-4 w-4" />
                  자세히 확인
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
