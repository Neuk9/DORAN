"use client";

import { useEffect } from "react";
import { Building2, Copy, Printer, X } from "lucide-react";
import { useApp } from "./AppContext";
import {
  CATEGORY_LABELS,
  GROUP_LABELS,
  formatDeadlineBadge,
  type ChatRecommendResponse,
} from "@/lib/types";

interface OfficerGuideModalProps {
  result: ChatRecommendResponse;
  locationLabel: string;
  onClose: () => void;
}

export function OfficerGuideModal({ result, locationLabel, onClose }: OfficerGuideModalProps) {
  const { showToast } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopyPlain = async () => {
    const lines = [
      `[도란도란 원스톱 민원 상담 안내지] (${today})`,
      `기준 지역: ${locationLabel}`,
      result.benefitSummary?.headline ? `예상 혜택 요약: ${result.benefitSummary.headline}` : "",
      "",
      "■ 추천 지원사업 및 이용 시설",
      ...result.recommendations.slice(0, 6).map(
        (r, i) =>
          `${i + 1}. ${r.program.title} (${CATEGORY_LABELS[r.program.category]} / ${
            r.eligibility.status === "eligible" ? "신청 가능성 높음" : "별도 확인 필요"
          })\n   - 혜택/비용: ${r.program.cost.description}\n   - 신청 방법: ${r.program.applyInfo.method}${
            r.program.applyInfo.phone ? ` (문의: ${r.program.applyInfo.phone})` : ""
          }`,
      ),
      "",
      result.consolidatedDocs?.length
        ? `■ 공통 준비 서류: ${result.consolidatedDocs.join(", ")}`
        : "",
    ].filter((l) => l !== "");

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast({ message: "상담 안내지 텍스트를 복사했어요. 문자·카톡 안내에 바로 붙여넣으세요." });
    } catch {
      showToast({ message: "복사에 실패했습니다." });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[68] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="주민센터 원스톱 민원 상담 안내지"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* 모달 상단 액션 바 (인쇄 시 숨김) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-fill-soft px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand" />
            <span className="text-base font-extrabold text-ink">
              1장 원스톱 민원 안내지 미리보기
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyPlain()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3.5 py-2 text-xs font-bold text-ink hover:bg-fill"
            >
              <Copy className="h-4 w-4" />
              <span>안내 문구 복사</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-strong"
            >
              <Printer className="h-4 w-4" />
              <span>A4 인쇄 / PDF 저장</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-xl p-2 text-faint hover:bg-line hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 인쇄 대상 영역 */}
        <div id="doran-printable-guide" className="flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4">
            <div>
              <p className="text-xs font-bold tracking-wide text-brand">
                도란도란 (DORAN) · 행정복지센터 상담 보조 안내지
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink">
                맞춤 복지 · 교육 · 문화 원스톱 안내
              </h1>
            </div>
            <div className="text-right text-xs text-muted">
              <p>발급일: {today}</p>
              <p>기준 지역: {locationLabel}</p>
            </div>
          </div>

          {/* 상담 조건 및 예상 혜택 요약 */}
          <div className="grid gap-3 rounded-2xl border border-line bg-fill-soft p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-faint">상담 기준 조건 (원문 미저장)</p>
              <p className="mt-1 text-sm font-bold text-ink">
                {[
                  result.profile?.age ? `만 ${result.profile.age}세` : null,
                  ...(result.profile?.targetGroups.map((g) => GROUP_LABELS[g] || g) || []),
                ]
                  .filter(Boolean)
                  .join(" · ") || "일반 주민"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-faint">예상 혜택 요약</p>
              <p className="mt-1 text-sm font-extrabold text-brand">
                {result.benefitSummary?.headline || `추천 자원 ${result.recommendations.length}건`}
              </p>
            </div>
          </div>

          {/* 추천 자원 표 */}
          <div>
            <h2 className="mb-2.5 text-sm font-extrabold text-ink">
              1. 추천 지원사업 및 이용 가능 시설 ({Math.min(6, result.recommendations.length)}건)
            </h2>
            <table className="w-full border-collapse border border-line-strong text-left text-xs">
              <thead>
                <tr className="bg-fill text-ink">
                  <th className="border border-line-strong px-3 py-2 font-bold">구분</th>
                  <th className="border border-line-strong px-3 py-2 font-bold">사업명 · 혜택</th>
                  <th className="border border-line-strong px-3 py-2 font-bold">자격 판정</th>
                  <th className="border border-line-strong px-3 py-2 font-bold">신청 경로 · 문의</th>
                </tr>
              </thead>
              <tbody>
                {result.recommendations.slice(0, 6).map((rec) => (
                  <tr key={rec.program.id}>
                    <td className="border border-line-strong px-3 py-2.5 align-top font-semibold whitespace-nowrap">
                      {CATEGORY_LABELS[rec.program.category]}
                      <div className="mt-0.5 text-xs text-brand">
                        {formatDeadlineBadge(rec.program)}
                      </div>
                    </td>
                    <td className="border border-line-strong px-3 py-2.5 align-top">
                      <p className="font-bold text-ink">{rec.program.title}</p>
                      <p className="mt-0.5 text-muted">{rec.program.cost.description}</p>
                    </td>
                    <td className="border border-line-strong px-3 py-2.5 align-top">
                      <span
                        className={`font-bold ${
                          rec.eligibility.status === "eligible" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {rec.eligibility.status === "eligible" ? "신청 가능성 높음" : "별도 확인 필요"}
                      </span>
                      {rec.eligibility.verificationNeeded[0] ? (
                        <p className="mt-0.5 text-xs text-muted">
                          {rec.eligibility.verificationNeeded[0]}
                        </p>
                      ) : null}
                    </td>
                    <td className="border border-line-strong px-3 py-2.5 align-top text-ink-soft">
                      <p>{rec.program.applyInfo.method}</p>
                      {rec.program.applyInfo.phone ? (
                        <p className="mt-0.5 font-bold text-ink">☎ {rec.program.applyInfo.phone}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 통합 구비서류 체크박스 */}
          {result.consolidatedDocs && result.consolidatedDocs.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-extrabold text-ink">
                2. 공통 준비 서류 체크리스트 (중복 제거)
              </h2>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-line-strong p-4 text-xs sm:grid-cols-3">
                {result.consolidatedDocs.map((doc) => (
                  <div key={doc} className="flex items-center gap-2 font-medium text-ink">
                    <span className="inline-block h-3.5 w-3.5 rounded border border-faint" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-subtle">
            ※ 본 안내지는 상담 시 입력된 정보 기준의 신청 가능성 안내이며, 실제 수급 자격은 소득·재산
            조사 및 주관 기관 심사를 통해 최종 확정됩니다. (출처: 한국사회보장정보원·행정안전부·한국문화정보원
            등 연계 공공데이터)
          </p>
        </div>
      </div>
    </div>
  );
}
