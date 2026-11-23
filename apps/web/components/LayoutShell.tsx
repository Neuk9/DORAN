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
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-28 sm:px-6 md:pb-12 lg:px-8">
        {children}
      </main>

      <footer className="mt-20 hidden border-t border-[#e5e8eb] bg-white py-10 md:block">
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-6 px-5 sm:flex-row sm:items-end sm:px-6 lg:px-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-[#191f28]">도란도란</span>
              <span className="text-xs font-medium text-[#8b95a1]">DORAN</span>
            </div>
            <p className="text-sm text-[#4e5968]">
              AI 자연어 이해와 공공데이터를 결합해 개인 맞춤 공공자원과 지역 격차를 한눈에 연결합니다.
            </p>
            <p className="text-xs text-[#8b95a1]">
              연계 출처: 한국사회보장정보원(복지로) · 행정안전부(공유누리) · 한국문화정보원 · K-MOOC · 도서관정보나루
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 text-xs text-[#6b7684] sm:items-end">
            <div className="flex items-center gap-4 font-semibold text-[#4e5968]">
              <Link href="/" className="hover:text-[#0d6e6e]">
                AI 검색
              </Link>
              <Link href="/explore" className="hover:text-[#0d6e6e]">
                전체 탐색
              </Link>
              <Link href={`/report/${selectedAdmCd}`} className="hover:text-[#0d6e6e]">
                지역 격차 리포트
              </Link>
              <Link href="/saved" className="hover:text-[#0d6e6e]">
                체크리스트
              </Link>
            </div>
            <p className="text-[#8b95a1]">
              상담 원문 미저장 · 익명 체크리스트 24시간 보관 · 최종 자격은 주관 기관 기준을 따릅니다.
            </p>
          </div>
        </div>
      </footer>

      {/* 모바일 하단 네비게이션 탭바 */}
      <nav
        aria-label="모바일 하단 메뉴"
        className="fixed right-0 bottom-0 left-0 z-40 grid grid-cols-4 border-t border-[#e5e8eb] bg-white/95 py-1.5 backdrop-blur md:hidden"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(`/${tab.href.split("/")[1]}`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-bold ${
                active ? "text-[#0d6e6e]" : "text-[#8b95a1]"
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 rounded-full bg-[#0d6e6e] px-1.5 text-[10px] font-bold text-white">
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
