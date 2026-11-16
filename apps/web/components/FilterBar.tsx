"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/explore?${next.toString()}`);
  }

  return (
    <div className="card" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      <label>
        분야{" "}
        <select
          aria-label="분야"
          defaultValue={params.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">전체</option>
          <option value="care">돌봄</option>
          <option value="education">교육</option>
          <option value="culture">문화</option>
          <option value="living">생활지원</option>
        </select>
      </label>
      <label>
        비용{" "}
        <select
          aria-label="비용"
          defaultValue={params.get("max_fee") ?? ""}
          onChange={(e) => update("max_fee", e.target.value)}
        >
          <option value="">전체</option>
          <option value="0">무료</option>
          <option value="10000">1만원 이하</option>
        </select>
      </label>
      <label>
        요일{" "}
        <select
          aria-label="요일"
          defaultValue={params.get("weekday") ?? ""}
          onChange={(e) => update("weekday", e.target.value)}
        >
          <option value="">전체</option>
          <option value="0">월</option>
          <option value="1">화</option>
          <option value="2">수</option>
          <option value="3">목</option>
          <option value="4">금</option>
          <option value="5">토</option>
          <option value="6">일</option>
        </select>
      </label>
      <label>
        마감{" "}
        <select
          aria-label="마감"
          defaultValue={params.get("deadline_within_days") ?? ""}
          onChange={(e) => update("deadline_within_days", e.target.value)}
        >
          <option value="">전체</option>
          <option value="3">3일 이내</option>
          <option value="7">7일 이내</option>
        </select>
      </label>
    </div>
  );
}
