"use client";

import { useState } from "react";
import { Leaf, RotateCcw, Sliders, TrendingDown } from "lucide-react";
import type { RegionStat } from "@/lib/types";

interface GapPolicySimulatorProps {
  region: RegionStat;
}

function getGrade(gap: number): { label: string; style: string } {
  if (gap >= 30) return { label: "사각지대 우선 지원", style: "bg-rose-100 text-rose-800" };
  if (gap > 5) return { label: "보완 필요 권역", style: "bg-amber-100 text-amber-900" };
  return { label: "생활권 균형 달성", style: "bg-emerald-100 text-emerald-800" };
}

export function GapPolicySimulator({ region }: GapPolicySimulatorProps) {
  const [addWelfare, setAddWelfare] = useState(0);
  const [addEducation, setAddEducation] = useState(0);
  const [addCulture, setAddCulture] = useState(0);
  const [strategy, setStrategy] = useState<"reuse" | "new_build">("reuse");

  const totalAdded = addWelfare + addEducation + addCulture;

  // 부족 분야에 투입할수록 공급 개선 가중치가 높도록 결정론 모델 적용
  const weightFor = (cat: "welfare" | "education" | "culture") =>
    region.scores.shortageCategories.includes(cat) ? 5.8 : 3.4;

  const supplyGain = Number(
    (
      addWelfare * weightFor("welfare") +
      addEducation * weightFor("education") +
      addCulture * weightFor("culture")
    ).toFixed(1),
  );

  const simulatedSupply = Math.min(100, Number((region.scores.supplyIndex + supplyGain).toFixed(1)));
  const simulatedGap = Number((region.scores.demandIndex - simulatedSupply).toFixed(1));
  const improvement = Number((region.scores.gapIndex - simulatedGap).toFixed(1));

  const currentGrade = getGrade(region.scores.gapIndex);
  const nextGrade = getGrade(simulatedGap);

  // 유휴공간(공유누리) 개방 대비 신규 건립 예산·탄소 절감 추정 (시뮬레이션 참고치)
  const estimatedBudgetSavedBillion = strategy === "reuse" ? Number((totalAdded * 1.4).toFixed(1)) : 0;
  const estimatedCo2SavedTon = strategy === "reuse" ? totalAdded * 42 : 0;

  const reset = () => {
    setAddWelfare(0);
    setAddEducation(0);
    setAddCulture(0);
    setStrategy("reuse");
  };

  return (
    <section className="rounded-3xl border border-[#cce4e4] bg-white p-6 shadow-xs sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d6e6e]">
            <Sliders className="h-4 w-4" />
            <span>지자체 정책 기획 · ESG 시뮬레이터</span>
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-[#191f28]">
            {region.sigungu} {region.dong} 공공자원 확충 시 격차 변화 시뮬레이션
          </h2>
          <p className="mt-1 text-sm text-[#4e5968]">
            부족한 분야에 시설·프로그램을 추가했을 때 사각지대 격차 지수가 얼마나 줄어드는지 미리 검증해
            보세요.
          </p>
        </div>

        {totalAdded > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d1d6db] px-3 py-2 text-xs font-bold text-[#4e5968] hover:bg-[#f6f7f9]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>초기화</span>
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* 좌측 슬라이더 컨트롤 */}
        <div className="space-y-5">
          {/* 공급 방식 선택 */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f6f7f9] p-1.5">
            <button
              type="button"
              onClick={() => setStrategy("reuse")}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                strategy === "reuse"
                  ? "bg-white text-[#0d6e6e] shadow-xs"
                  : "text-[#6b7684] hover:text-[#191f28]"
              }`}
            >
              유휴 공공공간 개방 (ESG 권장)
            </button>
            <button
              type="button"
              onClick={() => setStrategy("new_build")}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                strategy === "new_build"
                  ? "bg-white text-[#191f28] shadow-xs"
                  : "text-[#6b7684] hover:text-[#191f28]"
              }`}
            >
              신규 시설 건립
            </button>
          </div>

          {[
            {
              key: "welfare",
              label: "복지 프로그램 · 돌봄 거점 추가",
              value: addWelfare,
              set: setAddWelfare,
              isShortage: region.scores.shortageCategories.includes("welfare"),
            },
            {
              key: "education",
              label: "교육 강좌 · 평생학습 공간 추가",
              value: addEducation,
              set: setAddEducation,
              isShortage: region.scores.shortageCategories.includes("education"),
            },
            {
              key: "culture",
              label: "문화 · 여가 공유공간 추가",
              value: addCulture,
              set: setAddCulture,
              isShortage: region.scores.shortageCategories.includes("culture"),
            },
          ].map((ctrl) => (
            <div key={ctrl.key} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-[#191f28]">
                  {ctrl.label}
                  {ctrl.isShortage ? (
                    <span className="ml-2 rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                      현재 부족
                    </span>
                  ) : null}
                </span>
                <span className="font-extrabold text-[#0d6e6e]">+{ctrl.value}곳</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={ctrl.value}
                aria-label={ctrl.label}
                onChange={(e) => ctrl.set(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e5e8eb] accent-[#0d6e6e]"
              />
            </div>
          ))}
        </div>

        {/* 우측 실시간 결과 패널 */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-[#e5e8eb] bg-[#fafbfc] p-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#8b95a1]">예상 격차 지수 변화</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${nextGrade.style}`}>
                {nextGrade.label}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-bold text-[#8b95a1] line-through">
                {region.scores.gapIndex > 0 ? `+${region.scores.gapIndex}` : region.scores.gapIndex}
              </span>
              <span className="text-4xl font-extrabold text-[#191f28]">
                {simulatedGap > 0 ? `+${simulatedGap}` : simulatedGap}
              </span>
              {improvement > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                  <TrendingDown className="h-3.5 w-3.5" />-{improvement}p 개선
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-[#4e5968]">
              공급 지수 {region.scores.supplyIndex} → <strong>{simulatedSupply}</strong> · 등급:{" "}
              {currentGrade.label} → <strong>{nextGrade.label}</strong>
            </p>
          </div>

          {/* ESG 환경·예산 가치 비교 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
            <div className="flex items-center gap-1.5 font-extrabold text-emerald-900">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <span>ESG 환경 · 예산 효율 분석</span>
            </div>
            {totalAdded === 0 ? (
              <p className="mt-1.5 leading-relaxed">
                왼쪽 슬라이더를 움직여 부족 분야에 자원을 배치해 보세요. 유휴 공간 개방과 신규 건립의
                효과를 비교할 수 있습니다.
              </p>
            ) : strategy === "reuse" ? (
              <p className="mt-1.5 leading-relaxed">
                기존 주민센터·학교·유휴 공공공간 {totalAdded}곳을 공유누리로 개방하면 신규 건립 대비{" "}
                <strong>약 {estimatedBudgetSavedBillion}억원 예산 절감</strong>과{" "}
                <strong>약 {estimatedCo2SavedTon}톤의 건축 탄소 배출 저감</strong> 효과가 기대됩니다.
              </p>
            ) : (
              <p className="mt-1.5 leading-relaxed">
                신규 시설 {totalAdded}곳 건립 시 장기 인프라 확충 효과는 크지만 초기 예산과 공사 기간이
                소요됩니다. 단기 격차 해소를 위해 유휴공간 개방 전략과 병행을 권장합니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
