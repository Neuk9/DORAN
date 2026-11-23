"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Navigation,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { fetchProgramById } from "@/lib/api";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  GROUP_LABELS,
  formatDeadlineBadge,
  type Program,
} from "@/lib/types";

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const { savedIds, toggleSave } = useApp();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    fetchProgramById(params.id)
      .then((data) => setProgram(data))
      .catch(() => setError("프로그램 정보를 찾을 수 없습니다."))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" />;
  }

  if (error || !program) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <p className="text-base font-semibold text-muted">{error || "데이터가 없습니다."}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-bold text-brand hover:underline">
          맞춤 검색 홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const isSaved = savedIds.has(program.id);
  const syncedDate = program.source.syncedAt.slice(0, 10);
  const kakaoRouteUrl =
    program.location?.coordinates?.length === 2
      ? `https://map.kakao.com/link/to/${encodeURIComponent(program.provider)},${program.location.coordinates[1]},${program.location.coordinates[0]}`
      : null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="-ml-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-subtle hover:bg-fill hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>목록으로 돌아가기</span>
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[1.55fr_0.85fr]">
        {/* 좌측: 본문 상세 안내 문서 */}
        <article className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <header className="border-b border-line pb-6">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
              <span className="rounded-full bg-brand-soft px-3 py-0.5 text-xs font-bold text-brand">
                {CATEGORY_LABELS[program.category]}
              </span>
              <span>{COST_LABELS[program.cost.type]}</span>
              <span className="text-line-strong">·</span>
              <span className="font-bold text-brand">{formatDeadlineBadge(program)}</span>
            </div>
            <h1 className="mt-3 text-[24px] font-extrabold leading-snug tracking-[-0.03em] text-ink sm:text-[32px]">
              {program.title}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-subtle">주관 기관: {program.provider}</p>
          </header>

          <p className="rounded-xl border border-brand-line/60 bg-brand-tint p-5 text-base leading-relaxed text-ink-soft">
            {program.summary}
          </p>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink">자격요건 및 준비 서류</h2>
            <dl className="grid gap-4 rounded-xl border border-line bg-fill-soft p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-subtle">연령 기준</dt>
                <dd className="mt-1 text-base font-bold text-ink">
                  {program.eligibility.minAge != null || program.eligibility.maxAge != null
                    ? `만 ${program.eligibility.minAge ?? 0}세 ~ ${
                        program.eligibility.maxAge != null ? `${program.eligibility.maxAge}세` : "제한 없음"
                      }`
                    : "연령 제한 없음"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-subtle">주요 대상</dt>
                <dd className="mt-1 text-base font-bold text-ink">
                  {program.eligibility.targetGroups.map((g) => GROUP_LABELS[g] || g).join(", ") || "일반 주민"}
                </dd>
              </div>
              {program.eligibility.incomeMaxPct != null ? (
                <div>
                  <dt className="text-xs font-bold text-subtle">소득 기준</dt>
                  <dd className="mt-1 text-base font-bold text-ink">
                    기준중위소득 {program.eligibility.incomeMaxPct}% 이하
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="flex items-center gap-1 text-xs font-bold text-subtle">
                  <FileText className="h-3.5 w-3.5" />
                  준비 서류
                </dt>
                <dd className="mt-1 text-base font-bold text-ink">
                  {program.eligibility.requiredDocs.length > 0
                    ? program.eligibility.requiredDocs.join(", ")
                    : "별도 서류 없음 (기관 문의)"}
                </dd>
              </div>
            </dl>

            {program.eligibility.requiresVerification.length > 0 ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">별도 확인 필요 사항</p>
                  <p className="mt-0.5">{program.eligibility.requiresVerification.join(" · ")}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-fill-soft p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-subtle">
                {program.location ? (
                  <MapPin className="h-4 w-4 text-brand" />
                ) : (
                  <Globe className="h-4 w-4 text-brand" />
                )}
                <span>위치 · 대상 지역</span>
              </div>
              <p className="mt-2 text-base font-bold text-ink">
                {program.region.isNationwide
                  ? "전국 대상"
                  : `${program.region.sido} ${program.region.sigungu} ${program.region.dong || ""}`}
              </p>
              {program.address ? <p className="mt-1 text-sm text-muted">{program.address}</p> : null}
            </div>

            <div className="rounded-xl border border-line bg-fill-soft p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-subtle">
                <Calendar className="h-4 w-4 text-brand" />
                <span>비용 · 운영시간 · 마감</span>
              </div>
              <p className="mt-2 text-base font-bold text-ink">{program.cost.description}</p>
              <p className="mt-1 text-sm text-muted">
                {program.schedule.hoursText} ·{" "}
                {program.isAlwaysOpen || !program.deadline
                  ? "상시 접수"
                  : `${program.deadline.slice(0, 10)} 마감 (KST)`}
              </p>
            </div>
          </section>

          <footer className="border-t border-line pt-4 text-xs text-subtle">
            출처: {program.source.name} · 기준일: {syncedDate} · 본 정보는 자격 가능성 안내이며 최종 선정은
            주관 기관 기준을 따릅니다.
          </footer>
        </article>

        {/* 우측: 스티키 신청·액션 패널 */}
        <aside className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card lg:sticky lg:top-24">
          <div>
            <p className="text-xs font-bold text-subtle">신청 방법</p>
            <p className="mt-1.5 text-base font-bold leading-snug text-ink">{program.applyInfo.method}</p>
          </div>

          <div className="space-y-2.5 pt-1">
            {program.applyInfo.url ? (
              <a
                href={program.applyInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand"
              >
                <span>공식 신청 페이지 이동</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => void toggleSave(program.id)}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition-colors ${
                isSaved
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line-strong bg-surface text-ink hover:bg-fill-soft"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-brand" : ""}`} />
              <span>{isSaved ? "체크리스트에 저장됨" : "체크리스트에 저장"}</span>
            </button>
          </div>

          <div className="space-y-2.5 border-t border-line pt-4 text-sm">
            {program.applyInfo.phone ? (
              <a
                href={`tel:${program.applyInfo.phone}`}
                className="flex items-center justify-between rounded-xl bg-fill-soft px-4 py-3 font-semibold text-ink hover:bg-fill"
              >
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-brand" />
                  <span>문의 전화</span>
                </span>
                <span className="font-bold text-brand">{program.applyInfo.phone}</span>
              </a>
            ) : null}

            {kakaoRouteUrl ? (
              <a
                href={kakaoRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl bg-fill-soft px-4 py-3 font-semibold text-ink hover:bg-fill"
              >
                <span className="inline-flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-brand" />
                  <span>카카오맵 길찾기</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-subtle" />
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
