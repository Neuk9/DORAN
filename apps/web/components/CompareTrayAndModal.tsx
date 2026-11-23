"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Scale, X } from "lucide-react";
import { useApp } from "./AppContext";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  GROUP_LABELS,
  formatDeadlineBadge,
  formatDistanceWithWalk,
} from "@/lib/types";

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

  return (
    <>
      {/* 하단 플로팅 비교함 트레이 */}
      <div className="fixed right-5 bottom-20 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border border-[#191f28] bg-white px-4 py-3 shadow-2xl md:bottom-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#191f28] text-white">
            <Scale className="h-4 w-4" />
          </span>
          <div className="hidden sm:block">
            <p className="text-xs font-extrabold text-[#191f28]">비교함 ({compareList.length}/3)</p>
            <p className="max-w-[220px] truncate text-xs text-[#6b7684]">
              {compareList.map((p) => p.title).join(", ")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={compareList.length < 2}
          onClick={() => setOpen(true)}
          className="rounded-xl bg-[#0d6e6e] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0a5858] disabled:opacity-40"
        >
          {compareList.length < 2 ? "1개 더 담기" : "나란히 비교하기"}
        </button>

        <button
          type="button"
          onClick={clearCompare}
          aria-label="비교함 비우기"
          className="rounded-lg p-1.5 text-[#8b95a1] hover:bg-[#f2f4f6] hover:text-[#191f28]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 나란히 비교 모달 */}
      {open ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-[#191f28]/45 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="공공자원 나란히 비교"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#e5e8eb] px-6 py-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-[#0d6e6e]" />
                <h2 className="text-lg font-extrabold text-[#191f28]">
                  선택한 공공자원 한눈에 비교 ({compareList.length}건)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="비교 창 닫기"
                className="rounded-xl p-2 text-[#8b95a1] hover:bg-[#f2f4f6] hover:text-[#191f28]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto p-6">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e5e8eb]">
                    <th className="w-32 py-3 pr-4 text-xs font-bold text-[#8b95a1]">비교 항목</th>
                    {compareList.map((prog) => (
                      <th key={prog.id} className="w-1/3 px-4 py-3 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-[#0d6e6e]">
                              {CATEGORY_LABELS[prog.category]} · {formatDeadlineBadge(prog)}
                            </span>
                            <p className="mt-1 text-base font-extrabold text-[#191f28]">{prog.title}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#8b95a1]">{prog.provider}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCompare(prog)}
                            aria-label={`${prog.title} 비교에서 제거`}
                            className="rounded-lg p-1 text-[#8b95a1] hover:bg-[#f2f4f6]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f4f6]">
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">비용 · 혜택</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 font-semibold text-[#191f28]">
                        {COST_LABELS[p.cost.type]} — {p.cost.description}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">연령 · 대상</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 text-[#333d4b]">
                        <p className="font-semibold">
                          {p.eligibility.minAge != null || p.eligibility.maxAge != null
                            ? `만 ${p.eligibility.minAge ?? 0}세 ~ ${
                                p.eligibility.maxAge != null ? `${p.eligibility.maxAge}세` : "제한 없음"
                              }`
                            : "연령 제한 없음"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6b7684]">
                          {p.eligibility.targetGroups.map((g) => GROUP_LABELS[g] || g).join(", ")}
                        </p>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">소득 · 확인사항</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 text-[#333d4b]">
                        {p.eligibility.requiresVerification.length > 0 ? (
                          <span className="font-medium text-amber-800">
                            {p.eligibility.requiresVerification.join(" · ")}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-700">추가 자격 심사 없음</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">위치 · 거리</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 text-[#333d4b]">
                        <p>{p.address || (p.region.isNationwide ? "전국 대상" : p.region.sigungu)}</p>
                        {formatDistanceWithWalk(p.distanceKm) ? (
                          <p className="mt-0.5 text-xs font-bold text-[#0d6e6e]">
                            {formatDistanceWithWalk(p.distanceKm)}
                          </p>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">운영시간</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 text-[#333d4b]">
                        {p.schedule.hoursText}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">준비 서류</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5 text-[#333d4b]">
                        {p.eligibility.requiredDocs.length > 0 ? p.eligibility.requiredDocs.join(", ") : "없음"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 text-xs font-bold text-[#8b95a1]">신청 바로가기</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="px-4 py-3.5">
                        {p.applyInfo.url ? (
                          <a
                            href={p.applyInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d6e6e] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0a5858]"
                          >
                            <span>신청 안내</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#8b95a1]">방문·전화 접수</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
