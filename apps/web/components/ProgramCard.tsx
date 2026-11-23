"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  MapPin,
  Scale,
  ShieldAlert,
} from "lucide-react";
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
  collapsible?: boolean;
}

const CATEGORY_STYLE: Record<Program["category"], { dot: string; chip: string }> = {
  welfare: { dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800" },
  education: { dot: "bg-blue-600", chip: "bg-blue-50 text-blue-800" },
  culture: { dot: "bg-amber-600", chip: "bg-amber-50 text-amber-800" },
};

const ACTION_BASE =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors";

export function ProgramCard({
  program,
  eligibility,
  explanation,
  collapsible = false,
}: ProgramCardProps) {
  const { savedIds, toggleSave, compareList, toggleCompare } = useApp();
  const [expanded, setExpanded] = useState(!collapsible);
  const isSaved = savedIds.has(program.id);
  const isCompared = compareList.some((p) => p.id === program.id);
  const syncedDate = program.source.syncedAt.slice(0, 10);
  const distanceHint = formatDistanceWithWalk(program.distanceKm);
  const style = CATEGORY_STYLE[program.category];
  const deadlineSoon =
    !program.isAlwaysOpen &&
    Boolean(program.deadline) &&
    new Date(program.deadline as string).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <article
      className={`group flex flex-col rounded-2xl border bg-surface transition-colors ${
        collapsible ? "" : "h-full"
      } ${
        collapsible && expanded
          ? "border-brand/50 shadow-card"
          : "border-line hover:border-line-strong hover:shadow-card"
      }`}
    >
      {/* 상단 메타: 분야 · 마감 · 거리 */}
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${style.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {CATEGORY_LABELS[program.category]}
          </span>
          {distanceHint ? (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold text-brand">
              {distanceHint}
            </span>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold leading-none ${
            deadlineSoon ? "bg-accent-soft text-accent" : "bg-fill text-ink-soft"
          }`}
        >
          {formatDeadlineBadge(program)}
        </span>
      </div>

      {/* 제목 + 핵심 비용 + 기관명 */}
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="block w-full px-5 pb-4 pt-3 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-ink group-hover:text-brand">
              {program.title}
            </h3>
            <span className="mt-0.5 shrink-0 rounded-lg p-1 text-subtle">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-bold text-brand">
            {COST_LABELS[program.cost.type]} · {program.cost.description}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            {program.location ? (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="truncate">{program.provider}</span>
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="truncate">전국 · 온라인 신청</span>
              </>
            )}
          </p>
        </button>
      ) : (
        <Link href={`/programs/${program.id}`} className="block px-5 pb-3 pt-3">
          <h3 className="line-clamp-2 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-ink transition-colors group-hover:text-brand">
            {program.title}
          </h3>
          <p className="mt-1.5 text-sm font-bold text-brand">
            {COST_LABELS[program.cost.type]} · {program.cost.description}
          </p>
        </Link>
      )}

      {/* 상세 설명 영역 (collapsible 모드에서는 클릭 시 펼침) */}
      {expanded ? (
        <div
          className={
            collapsible
              ? "space-y-3 border-t border-line bg-fill-soft/60 px-5 py-4"
              : "flex flex-1 flex-col px-5 pb-4"
          }
        >
          <p className="text-[15px] font-medium leading-[1.65] text-ink">{program.summary}</p>

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
              {explanation ? <p className="mt-1 leading-relaxed">{explanation}</p> : null}
            </div>
          ) : null}

          <div className={collapsible ? "space-y-1.5 pt-1 text-xs" : "mt-auto space-y-1.5 pt-3 text-xs"}>
            {!collapsible ? (
              <div className="flex items-center gap-1.5 font-semibold text-ink-soft">
                {program.location ? (
                  <>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">{program.provider}</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">전국 · 온라인 신청</span>
                  </>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-1.5 font-medium text-ink-soft">
              <Clock className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="truncate">{program.schedule.hoursText}</span>
            </div>

            <p className="truncate text-[12px] font-medium text-muted">
              {program.source.name} ({syncedDate})
            </p>
          </div>
        </div>
      ) : null}

      {/* 하단 액션 바 */}
      <div className="flex items-center justify-between gap-1 border-t border-line px-3.5 py-2.5">
        <div className="flex items-center gap-0.5">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className={`${ACTION_BASE} text-muted hover:bg-fill hover:text-ink`}
            >
              <span>{expanded ? "설명 접기" : "설명 보기"}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => toggleCompare(program)}
            aria-label={isCompared ? `${program.title} 비교에서 제거` : `${program.title} 비교함에 담기`}
            aria-pressed={isCompared}
            className={`${ACTION_BASE} ${
              isCompared ? "bg-pine text-white" : "text-muted hover:bg-fill hover:text-ink"
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            <span>{isCompared ? "비교 중" : "비교"}</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleSave(program.id)}
            aria-label={isSaved ? `${program.title} 체크리스트에서 제거` : `${program.title} 체크리스트에 저장`}
            aria-pressed={isSaved}
            className={`${ACTION_BASE} ${
              isSaved ? "bg-brand-soft text-brand" : "text-muted hover:bg-fill hover:text-ink"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-brand" : ""}`} />
            <span>{isSaved ? "저장됨" : "저장"}</span>
          </button>
        </div>
        <Link
          href={`/programs/${program.id}`}
          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft"
        >
          자세히 →
        </Link>
      </div>
    </article>
  );
}
