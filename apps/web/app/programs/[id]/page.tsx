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
    return <div className="h-96 animate-pulse rounded-3xl border border-[#e5e8eb] bg-white" />;
  }

  if (error || !program) {
    return (
      <div className="rounded-2xl border border-[#e5e8eb] bg-white p-10 text-center">
        <p className="text-base font-semibold text-[#4e5968]">{error || "데이터가 없습니다."}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-bold text-[#0d6e6e] hover:underline">
          AI 검색 홈으로 돌아가기
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4e5968] hover:text-[#0d6e6e]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>돌아가기</span>
      </Link>

      <article className="rounded-3xl border border-[#e5e8eb] bg-white p-6 shadow-xs sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#4e5968]">
              <span className="font-bold text-[#191f28]">{CATEGORY_LABELS[program.category]}</span>
              <span className="text-[#d1d6db]">·</span>
              <span>{COST_LABELS[program.cost.type]}</span>
              <span className="text-[#d1d6db]">·</span>
              <span className="font-bold text-[#0d6e6e]">{formatDeadlineBadge(program)}</span>
            </div>
            <h1 className="text-2xl font-extrabold leading-snug text-[#191f28] sm:text-3xl">
              {program.title}
            </h1>
            <p className="text-sm font-semibold text-[#8b95a1]">주관: {program.provider}</p>
          </div>

          <button
            type="button"
            onClick={() => void toggleSave(program.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
              isSaved
                ? "border-[#0d6e6e] bg-[#edf7f7] text-[#0d6e6e]"
                : "border-[#d1d6db] bg-white text-[#191f28] hover:bg-[#f6f7f9]"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-[#0d6e6e]" : ""}`} />
            <span>{isSaved ? "체크리스트 저장됨" : "체크리스트 저장"}</span>
          </button>
        </div>

        <p className="mt-6 rounded-2xl bg-[#f6f7f9] p-5 text-base leading-relaxed text-[#333d4b]">
          {program.summary}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e5e8eb] p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8b95a1]">
              {program.location ? (
                <MapPin className="h-4 w-4 text-[#0d6e6e]" />
              ) : (
                <Globe className="h-4 w-4 text-[#0d6e6e]" />
              )}
              <span>위치 · 대상 지역</span>
            </div>
            <p className="mt-2 text-base font-bold text-[#191f28]">
              {program.region.isNationwide
                ? "전국 대상"
                : `${program.region.sido} ${program.region.sigungu} ${program.region.dong || ""}`}
            </p>
            {program.address ? <p className="mt-1 text-sm text-[#4e5968]">{program.address}</p> : null}
            {kakaoRouteUrl ? (
              <a
                href={kakaoRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-[#0d6e6e] hover:underline"
              >
                <Navigation className="h-3.5 w-3.5" />
                카카오맵 길찾기 →
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8b95a1]">
              <Calendar className="h-4 w-4 text-[#0d6e6e]" />
              <span>비용 · 운영시간 · 마감</span>
            </div>
            <p className="mt-2 text-base font-bold text-[#191f28]">{program.cost.description}</p>
            <p className="mt-1 text-sm text-[#4e5968]">
              {program.schedule.hoursText} ·{" "}
              {program.isAlwaysOpen || !program.deadline
                ? "상시 접수"
                : `${program.deadline.slice(0, 10)} 마감 (KST)`}
            </p>
          </div>
        </div>

        <section className="mt-6 space-y-4 rounded-2xl border border-[#e5e8eb] p-6">
          <h2 className="text-lg font-extrabold text-[#191f28]">자격요건 및 준비 서류</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-[#8b95a1]">연령 기준</dt>
              <dd className="mt-1 text-base font-bold text-[#191f28]">
                {program.eligibility.minAge != null || program.eligibility.maxAge != null
                  ? `만 ${program.eligibility.minAge ?? 0}세 ~ ${
                      program.eligibility.maxAge != null ? `${program.eligibility.maxAge}세` : "제한 없음"
                    }`
                  : "연령 제한 없음"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-[#8b95a1]">주요 대상</dt>
              <dd className="mt-1 text-base font-bold text-[#191f28]">
                {program.eligibility.targetGroups.map((g) => GROUP_LABELS[g] || g).join(", ") || "일반 주민"}
              </dd>
            </div>
            {program.eligibility.incomeMaxPct != null ? (
              <div>
                <dt className="text-xs font-bold text-[#8b95a1]">소득 기준</dt>
                <dd className="mt-1 text-base font-bold text-[#191f28]">
                  기준중위소득 {program.eligibility.incomeMaxPct}% 이하
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="flex items-center gap-1 text-xs font-bold text-[#8b95a1]">
                <FileText className="h-3.5 w-3.5" />
                준비 서류
              </dt>
              <dd className="mt-1 text-base font-bold text-[#191f28]">
                {program.eligibility.requiredDocs.length > 0
                  ? program.eligibility.requiredDocs.join(", ")
                  : "별도 서류 없음 (기관 문의)"}
              </dd>
            </div>
          </dl>

          {program.eligibility.requiresVerification.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">별도 확인 필요 사항</p>
                <p className="mt-0.5">{program.eligibility.requiresVerification.join(" · ")}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl bg-[#f0fafa] p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-extrabold text-[#191f28]">신청 방법</h2>
            <p className="mt-1 text-sm font-medium text-[#333d4b]">{program.applyInfo.method}</p>
            {program.applyInfo.phone ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0d6e6e]">
                <Phone className="h-4 w-4" />
                문의 전화: {program.applyInfo.phone}
              </p>
            ) : null}
          </div>

          {program.applyInfo.url ? (
            <a
              href={program.applyInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0d6e6e] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#0a5858]"
            >
              <span>공식 신청 페이지 이동</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </section>

        <div className="mt-6 border-t border-[#f2f4f6] pt-4 text-xs text-[#8b95a1]">
          출처: {program.source.name} · 기준일: {syncedDate} · 본 정보는 자격 가능성 안내이며 최종 선정은
          주관 기관 기준을 따릅니다.
        </div>
      </article>
    </div>
  );
}
