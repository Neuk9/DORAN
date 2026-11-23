"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bookmark, Compass, Search } from "lucide-react";
import { useApp } from "./AppContext";
import { CompareTrayAndModal } from "./CompareTrayAndModal";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { selectedAdmCd, savedItems } = useApp();

  const mobileTabs = [
    { href: "/", label: "AI 검색", icon: Search },
    { href: "/explore", label: "탐색", icon: Compass },
    { href: `/report/${selectedAdmCd}`, label: "격차", icon: BarChart3 },
    { href: "/saved", label: "저장", icon: Bookmark, badge: savedItems.length },
  ];

  return (
    <>
      <main className="mx-auto w-full max-w-[1360px] px-4 py-7 pb-28 sm:px-6 md:py-10 md:pb-16 lg:px-8">
        {children}
      </main>

      <footer className="mt-20 hidden border-t border-line bg-surface py-10 md:block">
        <div className="mx-auto flex max-w-[1360px] flex-col justify-between gap-6 px-5 sm:flex-row sm:items-end sm:px-6 lg:px-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="9.5" cy="12" r="6.5" fill="#0f5c57" />
                <circle cx="16.5" cy="12" r="4.5" fill="#c85a32" fillOpacity="0.88" />
              </svg>
              <span className="text-base font-extrabold tracking-tight text-ink">도란도란</span>
              <span className="text-xs font-medium text-faint">DORAN</span>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              자연어 이해와 공공데이터를 결합해 개인 맞춤 공공자원과 지역 격차를 한눈에 연결합니다.
            </p>
            <p className="text-xs leading-relaxed text-faint">
              연계 출처: 행정안전부(주민등록 인구·세대 · 전국도서관) · 한국사회보장정보원(복지로 · 사회복지시설) · 한국문화정보원 · 국가평생교육진흥원(K-MOOC) · 카카오 로컬
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 text-xs text-subtle sm:items-end">
            <div className="flex items-center gap-4 font-semibold text-muted">
              <Link href="/" className="hover:text-brand">
                AI 검색
              </Link>
              <Link href="/explore" className="hover:text-brand">
                전체 탐색
              </Link>
              <Link href={`/report/${selectedAdmCd}`} className="hover:text-brand">
                지역 격차 리포트
              </Link>
              <Link href="/saved" className="hover:text-brand">
                체크리스트
              </Link>
            </div>
            <p className="text-faint">
              상담 원문 미저장 · 익명 체크리스트 24시간 보관 · 최종 자격은 주관 기관 기준을 따릅니다.
            </p>
          </div>
        </div>
      </footer>

      {/* 모바일 하단 네비게이션 탭바 */}
      <nav
        aria-label="모바일 하단 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 py-2 backdrop-blur-md md:hidden"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(`/${tab.href.split("/")[1]}`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[12px] font-bold ${
                active ? "text-brand" : "text-faint"
              }`}
            >
              <div className="relative">
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-brand-soft" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-0.5 rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <CompareTrayAndModal />
    </>
  );
}
