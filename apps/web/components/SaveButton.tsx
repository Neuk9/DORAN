"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function SaveButton({ offeringId }: { offeringId: string }) {
  const [saved, setSaved] = useState(false);

  async function save() {
    const res = await fetch(`${API}/api/saved`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offering_id: offeringId }),
    });
    if (res.ok) setSaved(true);
  }

  return (
    <button type="button" onClick={save} disabled={saved}>
      {saved ? "저장됨" : "체크리스트에 저장"}
    </button>
  );
}
