import type {
  CategoryType,
  ChatRecommendResponse,
  CostType,
  NearestRegionResult,
  Program,
  RegionReport,
  RegionStat,
  SavedChecklist,
  UserProfile,
} from "./types";

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 요청 실패 (${res.status}): ${text}`);
  }
  const body = (await res.json()) as Envelope<T>;
  return body.data;
}

export async function fetchPrograms(params?: {
  category?: CategoryType | "";
  costType?: CostType | "";
  timeSlot?: string;
  admCd?: string;
  sigungu?: string;
  q?: string;
  includeClosed?: boolean;
  includeOnline?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}): Promise<Program[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.costType) qs.set("costType", params.costType);
  if (params?.timeSlot) qs.set("timeSlot", params.timeSlot);
  if (params?.admCd) qs.set("admCd", params.admCd);
  if (params?.sigungu) qs.set("sigungu", params.sigungu);
  if (params?.q) qs.set("q", params.q);
  if (params?.includeClosed) qs.set("includeClosed", "true");
  if (params?.includeOnline) qs.set("includeOnline", "true");
  if (params?.lat != null) qs.set("lat", String(params.lat));
  if (params?.lng != null) qs.set("lng", String(params.lng));
  if (params?.radiusKm != null) qs.set("radiusKm", String(params.radiusKm));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return requestJson<Program[]>(`/api/programs${query ? `?${query}` : ""}`);
}

export async function fetchProgramById(id: string): Promise<Program> {
  return requestJson<Program>(`/api/programs/${encodeURIComponent(id)}`);
}

export async function fetchRegions(): Promise<RegionStat[]> {
  return requestJson<RegionStat[]>("/api/regions");
}

export async function fetchNearestRegion(lat: number, lng: number): Promise<NearestRegionResult> {
  return requestJson<NearestRegionResult>(`/api/regions/nearest?lat=${lat}&lng=${lng}`);
}

export async function fetchRegionReport(admCd: string): Promise<RegionReport> {
  return requestJson<RegionReport>(`/api/regions/${encodeURIComponent(admCd)}/report`);
}

export async function triggerPublicSync(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/regions/sync", {
    method: "POST",
  });
}

export async function postChatRecommend(payload: {
  message: string;
  admCd?: string;
  lat?: number;
  lng?: number;
  overrideProfile?: UserProfile;
  limit?: number;
}): Promise<ChatRecommendResponse> {
  return requestJson<ChatRecommendResponse>("/api/chat/recommend", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSavedChecklist(sessionId: string): Promise<SavedChecklist> {
  return requestJson<SavedChecklist>("/api/saved", {
    headers: { "X-Session-Id": sessionId },
  });
}

export async function addSavedProgram(sessionId: string, programId: string): Promise<SavedChecklist> {
  return requestJson<SavedChecklist>("/api/saved", {
    method: "POST",
    headers: { "X-Session-Id": sessionId },
    body: JSON.stringify({ programId }),
  });
}

export async function removeSavedProgram(sessionId: string, programId: string): Promise<SavedChecklist> {
  return requestJson<SavedChecklist>(`/api/saved/${encodeURIComponent(programId)}`, {
    method: "DELETE",
    headers: { "X-Session-Id": sessionId },
  });
}
