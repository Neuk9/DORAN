import Link from "next/link";

import { apiGetSafe } from "@/lib/api";

type Gap = {
  adm_cd: string;
  name: string | null;
  period: string;
  demand_score: number;
  supply_score: number;
  gap_score: number;
  categories: Record<string, number>;
  narrative: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  care: "돌봄",
  education: "교육",
  culture: "문화",
  living: "생활지원",
};

export default async function ReportPage({ params }: { params: Promise<{ admCd: string }> }) {
  const { admCd } = await params;
  const res = await apiGetSafe<Gap | null>(`/api/regions/${admCd}/gap`, null);
  const gap = res.data;

  if (!gap) {
    return (
      <main>
        <h1>지역 격차 리포트</h1>
        <p className="muted">해당 지역의 격차 데이터가 아직 없습니다.</p>
        <p>
          <Link href="/explore">자원 찾기로 이동</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>{gap.name ?? gap.adm_cd} 격차 리포트</h1>
      <p className="small muted">기준 기간: {gap.period}</p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <p>
          <strong>수요 지수</strong> {gap.demand_score.toFixed(1)}
        </p>
        <p>
          <strong>공급 지수</strong> {gap.supply_score.toFixed(1)}
        </p>
        <p data-testid="gap-score">
          <strong>격차 지수</strong> {gap.gap_score.toFixed(1)}%
        </p>
        <p className="small muted">
          격차가 높을수록 수요에 비해 지역 자원이 부족하다는 뜻입니다.
        </p>
      </div>

      <h2>분야별 격차</h2>
      <div className="card">
        {Object.entries(gap.categories).map(([key, value]) => (
          <div key={key} style={{ marginBottom: "0.75rem" }}>
            <div className="small">
              {CATEGORY_LABEL[key] ?? key} · {value.toFixed(1)}
            </div>
            <div
              aria-hidden="true"
              style={{ background: "#e5e7eb", borderRadius: "999px", height: "0.6rem" }}
            >
              <div
                style={{
                  width: `${Math.min(100, value)}%`,
                  background: "#1d4ed8",
                  height: "0.6rem",
                  borderRadius: "999px",
                }}
              />
            </div>
          </div>
        ))}
        {Object.keys(gap.categories).length === 0 && (
          <p className="muted">분야별 데이터가 없습니다.</p>
        )}
      </div>

      <h2>해설</h2>
      <p className="card" data-testid="gap-narrative">
        {gap.narrative ?? "해설을 생성하지 못했습니다."}
      </p>

      <h2>대안 찾기</h2>
      <p>
        <Link href="/explore?category=culture">문화 프로그램 보기</Link> ·{" "}
        <Link href="/explore?category=education">교육 프로그램 보기</Link> ·{" "}
        <Link href="/chat">AI 상담 받기</Link>
      </p>

      <p className="small muted">가중치 기반 참고 지표이며, 실제 정책 판단에는 현장 확인이 필요합니다.</p>
    </main>
  );
}
