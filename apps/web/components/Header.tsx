"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bookmark, Building2, Compass, LocateFixed, MapPin, Search, Type, User } from "lucide-react";
import { useApp } from "./AppContext";

export function Header() {
  const pathname = usePathname();
  const {
    roleMode,
    setRoleMode,
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
    <header className="sticky top-0 z-40 h-[68px] border-b border-[#e5e8eb] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex shrink-0 items-center">
            <span className="text-[22px] font-black tracking-tight text-[#111827]">도란도란</span>
          </Link>

          <nav aria-label="주요 메뉴" className="hidden items-center gap-1.5 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(`/${item.href.split("/")[1]}`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[15px] font-semibold transition-colors ${
                    active
                      ? "bg-[#f2f4f6] text-[#191f28]"
                      : "text-[#4e5968] hover:bg-[#f6f7f9] hover:text-[#191f28]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-[#0d6e6e]" : "text-[#8b95a1]"}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-[#0d6e6e] px-2 py-0.5 text-xs font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* 주민 / 주민센터 상담 모드 스위치 */}
          <div
            role="group"
            aria-label="이용 모드 전환"
            className="hidden items-center rounded-xl border border-[#e5e8eb] bg-[#f6f7f9] p-0.5 lg:inline-flex"
          >
            <button
              type="button"
              onClick={() => setRoleMode("citizen")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                roleMode === "citizen"
                  ? "bg-white text-[#191f28] shadow-2xs"
                  : "text-[#6b7684] hover:text-[#191f28]"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>주민</span>
            </button>
            <button
              type="button"
              onClick={() => setRoleMode("officer")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                roleMode === "officer"
                  ? "bg-[#191f28] text-white shadow-2xs"
                  : "text-[#6b7684] hover:text-[#191f28]"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>주민센터 상담</span>
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#e5e8eb] bg-[#f9fafb] px-2.5 py-1.5">
            <MapPin className="h-4 w-4 shrink-0 text-[#0d6e6e]" aria-hidden="true" />
            <label htmlFor="header-region-select" className="sr-only">
              우리 동네 선택
            </label>
            <select
              id="header-region-select"
              value={selectedAdmCd}
              onChange={(e) => setSelectedAdmCd(e.target.value)}
              className="max-w-[130px] truncate bg-transparent text-sm font-semibold text-[#191f28] focus:outline-none sm:max-w-none"
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
              className={`ml-1 rounded-lg p-1 transition-colors ${
                userCoords?.source === "gps"
                  ? "bg-[#0d6e6e] text-white"
                  : "text-[#4e5968] hover:bg-[#e5e8eb]"
              }`}
            >
              <LocateFixed className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleLargeText}
            aria-pressed={largeText}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              largeText
                ? "border-[#0d6e6e] bg-[#0d6e6e] text-white"
                : "border-[#e5e8eb] bg-white text-[#4e5968] hover:bg-[#f6f7f9]"
            }`}
          >
            <Type className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{largeText ? "큰글씨 ON" : "큰글씨"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
