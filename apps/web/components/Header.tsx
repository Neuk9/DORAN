"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bookmark, Compass, LocateFixed, MapPin, Search, Type } from "lucide-react";
import { useApp } from "./AppContext";

export function Header() {
  const pathname = usePathname();
  const {
    regions,
    selectedAdmCd,
    setSelectedAdmCd,
    userCoords,
    locating,
    locateMe,
    largeText,
    toggleLargeText,
    savedItems,
  } = useApp();

  const navItems = [
    { href: "/", label: "AI 검색", icon: Search },
    { href: "/explore", label: "전체 탐색", icon: Compass },
    { href: `/report/${selectedAdmCd}`, label: "지역 격차", icon: BarChart3 },
    { href: "/saved", label: "체크리스트", icon: Bookmark, badge: savedItems.length },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* 좌측: 브랜드 워드마크 (절제된 2-dot 대화 심볼) */}
        <Link href="/" aria-label="도란도란 홈" className="flex shrink-0 items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9.5" cy="12" r="6.5" fill="#0f5c57" />
            <circle cx="16.5" cy="12" r="4.5" fill="#c85a32" fillOpacity="0.88" />
          </svg>
          <span className="text-[19px] font-extrabold tracking-[-0.03em] text-ink">도란도란</span>
        </Link>

        {/* 중앙: 세그먼트 필 네비게이션 */}
        <nav
          aria-label="주요 메뉴"
          className="hidden items-center gap-0.5 rounded-full border border-line bg-fill/80 p-1 md:flex"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(`/${item.href.split("/")[1]}`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-surface text-ink font-bold shadow-card"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand" : "text-subtle"}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold leading-none text-brand">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* 우측: 동네 선택 + 큰글씨 */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
            <label htmlFor="header-region-select" className="sr-only">
              우리 동네 선택
            </label>
            <select
              id="header-region-select"
              value={selectedAdmCd}
              onChange={(e) => setSelectedAdmCd(e.target.value)}
              className="max-w-[118px] truncate bg-transparent text-sm font-semibold text-ink focus:outline-none lg:max-w-none"
            >
              {regions.map((r) => (
                <option key={r.admCd} value={r.admCd}>
                  {r.sigungu} {r.dong}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void locateMe()}
              disabled={locating}
              title="내 현재 GPS 위치로 맞추기"
              aria-label="내 현재 위치 찾기"
              className={`ml-0.5 rounded-full p-1 transition-colors ${
                userCoords?.source === "gps"
                  ? "bg-brand-soft text-brand"
                  : "text-subtle hover:bg-fill hover:text-ink"
              }`}
            >
              <LocateFixed className={`h-3.5 w-3.5 ${locating ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleLargeText}
            aria-pressed={largeText}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              largeText
                ? "border-pine bg-pine text-white"
                : "border-line bg-surface text-muted hover:bg-fill-soft hover:text-ink"
            }`}
          >
            <Type className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{largeText ? "큰글씨 ON" : "큰글씨"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
