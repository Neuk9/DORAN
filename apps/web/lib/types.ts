export type CategoryType = "welfare" | "education" | "culture";
export type CostType = "free" | "paid" | "subsidy";
export type EligibilityStatus = "eligible" | "verify_needed" | "ineligible";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface Program {
  id: string;
  externalId: string;
  category: CategoryType;
  title: string;
  summary: string;
  provider: string;
  region: {
    sido: string;
    sigungu: string;
    dong?: string | null;
    admCd: string;
    isNationwide: boolean;
  };
  location?: GeoPoint | null;
  address?: string | null;
  cost: {
    type: CostType;
    amount: number;
    description: string;
  };
  schedule: {
    days: string[];
    timeSlots: string[];
    hoursText: string;
  };
  deadline?: string | null;
  isAlwaysOpen: boolean;
  eligibility: {
    minAge?: number | null;
    maxAge?: number | null;
    targetGroups: string[];
    incomeMaxPct?: number | null;
    requiresVerification: string[];
    requiredDocs: string[];
  };
  applyInfo: {
    method: string;
    url?: string | null;
    phone?: string | null;
  };
  source: {
    name: string;
    syncedAt: string;
  };
  tags: string[];
  distanceKm?: number | null;
}

export interface UserProfile {
  sido?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  admCd?: string | null;
  age?: number | null;
  targetGroups: string[];
  categories: CategoryType[];
  preferFree: boolean;
  timePreferences: string[];
  keywords: string[];
}

export interface EligibilityEvaluation {
  status: EligibilityStatus;
  matchedConditions: string[];
  verificationNeeded: string[];
  unmetConditions: string[];
  disclaimer: string;
}

export interface ScoreBreakdown {
  total: number;
  eligibility: number;
  distance: number;
  cost: number;
  scheduleAndRelevance: number;
}

export interface RecommendedProgram {
  program: Program;
  eligibility: EligibilityEvaluation;
  scores: ScoreBreakdown;
  explanation: string;
}

export interface CrisisContact {
  name: string;
  number: string;
  description: string;
}

export interface CrisisResponse {
  detected: boolean;
  message: string;
  contacts: CrisisContact[];
}

export interface BenefitSummary {
  estimatedMonthlyKRW: number;
  estimatedAnnualKRW: number;
  freeResourceCount: number;
  subsidyCount: number;
  headline: string;
}

export interface HiddenGem {
  program: Program;
  reason: string;
}

export interface ActionPlanStep {
  phase: string;
  title: string;
  description: string;
  programIds: string[];
}

export interface ExcludedProgram {
  programId: string;
  title: string;
  provider: string;
  category: CategoryType;
  reasons: string[];
}

export interface ChatRecommendResponse {
  crisis?: CrisisResponse | null;
  maskedPreview?: string | null;
  profile?: UserProfile | null;
  recommendations: RecommendedProgram[];
  benefitSummary?: BenefitSummary | null;
  hiddenGems?: HiddenGem[];
  actionPlan?: ActionPlanStep[];
  consolidatedDocs?: string[];
  excludedPrograms?: ExcludedProgram[];
  totalEvaluatedCount?: number;
  totalExcludedCount?: number;
  summaryMessage: string;
  provider: string;
}

export interface RegionStat {
  admCd: string;
  sido: string;
  sigungu: string;
  dong: string;
  center: GeoPoint;
  population: {
    total: number;
    youth: number;
    senior: number;
    vulnerableRatio: number;
  };
  supply: {
    welfare: number;
    education: number;
    culture: number;
    total: number;
  };
  scores: {
    demandIndex: number;
    supplyIndex: number;
    gapIndex: number;
    shortageCategories: CategoryType[];
  };
  updatedAt: string;
}

export interface RecommendedFacility {
  name: string;
  category: CategoryType;
  priority: "urgent" | "high" | "recommended";
  targetDemographic: string;
  currentInDongCount: number;
  currentStatus: string;
  rationale: string;
  deliverySuggestion: string;
  estimatedGapReduction: number;
}

export interface RegionReport {
  region: RegionStat;
  liveProgramCounts: {
    welfare: number;
    education: number;
    culture: number;
    total: number;
  };
  recentDemandSignals: Record<string, number>;
  nearbyRecommended: Program[];
  recommendedFacilities: RecommendedFacility[];
  insights: string[];
}

export interface SavedChecklist {
  sessionId: string;
  expiresAt?: string | null;
  items: Program[];
}

export interface NearestRegionResult {
  region: RegionStat;
  actualRegion?: {
    sido: string;
    sigungu: string;
    dong: string;
    admCd: string;
  } | null;
  distanceKm: number;
  inServiceArea: boolean;
}

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  welfare: "복지",
  education: "교육",
  culture: "문화",
};

export const COST_LABELS: Record<CostType, string> = {
  free: "무료",
  subsidy: "지원금·바우처",
  paid: "일부 유료",
};

export const TIME_LABELS: Record<string, string> = {
  weekend: "주말",
  weekday_evening: "평일 야간",
  weekday_day: "평일 주간",
  online: "온라인",
};

export const GROUP_LABELS: Record<string, string> = {
  youth: "청년",
  student: "대학생·학생",
  senior: "어르신",
  low_income: "저소득·취약계층",
  family: "가족·아동·다문화",
  job_seeker: "취업준비생",
  general: "일반 주민",
};

export function formatDeadlineBadge(program: Program): string {
  if (program.isAlwaysOpen || !program.deadline) return "상시 모집";
  const deadlineDate = new Date(program.deadline);
  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "마감";
  if (diffDays === 0) return "오늘 마감";
  return `D-${diffDays}`;
}

export function formatDistanceWithWalk(distanceKm?: number | null): string | null {
  if (distanceKm == null) return null;
  if (distanceKm < 0.1) return "100m 이내 · 도보 1분";
  if (distanceKm <= 1.6) {
    const walkMin = Math.max(2, Math.round((distanceKm / 4.2) * 60));
    return `${distanceKm}km · 도보 약 ${walkMin}분`;
  }
  const transitMin = Math.max(6, Math.round((distanceKm / 14) * 60));
  return `${distanceKm}km · 대중교통 약 ${transitMin}분`;
}
