"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  MapPin,
  Scale,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "./AppContext";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  GROUP_LABELS,
  formatDeadlineBadge,
  formatDistanceWithWalk,
} from "@/lib/types";
import { isMapLink } from "@/lib/url";

function formatAgeRange(program: { eligibility: { minAge?: number | null; maxAge?: number | null } }) {
  const { minAge, maxAge } = program.eligibility;
  if (minAge == null && maxAge == null) return "연령 제한 없음";
  const max = maxAge != null ? `만 ${maxAge}세` : "제한 없음";
  return `만 ${minAge ?? 0}세 ~ ${max}`;
}

export function CompareTrayAndModal() {
  const { compareList, toggleCompare, clearCompare } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (compareList.length === 0) setOpen(false);
  }, [compareList.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (compareList.length === 0) return null;

  const gridClass =
    compareList.length >= 3
      ? "md:grid-cols-3"
      : compareList.length === 2
        ? "md:grid-cols-2"
        : "mx-auto max-w-md";

  return (
    <>
      {/* 하단 플로팅 비교함 트레이 */}
      <div className="fixed right-5 bottom-24 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lift ring-1 ring-line/70 md:bottom-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-white">
            <Scale className="h-4 w-4" />
          </span>
          <div className="hidden sm:block">
            <p className="text-xs font-extrabold text-ink">비교함 ({compareList.length}/3)</p>
            <p className="max-w-[220px] truncate text-xs text-subtle">
              {compareList.map((p) => p.title).join(", ")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={compareList.length < 2}
          onClick={() => setOpen(true)}
          className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-40"
        >
          {compareList.length < 2 ? "1개 더 담기" : "나란히 비교하기"}
        </button>

        <button
          type="button"
          onClick={clearCompare}
          aria-label="비교함 비우기"
          className="rounded-lg p-1.5 text-faint hover:bg-fill hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 카드형 비교 모달 */}
      {open ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="공공자원 나란히 비교"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-extrabold text-ink">
                  비교하기
                  <span className="ml-1.5 text-sm font-bold text-faint">{compareList.length}개</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="비교 창 닫기"
                className="rounded-xl p-2 text-faint hover:bg-fill hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto bg-fill-soft p-5 sm:p-6">
              <div className={`grid gap-4 ${gridClass}`}>
                {compareList.map((p) => {
                  const distance = formatDistanceWithWalk(p.distanceKm);
                  const applyUrl =
                    p.applyInfo.url && !isMapLink(p.applyInfo.url) ? p.applyInfo.url : null;
                  const targetGroups = p.eligibility.targetGroups
                    .map((g) => GROUP_LABELS[g] || g)
                    .join(", ");
                  const verifications = p.eligibility.requiresVerification;
                  const docs = p.eligibility.requiredDocs;

                  return (
                    <article
                      key={p.id}
                      className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70"
                    >
                      <div className="border-b border-fill px-4 pb-3 pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-brand">
                            <span>{CATEGORY_LABELS[p.category]}</span>
                            <span className="text-line-strong">·</span>
                            <span>{formatDeadlineBadge(p)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCompare(p)}
                            aria-label={`${p.title} 비교에서 제거`}
                            className="-mr-1 -mt-1 rounded-lg p-1.5 text-faint hover:bg-fill hover:text-ink"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <h3 className="mt-1 line-clamp-2 text-[15px] font-extrabold leading-snug text-ink">
                          {p.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-faint">{p.provider}</p>
                      </div>

                      <dl className="divide-y divide-fill-soft px-4">
                        <div className="flex gap-2 py-2.5">
                          <dt className="flex w-[68px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] font-bold text-faint">
                            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>비용</span>
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink">{COST_LABELS[p.cost.type]}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-subtle" title={p.cost.description}>
                              {p.cost.description}
                            </p>
                          </dd>
                        </div>

                        <div className="flex gap-2 py-2.5">
                          <dt className="flex w-[68px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] font-bold text-faint">
                            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>대상</span>
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink">{formatAgeRange(p)}</p>
                            {targetGroups ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-subtle" title={targetGroups}>
                                {targetGroups}
                              </p>
                            ) : null}
                          </dd>
                        </div>

                        <div className="flex gap-2 py-2.5">
                          <dt className="flex w-[68px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] font-bold text-faint">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>확인사항</span>
                          </dt>
                          <dd className="min-w-0 flex-1 text-sm">
                            {verifications.length > 0 ? (
                              <p className="line-clamp-2 font-semibold text-amber-800" title={verifications.join(" · ")}>
                                {verifications.join(" · ")}
                              </p>
                            ) : (
                              <p className="font-semibold text-emerald-700">추가 자격 심사 없음</p>
                            )}
                          </dd>
                        </div>

                        <div className="flex gap-2 py-2.5">
                          <dt className="flex w-[68px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] font-bold text-faint">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>위치</span>
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-ink">
                              {p.address || (p.region.isNationwide ? "전국 대상" : p.region.sigungu)}
                            </p>
                            {distance ? (
                              <p className="mt-0.5 text-xs font-bold text-brand">{distance}</p>
                            ) : null}
                          </dd>
                        </div>

                        <div className="flex gap-2 py-2.5">
                          <dt className="flex w-[68px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] font-bold text-faint">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>운영시간</span>
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-ink" title={p.schedule.hoursText}>
                              {p.schedule.hoursText}
                            </p>
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto space-y-2.5 px-4 pb-4 pt-3">
                        <details className="group rounded-xl bg-fill-soft px-3 py-2">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-muted">
                            <span>준비 서류 {docs.length > 0 ? `${docs.length}개` : "없음"}</span>
                            {docs.length > 0 ? (
                              <ChevronDown
                                className="h-3.5 w-3.5 text-faint transition-transform group-open:rotate-180"
                                aria-hidden="true"
                              />
                            ) : null}
                          </summary>
                          {docs.length > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {docs.map((doc) => (
                                <li
                                  key={doc}
                                  className="rounded-lg bg-fill-soft px-2 py-1 text-[12px] font-semibold text-muted"
                                >
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </details>

                        <p className="line-clamp-2 text-xs text-subtle" title={p.applyInfo.method}>
                          {p.applyInfo.method}
                        </p>

                        {applyUrl ? (
                          <a
                            href={applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 py-2.5 text-xs font-bold text-white hover:bg-brand-strong"
                          >
                            <span>신청 안내</span>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <p className="rounded-xl bg-fill-soft px-3.5 py-2.5 text-center text-xs font-bold text-subtle">
                            방문·전화 접수
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
