"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, PhoneCall, Send, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { ProgramCard } from "@/components/ProgramCard";
import { postChatRecommend } from "@/lib/api";
import {
  CATEGORY_LABELS,
  GROUP_LABELS,
  TIME_LABELS,
  type CategoryType,
  type ChatRecommendResponse,
  type UserProfile,
} from "@/lib/types";

const QUICK_SAMPLES = [
  "서울 구로구에 사는 20대 대학생인데, 주말에 무료로 악기를 배울 수 있는 곳이나 청년 지원금이 있을까?",
  "가리봉동 70세 독거 어르신인데 돌봄 서비스랑 무료 스마트폰 교실 찾고 있어요",
  "개봉동 맞벌이 가족인데 아이돌봄 서비스나 주말 어린이 도서관 프로그램 있을까요?",
  "며칠째 단전되고 너무 힘들어서 죽고 싶어요",
];

function ChatContent() {
  const searchParams = useSearchParams();
  const { selectedAdmCd } = useApp();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatRecommendResponse | null>(null);
  const [editableProfile, setEditableProfile] = useState<UserProfile | null>(null);

  const runRecommend = useCallback(
    async (message: string, overrideProfile?: UserProfile) => {
      if (!message.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const data = await postChatRecommend({
          message: message.trim(),
          admCd: selectedAdmCd,
          overrideProfile,
          limit: 8,
        });
        setResult(data);
        setEditableProfile(data.profile || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "추천 요청 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [selectedAdmCd],
  );

  useEffect(() => {
    const initialQ = searchParams.get("q");
    if (initialQ) {
      setInput(initialQ);
      void runRecommend(initialQ);
    }
  }, [searchParams, runRecommend]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runRecommend(input);
  };

  const toggleCategoryChip = (cat: CategoryType) => {
    if (!editableProfile) return;
    const exists = editableProfile.categories.includes(cat);
    const nextCategories = exists
      ? editableProfile.categories.filter((c) => c !== cat)
      : [...editableProfile.categories, cat];
    const nextProfile = { ...editableProfile, categories: nextCategories };
    setEditableProfile(nextProfile);
    void runRecommend(input || "조건 재검색", nextProfile);
  };

  const toggleFreeChip = () => {
    if (!editableProfile) return;
    const nextProfile = { ...editableProfile, preferFree: !editableProfile.preferFree };
    setEditableProfile(nextProfile);
    void runRecommend(input || "조건 재검색", nextProfile);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">AI 맞춤형 공공자원 상담</h1>
            <p className="mt-1 text-sm text-stone-600">
              거주지, 연령, 상황, 원하는 도움을 일상 말로 적어주세요. 전화번호·주민번호 등은 자동 마스킹되며
              원문은 저장되지 않습니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
            <ShieldCheck className="h-4 w-4" />
            원문 미저장 · PII 자동 보호
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label htmlFor="chat-textarea" className="sr-only">
            상담 내용 입력
          </label>
          <textarea
            id="chat-textarea"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 서울 구로구에 사는 20대 대학생인데, 주말에 무료로 악기를 배울 수 있는 곳이나 청년 지원금이 있을까?"
            className="w-full rounded-2xl border border-stone-300 bg-stone-50 p-4 text-sm text-stone-900 placeholder-stone-400 focus:border-teal-700 focus:bg-white sm:text-base"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SAMPLES.map((sample, idx) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setInput(sample);
                    void runRecommend(sample);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    idx === 3
                      ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {idx === 3 ? "위기 대응 테스트" : `예시 ${idx + 1}`}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? "분석 중..." : "맞춤 추천 받기"}</span>
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* 위기 신호 감지 즉시 안내 */}
      {result?.crisis?.detected ? (
        <section
          role="alert"
          className="rounded-3xl border-2 border-rose-500 bg-rose-50 p-6 shadow-md"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-rose-600" />
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-rose-900">긴급 지원 안내</h2>
                <p className="mt-1 text-sm font-medium text-rose-800">{result.crisis.message}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.crisis.contacts.map((c) => (
                  <a
                    key={c.number}
                    href={`tel:${c.number}`}
                    className="flex flex-col justify-between rounded-2xl border border-rose-200 bg-white p-4 shadow-sm transition-colors hover:border-rose-400"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">{c.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-sm font-extrabold text-white">
                        <PhoneCall className="h-3.5 w-3.5" />
                        {c.number}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-stone-600">{c.description}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* 추출된 조건 구조화 + 조건 칩 수정 */}
      {result && !result.crisis && editableProfile ? (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-teal-900">
              <SlidersHorizontal className="h-4 w-4" />
              <span>AI가 추출한 조건 (칩을 눌러 바로 재검색할 수 있습니다)</span>
            </div>
            <span className="text-xs font-medium text-teal-700">엔진: {result.provider} + 결정론 룰</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {editableProfile.sigungu ? (
              <span className="rounded-full bg-white px-3 py-1 font-semibold text-stone-800 shadow-xs">
                지역: {editableProfile.sido} {editableProfile.sigungu} {editableProfile.dong || ""}
              </span>
            ) : null}
            {editableProfile.age ? (
              <span className="rounded-full bg-white px-3 py-1 font-semibold text-stone-800 shadow-xs">
                추정 연령: 만 {editableProfile.age}세
              </span>
            ) : null}
            {editableProfile.targetGroups.map((g) => (
              <span key={g} className="rounded-full bg-white px-3 py-1 font-semibold text-stone-800 shadow-xs">
                유형: {GROUP_LABELS[g] || g}
              </span>
            ))}
            {editableProfile.timePreferences.map((t) => (
              <span key={t} className="rounded-full bg-white px-3 py-1 font-semibold text-stone-800 shadow-xs">
                시간: {TIME_LABELS[t] || t}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-200/70 pt-3">
            <span className="text-xs font-semibold text-teal-900">빠른 조정:</span>
            {(["welfare", "education", "culture"] as CategoryType[]).map((cat) => {
              const active = editableProfile.categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategoryChip(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    active
                      ? "bg-teal-700 text-white"
                      : "border border-teal-300 bg-white text-teal-800 hover:bg-teal-100"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleFreeChip}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                editableProfile.preferFree
                  ? "bg-amber-500 text-stone-950"
                  : "border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
              }`}
            >
              무료·지원금 우선
            </button>
          </div>
        </section>
      ) : null}

      {/* 추천 결과 목록 */}
      {result && !result.crisis ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <Sparkles className="h-4 w-4 text-teal-700" />
            <span>{result.summaryMessage}</span>
          </div>

          {result.recommendations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {result.recommendations.map((rec) => (
                <ProgramCard
                  key={rec.program.id}
                  program={rec.program}
                  eligibility={rec.eligibility}
                  explanation={rec.explanation}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
              조건에 맞는 자원이 없습니다. 위 빠른 조정 버튼으로 분야를 넓혀 보세요.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
      <ChatContent />
    </Suspense>
  );
}
