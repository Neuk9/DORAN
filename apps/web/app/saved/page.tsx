"use client";

import Link from "next/link";
import { Bookmark, Clock } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { PageHeader } from "@/components/PageHeader";
import { ProgramCard } from "@/components/ProgramCard";

export default function SavedPage() {
  const { savedItems } = useApp();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span>
            저장한 자원 <span className="text-brand">{savedItems.length}건</span>
          </span>
        }
        title="내 신청 체크리스트"
        description="저장한 복지·교육·문화 자원을 마감 임박순으로 정리해 보여드립니다."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-subtle">
            <Clock className="h-4 w-4 text-brand" />
            로그인 없이 익명 보관 · 24시간 후 자동 삭제
          </span>
        }
      />

      {savedItems.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {savedItems.map((prog) => (
            <ProgramCard key={prog.id} program={prog} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-20 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
            <Bookmark className="h-7 w-7 text-brand" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold text-ink">저장한 공공자원이 아직 없어요</h2>
          <p className="mt-1.5 max-w-lg text-base leading-relaxed text-muted">
            맞춤 검색이나 전체 탐색에서 관심 있는 항목의 ‘저장’ 버튼을 눌러 체크리스트를 만들어 보세요.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-strong"
            >
              맞춤 검색으로 찾기
            </Link>
            <Link
              href="/explore"
              className="rounded-xl border border-line-strong bg-surface px-5 py-3 text-sm font-bold text-ink hover:bg-fill"
            >
              전체 목록 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
