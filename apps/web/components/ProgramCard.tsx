"use client";

import Link from "next/link";
import { Bookmark, Check, Clock, Globe, MapPin, Scale, ShieldAlert } from "lucide-react";
import { useApp } from "./AppContext";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  formatDeadlineBadge,
  formatDistanceWithWalk,
  type EligibilityEvaluation,
  type Program,
} from "@/lib/types";

interface ProgramCardProps {
  program: Program;
  eligibility?: EligibilityEvaluation;
  explanation?: string;
}

const CATEGORY_DOT: Record<Program["category"], string> = {
  welfare: "bg-emerald-600",
  education: "bg-blue-600",
  culture: "bg-amber-600",
};

export function ProgramCard({ program, eligibility, explanation }: ProgramCardProps) {
  const { savedIds, toggleSave, compareList, toggleCompare } = useApp();
  const isSaved = savedIds.has(program.id);
  const isCompared = compareList.some((p) => p.id === program.id);
  const syncedDate = program.source.syncedAt.slice(0, 10);
  const distanceHint = formatDistanceWithWalk(program.distanceKm);

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-[#e5e8eb] bg-white p-5 shadow-xs transition-all hover:border-[#b0b8c1] hover:shadow-sm sm:p-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#4e5968]">
            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[program.category]}`} />
            <span className="text-[#191f28]">{CATEGORY_LABELS[program.category]}</span>
            <span className="text-[#d1d6db]">·</span>
            <span>{COST_LABELS[program.cost.type]}</span>
            <span className="text-[#d1d6db]">·</span>
            <span className="font-bold text-[#0d6e6e]">{formatDeadlineBadge(program)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleCompare(program)}
              aria-label={isCompared ? `${program.title} 비교에서 제거` : `${program.title} 비교함에 담기`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors ${
                isCompared
                  ? "border-[#191f28] bg-[#191f28] text-white"
                  : "border-[#e5e8eb] bg-white text-[#4e5968] hover:bg-[#f6f7f9]"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>{isCompared ? "비교 중" : "비교"}</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleSave(program.id)}
              aria-label={isSaved ? `${program.title} 체크리스트에서 제거` : `${program.title} 체크리스트에 저장`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors ${
                isSaved
                  ? "border-[#0d6e6e] bg-[#edf7f7] text-[#0d6e6e]"
                  : "border-[#e5e8eb] bg-white text-[#4e5968] hover:bg-[#f6f7f9]"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-[#0d6e6e]" : ""}`} />
              <span>{isSaved ? "저장됨" : "저장"}</span>
            </button>
          </div>
        </div>

        <Link href={`/programs/${program.id}`} className="group block">
          <h3 className="text-[18px] font-extrabold leading-snug text-[#191f28] group-hover:text-[#0d6e6e]">
            {program.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#4e5968]">{program.summary}</p>
        </Link>

        {eligibility ? (
          <div
            className={`mt-3 rounded-xl px-3.5 py-2.5 text-xs ${
              eligibility.status === "eligible"
                ? "bg-emerald-50 text-emerald-950"
                : "bg-amber-50 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {eligibility.status === "eligible" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>신청 가능성 높음</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  <span>별도 확인 필요: {eligibility.verificationNeeded[0]}</span>
                </>
              )}
            </div>
            {explanation ? <p className="mt-1 text-[#333d4b]">{explanation}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 border-t border-[#f2f4f6] pt-3.5 text-xs text-[#6b7684]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#333d4b]">
            {program.location ? (
              <>
                <MapPin className="h-3.5 w-3.5 text-[#0d6e6e]" />
                <span>{program.provider}</span>
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5 text-[#0d6e6e]" />
                <span>전국 · 온라인 신청</span>
              </>
            )}
          </span>
          {distanceHint ? (
            <span className="rounded-md bg-[#edf7f7] px-2 py-0.5 font-bold text-[#0d6e6e]">
              {distanceHint}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 text-[#6b7684]">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#8b95a1]" />
          <span className="truncate">
            {program.schedule.hoursText} · {program.cost.description}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-[#8b95a1]">
          <span>
            {program.source.name} ({syncedDate})
          </span>
          <Link href={`/programs/${program.id}`} className="font-bold text-[#0d6e6e] hover:underline">
            자세히 보기 →
          </Link>
        </div>
      </div>
    </article>
  );
}
