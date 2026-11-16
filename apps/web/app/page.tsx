import Link from "next/link";

import { apiGetSafe, type Program, type Region } from "@/lib/api";

export default async function Home() {
  const regions = await apiGetSafe<Region[]>("/api/regions/search", []);
  const programs = await apiGetSafe<Program[]>("/api/programs?size=6", []);

  return (
    <main>
      <h1>도란도란 — 필요한 도움을, 우리 동네에서</h1>
      <p className="muted">
        복지·교육·문화 자원을 한 번에 비교하고, 신청 방법까지 확인할 수 있어요.
        모든 정보에는 출처와 기준일이 표시됩니다.
      </p>

      <h2>동네 선택</h2>
      <div className="grid">
        {regions.data.map((region) => (
          <Link key={region.adm_cd} className="card" href={`/report/${region.adm_cd}`}>
            <strong>{region.name}</strong>
            <div className="small muted">지역 격차 리포트 보기</div>
          </Link>
        ))}
        {regions.data.length === 0 && (
          <p className="muted">지역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
      </div>

      <h2>오늘의 추천</h2>
      <div className="grid">
        {programs.data.map((program) => (
          <article key={program.offering_id} className="card" data-testid="program-card">
            <span className="chip">{program.category}</span>
            <h3>
              <Link href={`/programs/${program.offering_id}`}>{program.title}</Link>
            </h3>
            <p className="small muted">{program.provider ?? "제공기관 미상"}</p>
            <p className="small">
              {program.fee === 0 ? "무료" : `${program.fee.toLocaleString()}원`} ·{" "}
              {program.distance_km == null ? "거리 정보 없음" : `${program.distance_km}km`}
            </p>
            <p className="small muted">
              출처: {program.source} · 기준일:{" "}
              {program.captured_at ? program.captured_at.slice(0, 10) : "확인 필요"}
            </p>
          </article>
        ))}
      </div>

      <p className="small muted">
        본 정보는 공공데이터 기반 참고자료이며, 최종 자격·신청 가능 여부는 담당 기관에 확인하세요.
      </p>
    </main>
  );
}
