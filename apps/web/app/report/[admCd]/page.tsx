"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, ChevronDown, ChevronUp, Lightbulb, MapPinPlus, RefreshCw, Search, Users } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { FacilityRecommendations } from "@/components/FacilityRecommendations";
import { GapPolicySimulator, type SimulatorCounts } from "@/components/GapPolicySimulator";
import { ProgramCard } from "@/components/ProgramCard";
import { fetchRegionReport, triggerPublicSync } from "@/lib/api";
import { CATEGORY_LABELS, type CategoryType, type RegionReport } from "@/lib/types";

const InteractiveAIMap = dynamic(() => import("@/components/InteractiveAIMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] items-center justify-center rounded-2xl bg-fill text-sm text-faint">
      행정동 격차 지도를 불러오는 중…
    </div>
  ),
});

export default function RegionReportPage() {
  const params = useParams<{ admCd: string }>();
  const router = useRouter();
  const {
    regions,
    refreshRegions,
    discoverAndSelectRegion,
    discoveringRegion,
    setSelectedAdmCd,
    showToast,
  } = useApp();
  const [report, setReport] = useState<RegionReport | null>(null);
  const [simCounts, setSimCounts] = useState<SimulatorCounts>({ welfare: 0, education: 0, culture: 0 });
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const admCd = params?.admCd || "1153054000";

  const loadReport = async (code: string) => {
    setLoading(true);
    setError(null);
    setSimCounts({ welfare: 0, education: 0, culture: 0 });
    try {
      const data = await fetchRegionReport(code);
      setReport(data);
      setSelectedAdmCd(code);
    } catch {
      setError("해당 행정동의 격차 분석 데이터를 찾을 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(admCd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admCd]);

  const handleSyncPublicData = async () => {
    setSyncing(true);
    try {
      await triggerPublicSync();
      await refreshRegions();
      showToast({ message: "공공데이터포털 9종 API 및 격차 지수를 최신 실데이터로 갱신했어요." });
      await loadReport(admCd);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "공공 API 동기화에 실패했습니다.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discoverQuery.trim() || discoveringRegion) return;
    const nextAdmCd = await discoverAndSelectRegion(discoverQuery);
    if (nextAdmCd) {
      setDiscoverQuery("");
      setDiscoverOpen(false);
      router.push(`/report/${nextAdmCd}`);
    }
  };

  const handleApplyFacility = (category: CategoryType, facilityName: string) => {
    setSimCounts((prev) => ({ ...prev, [category]: Math.min(6, prev[category] + 1) }));
    showToast({ message: `'${facilityName}'을(를) 시뮬레이터(${CATEGORY_LABELS[category]} +1곳)에 반영했어요.` });
    document.getElementById("gap-policy-simulator")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" />;
  }

  if (error || !report) {
    return (
      <div className="rounded-3xl bg-surface p-10 text-center text-base text-muted shadow-card ring-1 ring-line/70">
        {error || "리포트 데이터가 없습니다."}
      </div>
    );
  }

  const { region } = report;
  const indexChartData = [
    { name: "수요 지수", value: region.scores.demandIndex },
    { name: "공급 지수", value: region.scores.supplyIndex },
    { name: "격차 지수", value: Math.max(0, region.scores.gapIndex) },
  ];

  const categorySupplyData = [
    { name: "복지", 기준공급: region.supply.welfare, 등록자원: report.liveProgramCounts.welfare },
    { name: "교육", 기준공급: region.supply.education, 등록자원: report.liveProgramCounts.education },
    { name: "문화", 기준공급: region.supply.culture, 등록자원: report.liveProgramCounts.culture },
  ];

  const statsLabel =
    region.dataSource === "public_api" && region.statsYm && region.statsYm.length === 6
      ? `행안부 ${region.statsYm.slice(0, 4)}.${region.statsYm.slice(4)} 실데이터 기준`
      : "기본 통계 기준";

  return (
    <div className="space-y-8">
      {/* 정갈한 리포트 상단 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink sm:text-[32px]">
            {region.sigungu} {region.dong}
          </h1>
          <span className="text-sm font-medium text-subtle">
            지역 격차 리포트 · {statsLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="report-region-switch" className="sr-only">
            행정동 전환 (격차 높은 순)
          </label>
          <select
            id="report-region-switch"
            value={admCd}
            onChange={(e) => router.push(`/report/${e.target.value}`)}
            className="rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm font-bold text-ink focus:border-brand focus:outline-none"
          >
            {regions.map((r) => (
              <option key={r.admCd} value={r.admCd}>
                {r.sigungu} {r.dong} (격차 {r.scores.gapIndex > 0 ? `+${r.scores.gapIndex}` : r.scores.gapIndex})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setDiscoverOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              discoverOpen
                ? "border-brand bg-brand-tint text-brand"
                : "border-line bg-surface text-muted hover:border-line-strong hover:bg-fill-soft hover:text-ink"
            }`}
          >
            <MapPinPlus className="h-3.5 w-3.5" />
            <span>전국 지역 추가</span>
          </button>

          <button
            type="button"
            onClick={handleSyncPublicData}
            disabled={syncing}
            title="공공데이터포털 9종 API 최신화"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-muted transition-colors hover:border-line-strong hover:bg-fill-soft hover:text-ink disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "동기화 중…" : "최신화"}</span>
          </button>
        </div>
      </header>

      {/* 전국 자치구 온디맨드 실시간 추가 검색바 */}
      {discoverOpen ? (
        <form
          onSubmit={handleDiscoverSubmit}
          className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-brand-line bg-brand-tint/60 p-4"
        >
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={discoverQuery}
              onChange={(e) => setDiscoverQuery(e.target.value)}
              placeholder="전국 시·군·구 또는 동 입력 (예: 관악구, 강남구, 마포구, 부산 해운대구)"
              className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pr-4 pl-10 text-sm font-medium text-ink placeholder-faint focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={discoveringRegion || !discoverQuery.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand disabled:opacity-50"
          >
            {discoveringRegion ? "공공 API 수집 중…" : "실데이터 불러오기"}
          </button>
        </form>
      ) : null}

      {/* KPI 카드 */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-subtle">수요·공급 격차 지수</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${
                region.scores.gapIndex >= 30
                  ? "bg-rose-50 text-rose-700"
                  : region.scores.gapIndex > 5
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {region.scores.gapIndex >= 30
                ? "우선 지원 검토"
                : region.scores.gapIndex > 5
                  ? "보완 필요"
                  : "균형 양호"}
            </span>
          </div>
          <p
            className={`mt-3 text-4xl font-extrabold tracking-[-0.03em] tabular-nums ${
              region.scores.gapIndex >= 30 ? "text-rose-700" : "text-ink"
            }`}
          >
            {region.scores.gapIndex > 0 ? `+${region.scores.gapIndex}` : region.scores.gapIndex}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            수요 {region.scores.demandIndex} − 공급 {region.scores.supplyIndex}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-subtle">인구 · 취약계층 현황</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill">
              <Users className="h-4 w-4 text-brand" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">
            {region.population.total.toLocaleString()}명
          </p>
          <p className="mt-1.5 text-sm text-muted">
            청년 {region.population.youth.toLocaleString()} · 어르신{" "}
            {region.population.senior.toLocaleString()} · 취약{" "}
            {Math.round(region.population.vulnerableRatio * 100)}%
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-subtle">우선 보완 필요 분야</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill">
              <Building2 className="h-4 w-4 text-subtle" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {region.scores.shortageCategories.length > 0 ? (
              region.scores.shortageCategories.map((c) => (
                <span key={c} className="rounded-lg bg-rose-50 px-2.5 py-1 text-sm font-bold text-rose-800">
                  {CATEGORY_LABELS[c]} 부족
                </span>
              ))
            ) : (
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-800">
                전 분야 균형 양호
              </span>
            )}
          </div>
          <p className="mt-2.5 text-sm text-muted">생활권 등록 자원 총 {report.liveProgramCounts.total}건</p>
        </div>
      </section>

      {/* 행정동 격차 지도 + 정책 인사이트 */}
      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line/70">
          <div className="flex items-center justify-between border-b border-fill px-5 py-3.5">
            <h2 className="text-base font-extrabold text-ink">행정동별 사각지대 격차 지도</h2>
            <span className="text-xs text-faint">동네 버블을 클릭해 바로 비교하세요</span>
          </div>
          <div className="h-[360px] w-full">
            <InteractiveAIMap
              programs={[]}
              regions={regions}
              mode="gap"
              anchor={{
                lat: region.center.coordinates[1],
                lng: region.center.coordinates[0],
                label: `${region.sigungu} ${region.dong}`,
              }}
              pendingPin={null}
              selectedProgramId={null}
              hoveredProgramId={null}
              selectedRegionAdmCd={region.admCd}
              onSelectProgram={() => {}}
              onClickMapLocation={() => {}}
              onSelectRegion={(r) => router.push(`/report/${r.admCd}`)}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div>
            <div className="flex items-center gap-2 text-base font-extrabold text-ink">
              <Lightbulb className="h-5 w-5 text-brand" />
              <span>지역 진단 요약</span>
            </div>
            <ul className="mt-4 space-y-3 text-[15.5px] font-medium leading-[1.68] text-ink">
              {report.insights.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 rounded-xl bg-fill-soft px-4 py-3"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setFormulaOpen((prev) => !prev)}
              aria-expanded={formulaOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-fill-soft px-4 py-2.5 text-xs font-bold text-muted transition-colors hover:bg-fill hover:text-ink"
            >
              <span>산출 공식 및 공공 데이터 출처</span>
              {formulaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {formulaOpen ? (
              <div className="mt-2.5 rounded-xl bg-fill-soft p-4 text-xs text-muted">
                <p className="leading-relaxed">
                  {report.formulaSummary ||
                    "격차 지수는 행정동별 인구·청년/어르신·취약계층 수요 지표에서 생활권 내 복지·교육·문화 공급 지표를 차감해 산출합니다."}
                </p>
                {region.sourceNotes && region.sourceNotes.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {region.sourceNotes.map((src) => (
                      <span
                        key={src}
                        className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[12px] font-semibold text-muted"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 인구 분포 기반 우리 동네 우선 필요 시설 추천 */}
      <FacilityRecommendations
        region={region}
        facilities={report.recommendedFacilities || []}
        onApplyToSimulator={handleApplyFacility}
      />

      {/* 지자체 정책 기획 · ESG 시뮬레이터 */}
      <GapPolicySimulator region={region} counts={simCounts} onChangeCounts={setSimCounts} />

      {/* 시각화 차트 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-extrabold text-ink">수요 · 공급 · 격차 지수 비교</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={indexChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-extrabold text-ink">분야별 공공자원 공급 현황</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySupplyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="기준공급" fill="#64748b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="등록자원" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 반경 5km 인근 자원 */}
      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">
          {region.dong} 반경 5km 이내 연계 가능 자원 ({report.nearbyRecommended.length}건)
        </h2>
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {report.nearbyRecommended.map((prog) => (
            <ProgramCard key={prog.id} program={prog} collapsible />
          ))}
        </div>
      </section>
    </div>
  );
}
