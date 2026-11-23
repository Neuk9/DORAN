"use client";

import Link from "next/link";
import { Bookmark, Clock } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { ProgramCard } from "@/components/ProgramCard";

export default function SavedPage() {
  const { savedItems } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#191f28]">내 신청 체크리스트</h1>
          <p className="mt-1.5 text-base text-[#4e5968]">
            저장한 복지·교육·문화 자원을 마감 임박순으로 정리해 보여드립니다.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e8eb] bg-white px-3.5 py-2 text-xs font-semibold text-[#4e5968]">
          <Clock className="h-4 w-4 text-[#0d6e6e]" />
          로그인 없이 익명 보관 · 24시간 후 자동 삭제
        </span>
      </div>

      {savedItems.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {savedItems.map((prog) => (
            <ProgramCard key={prog.id} program={prog} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d6db] bg-white px-6 py-20 text-center">
          <Bookmark className="h-11 w-11 text-[#d1d6db]" />
          <h2 className="mt-4 text-xl font-bold text-[#191f28]">저장한 공공자원이 아직 없어요</h2>
          <p className="mt-1.5 text-base text-[#6b7684]">
            AI 검색이나 전체 탐색에서 관심 있는 항목의 ‘저장’ 버튼을 눌러 체크리스트를 만들어 보세요.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="rounded-xl bg-[#0d6e6e] px-5 py-3 text-sm font-bold text-white hover:bg-[#0a5858]"
            >
              AI 검색으로 찾기
            </Link>
            <Link
              href="/explore"
              className="rounded-xl border border-[#d1d6db] bg-white px-5 py-3 text-sm font-bold text-[#191f28] hover:bg-[#f6f7f9]"
            >
              전체 목록 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
