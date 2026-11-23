"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, Building2, Lightbulb, Users } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { GapPolicySimulator } from "@/components/GapPolicySimulator";
import { ProgramCard } from "@/components/ProgramCard";
import { fetchRegionReport } from "@/lib/api";
import { CATEGORY_LABELS, type RegionReport } from "@/lib/types";

const InteractiveAIMap = dynamic(() => import("@/components/InteractiveAIMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] items-center justify-center rounded-2xl bg-[#eef1f5] text-sm text-[#8b95a1]">
      행정동 격차 지도를 불러오는 중…
    </div>
  ),
});

export default function RegionReportPage() {
  const params = useParams<{ admCd: string }>();
  const router = useRouter();
  const { regions, setSelectedAdmCd } = useApp();
  const [report, setReport] = useState<RegionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const admCd = params?.admCd || "1153054000";

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRegionReport(admCd)
      .then((data) => {
        setReport(data);
        setSelectedAdmCd(admCd);
      })
      .catch(() => setError("해당 행정동의 격차 분석 데이터를 찾을 수 없습니다."))
      .finally(() => setLoading(false));
  }, [admCd, setSelectedAdmCd]);

  if (loading) {
    return <div className="h-96 animate-pulse rounded-3xl border border-[#e5e8eb] bg-white" />;
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-[#e5e8eb] bg-white p-10 text-center text-base text-[#4e5968]">
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#0d6e6e]">읍면동 수요·공급 격차 분석</span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#191f28]">
            {region.sido} {region.sigungu} {region.dong} 리포트
          </h1>
          <p className="mt-1.5 text-base text-[#4e5968]">
            인구 구조·취약계층 비율과 공공자원 분포를 결합해 생활권 사각지대를 진단합니다.
          </p>
        </div>

        <div className="min-w-[240px]">
          <label htmlFor="report-region-switch" className="block text-xs font-bold text-[#8b95a1]">
            행정동 전환 (격차 높은 순)
          </label>
          <select
            id="report-region-switch"
            value={admCd}
            onChange={(e) => router.push(`/report/${e.target.value}`)}
            className="mt-1.5 w-full rounded-xl border border-[#d1d6db] bg-white px-3.5 py-2.5 text-sm font-bold text-[#191f28]"
          >
            {regions.map((r) => (
              <option key={r.admCd} value={r.admCd}>
                {r.sigungu} {r.dong} (격차 {r.scores.gapIndex > 0 ? `+${r.scores.gapIndex}` : r.scores.gapIndex})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI 카드 */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#8b95a1]">
            <span>수요·공급 격차 지수</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2.5 text-4xl font-extrabold text-[#191f28]">
            {region.scores.gapIndex > 0 ? `+${region.scores.gapIndex}` : region.scores.gapIndex}
          </p>
          <p className="mt-1.5 text-sm text-[#4e5968]">
            수요 {region.scores.demandIndex} − 공급 {region.scores.supplyIndex}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#8b95a1]">
            <span>인구 · 취약계층 현황</span>
            <Users className="h-4 w-4 text-[#0d6e6e]" />
          </div>
          <p className="mt-2.5 text-4xl font-extrabold text-[#191f28]">
            {region.population.total.toLocaleString()}명
          </p>
          <p className="mt-1.5 text-sm text-[#4e5968]">
            청년 {region.population.youth.toLocaleString()} · 어르신{" "}
            {region.population.senior.toLocaleString()} · 취약{" "}
            {Math.round(region.population.vulnerableRatio * 100)}%
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#8b95a1]">
            <span>우선 보완 필요 분야</span>
            <Building2 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {region.scores.shortageCategories.length > 0 ? (
              region.scores.shortageCategories.map((c) => (
                <span key={c} className="rounded-xl bg-rose-100 px-3 py-1 text-sm font-bold text-rose-800">
                  {CATEGORY_LABELS[c]} 부족
                </span>
              ))
            ) : (
              <span className="rounded-xl bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                전 분야 균형 양호
              </span>
            )}
          </div>
          <p className="mt-2.5 text-sm text-[#4e5968]">생활권 등록 자원 총 {report.liveProgramCounts.total}건</p>
        </div>
      </section>

      {/* 행정동 격차 지도 + 정책 인사이트 */}
      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-[#e5e8eb] bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-[#f2f4f6] px-5 py-3.5">
            <h2 className="text-base font-extrabold text-[#191f28]">행정동별 사각지대 격차 지도</h2>
            <span className="text-xs text-[#8b95a1]">동네 버블을 클릭해 바로 비교하세요</span>
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

        <div className="flex flex-col justify-between rounded-3xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-base font-extrabold text-[#191f28]">
              <Lightbulb className="h-5 w-5 text-[#0d6e6e]" />
              <span>정책 기획 · 주민센터 상담 인사이트</span>
            </div>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#333d4b]">
              {report.insights.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0d6e6e]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl bg-[#f6f7f9] p-4 text-xs text-[#4e5968]">
            <p className="font-bold text-[#191f28]">산출 기준 안내</p>
            <p className="mt-1 leading-relaxed">
              격차 지수는 행정동별 인구·청년/어르신·취약계층 수요 지표에서 생활권 내 복지·교육·문화 공급
              지표를 차감해 산출합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 지자체 정책 기획 · ESG 시뮬레이터 */}
      <GapPolicySimulator region={region} />

      {/* 시각화 차트 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <h2 className="text-base font-extrabold text-[#191f28]">수요 · 공급 · 격차 지수 비교</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={indexChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d6e6e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-6 shadow-xs">
          <h2 className="text-base font-extrabold text-[#191f28]">분야별 공공자원 공급 현황</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySupplyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="기준공급" fill="#d97706" radius={[6, 6, 0, 0]} />
                <Bar dataKey="등록자원" fill="#0d6e6e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 반경 5km 인근 자원 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-[#191f28]">
          {region.dong} 반경 5km 이내 연계 가능 자원 ({report.nearbyRecommended.length}건)
        </h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {report.nearbyRecommended.map((prog) => (
            <ProgramCard key={prog.id} program={prog} />
          ))}
        </div>
      </section>
    </div>
  );
}
