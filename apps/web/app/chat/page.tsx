"use client";

import { useState } from "react";

import { CrisisBanner } from "@/components/CrisisBanner";
import { ProgramCard } from "@/components/ProgramCard";
import type { Program } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SlotState = {
  region_adm_cd?: string | null;
  age_years?: number | null;
  missing_slots?: string[];
};

const SLOT_LABEL: Record<string, string> = {
  region_adm_cd: "동네",
  age_years: "나이",
  care_need: "돌봄 필요",
  budget_krw: "예산",
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [cards, setCards] = useState<Program[]>([]);
  const [reply, setReply] = useState("");
  const [slots, setSlots] = useState<SlotState | null>(null);
  const [crisis, setCrisis] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  async function send() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setCards([]);
    setReply("");
    setCrisis(null);
    setNotice(null);
    setSlots(null);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const eventLine = part.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));
          if (event === "slot_update") setSlots(data);
          if (event === "cards") setCards(data.items ?? []);
          if (event === "message_delta") setReply(data.text ?? "");
          if (event === "crisis") setCrisis(data.hotlines ?? []);
          if (event === "fallback") setNotice(data.message ?? "잠시 후 다시 시도해 주세요.");
        }
      }
    } catch {
      setNotice("상담 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>AI 복지 상담</h1>
      <p className="muted">
        상황을 편하게 적어 주세요. 예: “초1 아이 방학 때 맡길 곳, 나는 7시 퇴근”
      </p>

      <label htmlFor="chat-input" className="small">
        상담 내용
      </label>
      <textarea
        id="chat-input"
        role="textbox"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem" }}
        placeholder="예: 혼자 사는 68살인데 도움받을 게 있을까요"
      />
      <button
        type="button"
        onClick={send}
        disabled={loading}
        style={{ marginTop: "0.75rem", minHeight: "2.75rem", padding: "0 1.25rem" }}
      >
        {loading ? "찾는 중…" : "보내기"}
      </button>

      {crisis && <CrisisBanner hotlines={crisis} />}
      {notice && <p className="alert">{notice}</p>}
      {reply && <p>{reply}</p>}

      {slots && (slots.missing_slots?.length ?? 0) > 0 && (
        <p>
          {slots.missing_slots?.map((slot) => (
            <span className="chip" key={slot}>
              {SLOT_LABEL[slot] ?? slot} 알려주세요
            </span>
          ))}
        </p>
      )}

      <div className="grid" style={{ marginTop: "1.5rem" }}>
        {cards.map((program) => (
          <ProgramCard key={program.offering_id} program={program} />
        ))}
      </div>

      <p className="small muted" style={{ marginTop: "1.5rem" }}>
        AI 상담 내용은 저장하지 않으며, 개인정보는 마스킹 후 처리됩니다.
      </p>
    </main>
  );
}
