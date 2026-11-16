"use client";

import { useEffect, useState } from "react";

import { applyScale, SCALES } from "@/lib/accessibility";

export function BigTextToggle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("font-scale") ?? "1";
    const found = SCALES.indexOf(saved as (typeof SCALES)[number]);
    setIndex(found >= 0 ? found : 0);
    applyScale(saved);
  }, []);

  function handleClick() {
    const next = SCALES[(index + 1) % SCALES.length];
    setIndex((index + 1) % SCALES.length);
    applyScale(next);
  }

  return (
    <button type="button" className="big-text" onClick={handleClick}>
      글씨 크게
    </button>
  );
}
