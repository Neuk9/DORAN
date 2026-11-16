import Link from "next/link";

import { SaveButton } from "@/components/SaveButton";
import { notFound } from "next/navigation";

import { apiGet, type Envelope, type Program } from "@/lib/api";

type Detail = Program & {
  description: string | null;
  target_text: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  eligibility: unknown;
  eligibility_state: string;
  stale: boolean;
  phone: string | null;
  homepage: string | null;
  apply_url: string | null;
  apply_start: string | null;
};

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail: Envelope<Detail>;
  try {
    detail = await apiGet<Detail>(`/api/programs/${id}`);
  } catch {
    notFound();
  }
  const p = detail.data;

  return (
    <main>
      <p className="small muted">
        <Link href="/explore">← 자원 목록</Link>
      </p>
      <h1>{p.title}</h1>
      <span className="chip">{p.category}</span>
      {p.stale && <span className="chip">정보 갱신 필요</span>}

      <div className="card" style={{ marginTop: "1rem" }}>
        <p>{p.description ?? "상세 설명이 제공되지 않습니다."}</p>
        <p>
          <strong>제공기관</strong> {p.provider ?? "미상"}
        </p>
        <p>
          <strong>지원대상</strong> {p.target_text ?? "정보 없음"}
        </p>
        <p>
          <strong>비용</strong> {p.fee === 0 ? "무료" : `${p.fee.toLocaleString()}원`}
        </p>
        <p>
          <strong>신청기간</strong> {p.apply_start?.slice(0, 10) ?? "상시"} ~{" "}
          {p.apply_end?.slice(0, 10) ?? "상시"}
        </p>
        <p>
          <strong>전화</strong>{" "}
          {p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : "정보 없음"}
        </p>
        <p>
          <strong>주소</strong> {p.address ?? "정보 없음"}
        </p>
        <p>
          <strong>자격 확인</strong>{" "}
          {p.eligibility_state === "needs_check"
            ? "담당자 확인이 필요합니다"
            : "자격 요건과 일치할 가능성이 있습니다"}
        </p>
        {p.apply_url && (
          <p>
            <a href={p.apply_url} rel="noreferrer" target="_blank">
              신청 페이지 열기
            </a>
          </p>
        )}
      </div>

      <p style={{ marginTop: "1rem" }}>
        <SaveButton offeringId={p.offering_id} />
      </p>

      <p className="small muted" style={{ marginTop: "1rem" }}>
        출처: {p.source} · 기준일:{" "}
        {p.captured_at ? p.captured_at.slice(0, 10) : "확인 필요"} ·{" "}
        {detail.meta.disclaimer}
      </p>
    </main>
  );
}
