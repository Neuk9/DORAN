export type Meta = {
  source: string;
  captured_at: string | null;
  snapshot_version: string | null;
  disclaimer: string;
};

export type Envelope<T> = { data: T; meta: Meta };

export type Region = { adm_cd: string; name: string; level: string };

export type Program = {
  offering_id: string;
  resource_id: string;
  title: string;
  category: string;
  provider: string | null;
  address: string | null;
  fee: number;
  apply_end: string | null;
  distance_km: number | null;
  source: string;
  captured_at: string | null;
  lat?: number | null;
  lng?: number | null;
  reasons?: string[];
};

const BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<Envelope<T>> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return res.json();
}

export async function apiGetSafe<T>(path: string, fallback: T): Promise<Envelope<T>> {
  try {
    return await apiGet<T>(path);
  } catch {
    return {
      data: fallback,
      meta: { source: "fallback", captured_at: null, snapshot_version: null, disclaimer: "" },
    };
  }
}
