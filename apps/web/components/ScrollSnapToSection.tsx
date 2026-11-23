"use client";

import { useEffect, useRef } from "react";

interface ScrollSnapToSectionProps {
  targetId: string;
  enabled: boolean;
}

/**
 * 첫 화면(히어로)에서 아래로 스크롤하면 다음 섹션으로 한 번에 넘긴다.
 * 버튼 클릭과 같은 이동감을 주되, 결과 화면 등에서는 비활성화한다.
 */
export function ScrollSnapToSection({ targetId, enabled }: ScrollSnapToSectionProps) {
  const snappingRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let touchStartY = 0;
    let unlockTimer: number | undefined;

    const shouldSnap = () => {
      const target = document.getElementById(targetId);
      const intro = document.getElementById("home-intro");
      if (!target || !intro) return false;
      // 첫 화면(히어로) 바닥이 보이는 시점 + 다음 섹션이 아직 화면 중앙 아래에 있을 때만 넘긴다.
      const introBottomVisible = intro.getBoundingClientRect().bottom <= window.innerHeight + 8;
      const targetBelowMiddle = target.getBoundingClientRect().top > window.innerHeight * 0.5;
      return introBottomVisible && targetBelowMiddle;
    };

    const snapDown = () => {
      if (snappingRef.current || !shouldSnap()) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      snappingRef.current = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        snappingRef.current = false;
      }, 900);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY <= 2) return;
      snapDown();
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const swipedUp = touchStartY - currentY > 14;
      if (!swipedUp) return;
      snapDown();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowDown", "PageDown", " ", "Spacebar"].includes(event.key)) return;
      snapDown();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(unlockTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, targetId]);

  return null;
}
