"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, XCircle } from "lucide-react";
import { CATEGORY_LABELS, type ExcludedProgram } from "@/lib/types";

interface ExcludedTransparencyPanelProps {
  totalEvaluatedCount: number;
  totalExcludedCount: number;
  excludedPrograms: ExcludedProgram[];
}

export function ExcludedTransparencyPanel({
  totalEvaluatedCount,
  totalExcludedCount,
  excludedPrograms,
}: ExcludedTransparencyPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalExcludedCount === 0) return null;

  return (
    <section className="rounded-3xl bg-surface shadow-card ring-1 ring-line/70">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-fill-soft"
      >
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
          <div>
            <p className="text-base font-extrabold text-ink">
              자격·마감 검증 투명 리포트: 전체 {totalEvaluatedCount}건 중{" "}
              <span className="text-rose-600">{totalExcludedCount}건 자동 제외</span>
            </p>
            <p className="mt-1 text-sm text-subtle">
              감이나 추측에 맡기지 않고 연령·거주지·마감일 규칙으로 자격이 안 되는 사업을 사전에 걸러냈습니다.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-fill px-4 py-2 text-sm font-bold text-ink-soft">
          <span>{expanded ? "접기" : "제외 사유 보기"}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-fill px-6 py-4">
          <div className="divide-y divide-fill">
            {excludedPrograms.map((item) => (
              <div
                key={item.programId}
                className="flex flex-col justify-between gap-2.5 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm text-faint">
                    <span className="font-semibold text-muted">{CATEGORY_LABELS[item.category]}</span>
                    <span>·</span>
                    <span>{item.provider}</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-ink">{item.title}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700"
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      <span>{reason}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {totalExcludedCount > excludedPrograms.length ? (
            <p className="mt-3 text-sm text-faint">
              외 {totalExcludedCount - excludedPrograms.length}건도 동일한 자격·지역·마감 규칙으로 제외되었습니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
