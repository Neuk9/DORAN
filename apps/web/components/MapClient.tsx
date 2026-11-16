"use client";

import dynamic from "next/dynamic";

export const MapClient = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
});
