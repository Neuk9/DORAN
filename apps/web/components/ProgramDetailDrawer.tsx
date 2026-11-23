"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Bookmark,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Scale,
  Share2,
  ShieldAlert,
  X,
} from "lucide-react";
import { useApp } from "./AppContext";
import { downloadDeadlineIcs } from "@/lib/ics";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  GROUP_LABELS,
  formatDeadlineBadge,
  formatDistanceWithWalk,
  type Program,
  type RecommendedProgram,
} from "@/lib/types";
import { isMapLink } from "@/lib/url";

interface ProgramDetailDrawerProps {
  program: Program;
  recommendation?: RecommendedProgram | null;
  onClose: () => void;
}

const CATEGORY_DOT: Record<Program["category"], string> = {
  welfare: "bg-emerald-600",
  education: "bg-blue-600",
  culture: "bg-amber-600",
};

export function ProgramDetailDrawer({ program, recommendation, onClose }: ProgramDetailDrawerProps) {
  const {
    savedIds,
    toggleSave,
    compareList,
    toggleCompare,
    checkedDocs,
    toggleDocCheck,
    showToast,
  } = useApp();

  const isSaved = savedIds.has(program.id);
  const isCompared = compareList.some((p) => p.id === program.id);
  const syncedDate = program.source.syncedAt.slice(0, 10);
  const distanceLabel = formatDistanceWithWalk(program.distanceKm);

  const docs = program.eligibility.requiredDocs;
  const doneDocs = checkedDocs[program.id] || [];
  const checkedCount = docs.filter((d) => doneDocs.includes(d)).length;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const kakaoRouteUrl =
    program.location?.coordinates?.length === 2
      ? `https://map.kakao.com/link/to/${encodeURIComponent(program.provider)},${program.location.coordinates[1]},${program.location.coordinates[0]}`
      : null;
  const applyUrl =
    program.applyInfo.url && !isMapLink(program.applyInfo.url) ? program.applyInfo.url : null;

  const handleShare = async () => {
    const url = `${window.location.origin}/programs/${program.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: program.title, text: program.summary, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast({ message: "공유 링크를 복사했어요. 가족이나 지인에게 바로 보내 보세요." });
    } catch {
      showToast({ message: "링크 복사에 실패했어요." });
    }
  };

  const handleCalendar = () => {
    const ok = downloadDeadlineIcs(program);
    if (ok) {
      showToast({ message: "마감 3일 전 알림이 포함된 캘린더(.ics) 파일을 저장했어요." });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        aria-label="선택한 공공자원 상세 정보"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[660px] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-7 py-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[program.category]}`} />
            <span>{CATEGORY_LABELS[program.category]}</span>
            <span className="text-line-strong">·</span>
            <span>{COST_LABELS[program.cost.type]}</span>
            <span className="text-line-strong">·</span>
            <span className="text-brand">{formatDeadlineBadge(program)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCompare(program)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                isCompared
                  ? "border-ink bg-ink text-white"
                  : "border-line text-muted hover:bg-fill-soft"
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>{isCompared ? "비교 중" : "비교"}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="공유 링크 복사"
              className="rounded-xl border border-line p-2 text-muted hover:bg-fill-soft"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void toggleSave(program.id)}
              aria-label={isSaved ? "체크리스트에서 제거" : "체크리스트에 저장"}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors ${
                isSaved
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:bg-fill-soft"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-brand" : ""}`} />
              <span>{isSaved ? "저장됨" : "저장"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="상세 패널 닫기"
              className="rounded-xl p-2 text-faint hover:bg-fill hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-7 py-6">
          <div>
            <p className="text-sm font-semibold text-faint">{program.provider}</p>
            <h2 className="mt-1.5 text-2xl font-extrabold leading-snug text-ink sm:text-[26px]">
              {program.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">{program.summary}</p>
          </div>

          {recommendation ? (
            <div
              className={`rounded-2xl border p-4 ${
                recommendation.eligibility.status === "eligible"
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-amber-200 bg-amber-50/70"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  recommendation.eligibility.status === "eligible" ? "text-emerald-900" : "text-amber-950"
                }`}
              >
                {recommendation.eligibility.status === "eligible"
                  ? "입력하신 조건에 잘 맞아요"
                  : "아래 기준만 확인하면 신청 가능해요"}
              </p>

              {recommendation.eligibility.matchedConditions.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5 text-sm text-ink-soft">
                  {recommendation.eligibility.matchedConditions.map((cond) => (
                    <li key={cond} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{cond}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {recommendation.eligibility.verificationNeeded.length > 0 ? (
                <div className="mt-3 border-t border-amber-200/80 pt-3 text-sm text-amber-950">
                  <p className="font-bold">신청 전 확인 필요</p>
                  <p className="mt-0.5 leading-relaxed">
                    {recommendation.eligibility.verificationNeeded.join(" · ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <dl className="divide-y divide-fill rounded-2xl border border-line bg-fill-soft px-4 text-sm">
            <div className="flex items-start gap-3 py-3.5">
              {program.location ? (
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              ) : (
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              )}
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold text-faint">위치 · 대상 지역</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {program.address ||
                    (program.region.isNationwide
                      ? "전국 대상 (온라인·주민센터)"
                      : `${program.region.sido} ${program.region.sigungu}`)}
                </dd>
                {distanceLabel ? (
                  <p className="mt-0.5 text-xs font-semibold text-brand">기준 위치에서 {distanceLabel}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-3 py-3.5">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              <div>
                <dt className="text-xs font-semibold text-faint">비용 · 운영시간</dt>
                <dd className="mt-0.5 font-semibold text-ink">{program.cost.description}</dd>
                <p className="mt-0.5 text-xs text-muted">{program.schedule.hoursText}</p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 py-3.5">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
                <div>
                  <dt className="text-xs font-semibold text-faint">모집 기간</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {program.isAlwaysOpen || !program.deadline
                      ? "상시 접수"
                      : `${program.deadline.slice(0, 10)}까지 (23:59 기준)`}
                  </dd>
                </div>
              </div>
              {!program.isAlwaysOpen && program.deadline ? (
                <button
                  type="button"
                  onClick={handleCalendar}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:border-brand hover:text-brand"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>캘린더 저장</span>
                </button>
              ) : null}
            </div>
          </dl>

          {/* 자격요건 & 인터랙티브 준비 서류 체크리스트 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">자격요건 · 준비 서류 체크</h3>
              {docs.length > 0 ? (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                  {checkedCount}/{docs.length} 준비 완료
                </span>
              ) : null}
            </div>

            <div className="space-y-2.5 rounded-2xl border border-line p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-faint">연령 기준</span>
                <span className="font-semibold text-ink">
                  {program.eligibility.minAge != null || program.eligibility.maxAge != null
                    ? `만 ${program.eligibility.minAge ?? 0}세 ~ ${
                        program.eligibility.maxAge != null ? `${program.eligibility.maxAge}세` : "제한 없음"
                      }`
                    : "제한 없음"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-faint">주요 대상</span>
                <span className="text-right font-semibold text-ink">
                  {program.eligibility.targetGroups.map((g) => GROUP_LABELS[g] || g).join(", ") || "일반 주민"}
                </span>
              </div>
              {program.eligibility.incomeMaxPct != null ? (
                <div className="flex justify-between gap-3">
                  <span className="text-faint">소득 기준</span>
                  <span className="font-semibold text-ink">
                    기준중위소득 {program.eligibility.incomeMaxPct}% 이하
                  </span>
                </div>
              ) : null}

              <div className="border-t border-fill pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-faint">
                  <FileText className="h-4 w-4" />
                  <span>준비 서류 (클릭해서 준비 여부를 체크해 두세요)</span>
                </div>
                {docs.length > 0 ? (
                  <div className="space-y-1.5">
                    {docs.map((doc) => {
                      const done = doneDocs.includes(doc);
                      return (
                        <label
                          key={doc}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                            done
                              ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 line-through"
                              : "border-line bg-fill-soft text-ink hover:border-faint"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleDocCheck(program.id, doc)}
                            className="h-4 w-4 rounded accent-brand"
                          />
                          <span className="font-medium">{doc}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">별도 준비 서류 없음 (신청 시 기관 안내)</p>
                )}
              </div>
            </div>

            {!recommendation && program.eligibility.requiresVerification.length > 0 ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm text-amber-950">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{program.eligibility.requiresVerification.join(" · ")}</span>
              </div>
            ) : null}
          </section>

          <section className="space-y-1.5 text-sm text-muted">
            <h3 className="text-xs font-bold text-faint">신청 방법</h3>
            <p className="font-semibold text-ink">{program.applyInfo.method}</p>
            <p className="pt-1 text-xs text-faint">
              출처: {program.source.name} · 기준일 {syncedDate}
            </p>
          </section>
        </div>

        <div className="space-y-2.5 border-t border-line bg-white px-6 py-4">
          <div className="flex gap-2.5">
            {applyUrl ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-strong"
              >
                <span>공식 신청 페이지로 이동</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {program.applyInfo.phone ? (
              <a
                href={`tel:${program.applyInfo.phone}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] font-bold text-ink hover:bg-fill-soft"
              >
                <Phone className="h-4 w-4 text-brand" />
                <span>전화</span>
              </a>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-xs">
            {kakaoRouteUrl ? (
              <a
                href={kakaoRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-muted hover:text-ink"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>카카오맵 길찾기</span>
              </a>
            ) : (
              <span className="text-faint">온라인·전국 신청 가능</span>
            )}
            <Link href={`/programs/${program.id}`} className="font-semibold text-brand hover:underline">
              전체 페이지로 보기 →
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
