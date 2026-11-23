from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

CategoryType = Literal["welfare", "education", "culture"]
CostType = Literal["free", "paid", "subsidy"]
EligibilityStatus = Literal["eligible", "verify_needed", "ineligible"]


class GeoPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(..., min_length=2, max_length=2)  # [lng, lat]


class ProgramRegion(BaseModel):
    sido: str
    sigungu: str
    dong: str | None = None
    admCd: str
    isNationwide: bool = False


class ProgramCost(BaseModel):
    type: CostType
    amount: int = 0
    description: str


class ProgramSchedule(BaseModel):
    days: list[str] = Field(default_factory=list)  # mon..sun
    timeSlots: list[str] = Field(default_factory=list)  # weekday_day, weekday_evening, weekend, online
    hoursText: str = "상시 / 기관 문의"


class EligibilityRule(BaseModel):
    minAge: int | None = None
    maxAge: int | None = None
    targetGroups: list[str] = Field(default_factory=list)
    incomeMaxPct: int | None = None  # 기준중위소득 %
    requiresVerification: list[str] = Field(default_factory=list)
    requiredDocs: list[str] = Field(default_factory=list)


class ApplyInfo(BaseModel):
    method: str
    url: str | None = None
    phone: str | None = None


class SourceInfo(BaseModel):
    name: str
    syncedAt: datetime


class ProgramBase(BaseModel):
    externalId: str
    category: CategoryType
    title: str
    summary: str
    provider: str
    region: ProgramRegion
    location: GeoPoint | None = None
    address: str | None = None
    cost: ProgramCost
    schedule: ProgramSchedule
    deadline: datetime | None = None
    isAlwaysOpen: bool = False
    eligibility: EligibilityRule
    applyInfo: ApplyInfo
    source: SourceInfo
    tags: list[str] = Field(default_factory=list)


class ProgramOut(ProgramBase):
    id: str
    distanceKm: float | None = None


class UserProfile(BaseModel):
    sido: str | None = None
    sigungu: str | None = None
    dong: str | None = None
    admCd: str | None = None
    age: int | None = None
    targetGroups: list[str] = Field(default_factory=list)  # youth, student, senior, low_income, family, job_seeker
    categories: list[CategoryType] = Field(default_factory=list)
    preferFree: bool = False
    timePreferences: list[str] = Field(default_factory=list)  # weekend, weekday_evening, weekday_day
    keywords: list[str] = Field(default_factory=list)


class EligibilityEvaluation(BaseModel):
    status: EligibilityStatus
    matchedConditions: list[str] = Field(default_factory=list)
    verificationNeeded: list[str] = Field(default_factory=list)
    unmetConditions: list[str] = Field(default_factory=list)
    disclaimer: str = "안내된 자격 판정은 입력 정보 기준의 가능성 안내이며, 최종 수급 여부는 주관 기관 확인이 필요합니다."


class ScoreBreakdown(BaseModel):
    total: float
    eligibility: float
    distance: float
    cost: float
    scheduleAndRelevance: float


class RecommendedProgram(BaseModel):
    program: ProgramOut
    eligibility: EligibilityEvaluation
    scores: ScoreBreakdown
    explanation: str


class CrisisContact(BaseModel):
    name: str
    number: str
    description: str


class CrisisResponse(BaseModel):
    detected: bool = True
    message: str
    contacts: list[CrisisContact]


class ChatRecommendRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    admCd: str | None = None
    lat: float | None = None
    lng: float | None = None
    overrideProfile: UserProfile | None = None
    limit: int = Field(default=8, ge=1, le=20)


class BenefitSummary(BaseModel):
    estimatedMonthlyKRW: int = 0
    estimatedAnnualKRW: int = 0
    freeResourceCount: int = 0
    subsidyCount: int = 0
    headline: str = ""


class HiddenGem(BaseModel):
    program: ProgramOut
    reason: str


class ActionPlanStep(BaseModel):
    phase: str
    title: str
    description: str
    programIds: list[str] = Field(default_factory=list)


class ExcludedProgram(BaseModel):
    programId: str
    title: str
    provider: str
    category: CategoryType
    reasons: list[str] = Field(default_factory=list)


class ChatRecommendResponse(BaseModel):
    crisis: CrisisResponse | None = None
    maskedPreview: str | None = None
    profile: UserProfile | None = None
    recommendations: list[RecommendedProgram] = Field(default_factory=list)
    benefitSummary: BenefitSummary | None = None
    hiddenGems: list[HiddenGem] = Field(default_factory=list)
    actionPlan: list[ActionPlanStep] = Field(default_factory=list)
    consolidatedDocs: list[str] = Field(default_factory=list)
    excludedPrograms: list[ExcludedProgram] = Field(default_factory=list)
    totalEvaluatedCount: int = 0
    totalExcludedCount: int = 0
    summaryMessage: str = ""
    provider: str = "mock"


class RegionPopulation(BaseModel):
    total: int
    youth: int
    senior: int
    vulnerableRatio: float


class RegionSupply(BaseModel):
    welfare: int
    education: int
    culture: int
    total: int


class RegionScores(BaseModel):
    demandIndex: float
    supplyIndex: float
    gapIndex: float
    shortageCategories: list[CategoryType] = Field(default_factory=list)


class RegionStatOut(BaseModel):
    admCd: str
    sido: str
    sigungu: str
    dong: str
    center: GeoPoint
    population: RegionPopulation
    supply: RegionSupply
    scores: RegionScores
    updatedAt: datetime


class RecommendedFacility(BaseModel):
    name: str
    category: CategoryType
    priority: Literal["urgent", "high", "recommended"]
    targetDemographic: str
    currentInDongCount: int
    currentStatus: str
    rationale: str
    deliverySuggestion: str
    estimatedGapReduction: float


class RegionReportOut(BaseModel):
    region: RegionStatOut
    liveProgramCounts: RegionSupply
    recentDemandSignals: dict[str, int]
    nearbyRecommended: list[ProgramOut]
    recommendedFacilities: list[RecommendedFacility] = Field(default_factory=list)
    insights: list[str]


class SavedUpdateRequest(BaseModel):
    programId: str


class SavedChecklistOut(BaseModel):
    sessionId: str
    expiresAt: datetime | None = None
    items: list[ProgramOut] = Field(default_factory=list)


class ApiResponse(BaseModel):
    data: Any
    meta: dict[str, Any] = Field(default_factory=dict)
