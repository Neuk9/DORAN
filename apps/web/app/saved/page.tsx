"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Saved = { id: string; offering_id: string; created_at: string };

export default function SavedPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch(`${API}/api/saved`, { credentials: "include" });
    const body = await res.json();
    setItems(body.data ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(offeringId: string) {
    await fetch(`${API}/api/saved/${offeringId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setItems((prev) => prev.filter((item) => item.offering_id !== offeringId));
  }

  return (
    <main>
      <h1>내 체크리스트</h1>
      <p className="muted">익명 세션 기준으로 24시간 동안 보관됩니다. 개인정보는 저장하지 않습니다.</p>

      {loaded && items.length === 0 && <p>저장한 자원이 없습니다.</p>}

      <div className="grid">
        {items.map((item) => (
          <div className="card" data-testid="saved-item" key={item.id}>
            <p>{item.offering_id}</p>
            <p className="small muted">
              저장일: {item.created_at ? item.created_at.slice(0, 10) : "-"}
            </p>
            <button type="button" onClick={() => remove(item.offering_id)}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
