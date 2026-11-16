import type { ReactNode } from "react";
import Link from "next/link";

import { BigTextToggle } from "@/components/BigTextToggle";
import "./globals.css";

export const metadata = {
  title: "도란도란 — 우리 동네 복지·교육·문화",
  description: "AI 기반 지역사회 사각지대 발굴 및 공공자원 매칭",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar" style={{ maxWidth: "960px", margin: "0 auto", padding: "0.75rem 1rem" }}>
          <Link href="/"><strong>도란도란</strong></Link>
          <nav className="nav" aria-label="주요 메뉴">
            <Link href="/chat">AI 상담</Link>
            <Link href="/explore">자원 찾기</Link>
            <Link href="/saved">체크리스트</Link>
          </nav>
          <BigTextToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
