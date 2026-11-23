import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppContext";
import { Header } from "@/components/Header";
import { LayoutShell } from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "도란도란 — 내 동네 공공자원 · 복지 매칭",
  description:
    "우리 동네 복지·교육·문화 공공자원을 일상어로 찾고, 행정동별 수요·공급 격차까지 한눈에 확인하는 생활 플랫폼입니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">
        <AppProvider>
          <Header />
          <LayoutShell>{children}</LayoutShell>
        </AppProvider>
      </body>
    </html>
  );
}
