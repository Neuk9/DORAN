"use client";

import { useId } from "react";

interface BrandMarkProps {
  className?: string;
}

/**
 * 도란도란 마크.
 * 마스터 티어 느낌의 보라 그라데이션을 쓰되, 왕관형 엠블럼 대신
 * 둥근 다이아몬드 보석과 작은 스파클로 자체 형태를 만들었다.
 */
export function BrandMark({ className = "h-14 w-14" }: BrandMarkProps) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `doran-mark-gradient-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="도란도란 로고"
      fill="none"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="12"
          y1="8"
          x2="52"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6D28D9" />
          <stop offset="0.52" stopColor="#A855F7" />
          <stop offset="1" stopColor="#F0ABFC" />
        </linearGradient>
      </defs>

      <rect
        x="14"
        y="14"
        width="36"
        height="36"
        rx="7"
        transform="rotate(45 32 32)"
        fill={`url(#${gradientId})`}
      />
      <rect
        x="14"
        y="14"
        width="36"
        height="36"
        rx="7"
        transform="rotate(45 32 32)"
        stroke="white"
        strokeOpacity="0.24"
      />
      <path
        d="M32 20 44 32 32 44 20 32Z"
        fill="white"
        fillOpacity="0.08"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M46 10.5 47.9 16.1 53.5 18 47.9 19.9 46 25.5 44.1 19.9 38.5 18 44.1 16.1Z"
        fill="#FFFFFF"
        fillOpacity="0.92"
      />
    </svg>
  );
}
