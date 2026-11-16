import { FilterBar } from "@/components/FilterBar";
import { MapClient } from "@/components/MapClient";
import { ProgramCard } from "@/components/ProgramCard";
import { apiGetSafe, type Program } from "@/lib/api";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["category", "max_fee", "deadline_within_days", "adm_cd", "weekday"]) {
    const value = sp[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  const programs = await apiGetSafe<Program[]>(`/api/programs?${query.toString()}`, []);

  return (
    <main>
      <h1>자원 찾기</h1>
      <FilterBar />
      <p className="small muted">
        {programs.data.length}건 · 모든 정보에는 출처와 기준일이 표시됩니다.
      </p>
      <div className="grid">
        {programs.data.map((program) => (
          <ProgramCard key={program.offering_id} program={program} />
        ))}
      </div>
      {programs.data.length === 0 && <p className="muted">조건에 맞는 자원이 없습니다.</p>}
      <MapClient programs={programs.data} />
    </main>
  );
}
