import Link from "next/link";

import type { Program } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  care: "돌봄",
  education: "교육",
  culture: "문화",
  living: "생활지원",
};

export function ProgramCard({ program }: { program: Program }) {
  const label = CATEGORY_LABEL[program.category] ?? program.category;
  return (
    <article className="card" data-testid="program-card">
      <span className="chip">{label}</span>
      <h3>
        <Link href={`/programs/${program.offering_id}`}>{program.title}</Link>
      </h3>
      <p className="small muted">{program.provider ?? "제공기관 미상"}</p>
      <p className="small">
        {program.fee === 0 ? "무료" : `${program.fee.toLocaleString()}원`} ·{" "}
        {program.distance_km == null ? "거리 정보 없음" : `${program.distance_km}km`}
      </p>
      <p className="small muted">
        신청 마감: {program.apply_end ? program.apply_end.slice(0, 10) : "상시"}
      </p>
      <p className="small muted">
        출처: {program.source} · 기준일:{" "}
        {program.captured_at ? program.captured_at.slice(0, 10) : "확인 필요"}
      </p>
      <p className="small muted">공공데이터 참고자료 · 최종 자격은 담당 기관 확인</p>
      {program.reasons && program.reasons.length > 0 && (
        <p>
          {program.reasons.map((reason) => (
            <span className="chip" key={reason}>
              {reason}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
