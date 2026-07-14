import {
  ANALYSIS_DEPENDENT_RULE_CODES,
  type CollectedFinding,
  type CollectedFindingStatus,
} from "./scan-engine";

export const CURRENT_RULES_VERSION = "2026.07-summary-groups-v7.6";

export const SCORE_CATEGORIES = [
  "접근 및 수집 정책",
  "콘텐츠 읽기 용이성",
  "정보 구조와 의미 전달",
  "핵심정보 인식 정확도",
  "콘텐츠 이해 및 답변 가능성",
  "AI 에이전트 사용 가능성",
  "최신성 및 측정 환경",
  "AI 답변 준비 콘텐츠",
] as const;

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

export const SUMMARY_GROUPS = ["TECHNICAL", "CONTENT", "TRUST"] as const;
export type SummaryGroup = (typeof SUMMARY_GROUPS)[number];

export interface RuleDefinition {
  ruleCode: string;
  category: ScoreCategory;
  summaryGroup: SummaryGroup;
  weight: number;
}

export const RULE_DEFINITIONS: readonly RuleDefinition[] = [
  {
    ruleCode: "ACCESS-HTTP-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-HTTPS-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "ACCESS-ROBOTS-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-ROBOTS-EVIDENCE",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-GPTBOT-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-OAI-SEARCHBOT-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-SITEMAP-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-LLMS-TXT-001",
    category: "접근 및 수집 정책",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-HTML-001",
    category: "콘텐츠 읽기 용이성",
    summaryGroup: "TECHNICAL",
    weight: 3,
  },
  {
    ruleCode: "CONTENT-INITIAL-001",
    category: "콘텐츠 읽기 용이성",
    summaryGroup: "TECHNICAL",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-H1-001",
    category: "콘텐츠 읽기 용이성",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-IFRAME-001",
    category: "콘텐츠 읽기 용이성",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "META-TITLE-001",
    category: "정보 구조와 의미 전달",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "META-DESCRIPTION-001",
    category: "정보 구조와 의미 전달",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "META-CANONICAL-001",
    category: "정보 구조와 의미 전달",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "STRUCT-LANG-001",
    category: "정보 구조와 의미 전달",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "META-OG-001",
    category: "정보 구조와 의미 전달",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "STRUCT-JSONLD-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-JSONLD-TYPES-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-SAMEAS-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-CONTACTPOINT-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-SEARCHACTION-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-ENTITY-TRUST-001",
    category: "핵심정보 인식 정확도",
    summaryGroup: "TRUST",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-ANSWERABILITY-001",
    category: "콘텐츠 이해 및 답변 가능성",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-HEADINGS-001",
    category: "콘텐츠 이해 및 답변 가능성",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-NAVIGATION-001",
    category: "콘텐츠 이해 및 답변 가능성",
    summaryGroup: "TECHNICAL",
    weight: 1,
  },
  {
    ruleCode: "ACCESS-CHATGPT-USER-001",
    category: "AI 에이전트 사용 가능성",
    summaryGroup: "TECHNICAL",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-INDEXABILITY-001",
    category: "AI 에이전트 사용 가능성",
    summaryGroup: "TECHNICAL",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-LINKS-001",
    category: "AI 에이전트 사용 가능성",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "ENV-MEASUREMENT-001",
    category: "최신성 및 측정 환경",
    summaryGroup: "TECHNICAL",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-CORE-DEFINITION-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 8,
  },
  {
    ruleCode: "CONTENT-AUDIENCE-USECASE-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-WORKFLOW-OUTCOME-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-PRICING-TERMS-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 8,
  },
  {
    ruleCode: "CONTENT-SUPPORT-CONTACT-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-DATA-POLICY-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-DIFFERENTIATION-PROOF-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 5,
  },
  {
    ruleCode: "CONTENT-TRANSACTION-POLICY-001",
    category: "AI 답변 준비 콘텐츠",
    summaryGroup: "CONTENT",
    weight: 5,
  },
] as const;

const rulesByCode = new Map(
  RULE_DEFINITIONS.map((definition) => [definition.ruleCode, definition]),
);

export function getRuleSummaryGroup(ruleCode: string): SummaryGroup {
  const definition = rulesByCode.get(ruleCode);

  if (!definition) {
    throw new Error(`Summary group is not defined for rule: ${ruleCode}`);
  }

  return definition.summaryGroup;
}

export interface ScoreCategoryResult {
  category: ScoreCategory;
  score: number;
  pendingScore?: number;
  maxScore: number;
  percentage: number;
}

export interface ScoreSummary {
  score: number;
  rawScore: number;
  pendingScore?: number;
  scoreRangeMin?: number;
  scoreRangeMax?: number;
  grade: string;
  cap: number | null;
  coverage: number;
  lostPoints: number;
  expectedImprovementMin: number;
  expectedImprovementMax: number;
  categories: ScoreCategoryResult[];
}

export interface ScorableFinding {
  ruleCode: string;
  category?: string;
  status: CollectedFindingStatus;
  evidence?: unknown;
  evidenceJson?: unknown;
}

function earnedWeight(status: CollectedFindingStatus, weight: number): number {
  return status === "PASS" || status === "NA" ? weight : 0;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function evidenceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function findingEvidence(finding: ScorableFinding): Record<string, unknown> {
  return evidenceRecord(finding.evidence ?? finding.evidenceJson);
}

function isContentDefinition(definition: RuleDefinition): boolean {
  return definition.summaryGroup === "CONTENT";
}

export function isPendingContentFinding(
  finding: ScorableFinding,
  definition: RuleDefinition | undefined = getRuleDefinition(finding.ruleCode),
): boolean {
  return (
    finding.status === "BLOCKED" &&
    definition?.summaryGroup === "CONTENT" &&
    findingEvidence(finding).contentEvidenceLevel === "UNAVAILABLE"
  );
}

// ACCESS-HTTP-001 and CONTENT-HTML-001 report BLOCKED (not FAIL) when every
// bot identity we tried got the same deliberate access-control refusal
// (401/403/429/451) — see scan-engine.ts's fetchMainPage. That means our
// scanner couldn't verify the site one way or the other, so it must not be
// scored as a confirmed failure or trigger the critical-cap penalty.
const UNVERIFIABLE_ACCESS_RULE_CODES = new Set([
  "ACCESS-HTTP-001",
  ...ANALYSIS_DEPENDENT_RULE_CODES,
]);

export function isUnverifiableAccessFinding(finding: ScorableFinding): boolean {
  return (
    finding.status === "BLOCKED" &&
    UNVERIFIABLE_ACCESS_RULE_CODES.has(finding.ruleCode) &&
    findingEvidence(finding).accessOutcome === "BLOCKED"
  );
}

function earnedWeightForFinding(
  finding: ScorableFinding,
  definition: RuleDefinition,
): number | null {
  if (isUnverifiableAccessFinding(finding)) {
    return null;
  }

  if (isContentDefinition(definition)) {
    if (isPendingContentFinding(finding, definition)) {
      return null;
    }

    const scoreRatio = findingEvidence(finding).scoreRatio;

    if (typeof scoreRatio === "number" && Number.isFinite(scoreRatio)) {
      return definition.weight * Math.max(0, Math.min(1, scoreRatio));
    }
  }

  return earnedWeight(finding.status, definition.weight);
}

function gradeFor(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  if (score >= 20) return "E";
  return "F";
}

function statusFor(
  findingsByCode: Map<string, ScorableFinding>,
  ruleCode: string,
): CollectedFindingStatus | undefined {
  return findingsByCode.get(ruleCode)?.status;
}

function scoreCap(findingsByCode: Map<string, ScorableFinding>): number | null {
  const caps: number[] = [];

  if (statusFor(findingsByCode, "ACCESS-HTTP-001") === "FAIL") {
    caps.push(10);
  }

  if (statusFor(findingsByCode, "ACCESS-INDEXABILITY-001") === "FAIL") {
    caps.push(30);
  }

  if (statusFor(findingsByCode, "CONTENT-HTML-001") === "FAIL") {
    caps.push(50);
  }

  return caps.length > 0 ? Math.min(...caps) : null;
}

export function getRuleDefinition(
  ruleCode: string,
): RuleDefinition | undefined {
  return rulesByCode.get(ruleCode);
}

export function calculateScore(
  findings: readonly ScorableFinding[],
): ScoreSummary {
  const findingsByCode = new Map(
    findings.map((finding) => [finding.ruleCode, finding]),
  );
  const categoryValues = new Map<
    ScoreCategory,
    { score: number; pendingScore: number; maxScore: number }
  >(
    SCORE_CATEGORIES.map((category) => [
      category,
      { score: 0, pendingScore: 0, maxScore: 0 },
    ]),
  );
  let rawScore = 0;
  let pendingScore = 0;
  let measuredWeight = 0;

  for (const definition of RULE_DEFINITIONS) {
    const finding = findingsByCode.get(definition.ruleCode);
    const category = categoryValues.get(definition.category);

    if (!category) {
      continue;
    }

    category.maxScore += definition.weight;

    if (finding) {
      const earned = earnedWeightForFinding(finding, definition);

      if (earned === null) {
        category.pendingScore += definition.weight;
        pendingScore += definition.weight;
      } else {
        measuredWeight += definition.weight;
        category.score += earned;
        rawScore += earned;
      }
    }
  }

  const cap = scoreCap(findingsByCode);
  const hasConfirmedFailure = RULE_DEFINITIONS.some((definition) => {
    if (definition.weight <= 0) {
      return false;
    }

    const finding = findingsByCode.get(definition.ruleCode);
    if (!finding) {
      return false;
    }

    if (isPendingContentFinding(finding, definition)) {
      return false;
    }

    if (isUnverifiableAccessFinding(finding)) {
      return false;
    }

    return finding.status !== "PASS" && finding.status !== "NA";
  });
  const automatedCeiling = hasConfirmedFailure ? 98 : 99;
  const confirmedBeforeCriticalCap = Math.min(rawScore, automatedCeiling);
  const possibleBeforeCriticalCap = Math.min(
    rawScore + pendingScore,
    automatedCeiling,
  );
  const score = Math.round(
    cap === null
      ? confirmedBeforeCriticalCap
      : Math.min(confirmedBeforeCriticalCap, cap),
  );
  const scoreRangeMax = Math.round(
    cap === null
      ? possibleBeforeCriticalCap
      : Math.min(possibleBeforeCriticalCap, cap),
  );
  const lostPoints = Math.max(0, 99 - scoreRangeMax);

  return {
    score,
    rawScore: roundOne(rawScore),
    pendingScore: roundOne(pendingScore),
    scoreRangeMin: score,
    scoreRangeMax,
    grade: gradeFor(score),
    cap,
    coverage: Math.round(measuredWeight),
    lostPoints,
    expectedImprovementMin:
      lostPoints === 0 ? 0 : Math.max(1, Math.ceil(lostPoints * 0.5)),
    expectedImprovementMax: lostPoints,
    categories: SCORE_CATEGORIES.map((category) => {
      const value = categoryValues.get(category) ?? {
        score: 0,
        pendingScore: 0,
        maxScore: 0,
      };

      return {
        category,
        score: roundOne(value.score),
        pendingScore: roundOne(value.pendingScore),
        maxScore: value.maxScore,
        percentage:
          value.maxScore === 0
            ? 0
            : Math.round((value.score / value.maxScore) * 100),
      };
    }),
  };
}

export function applyScoreToFindings(findings: readonly CollectedFinding[]): {
  findings: CollectedFinding[];
  summary: ScoreSummary;
} {
  const summary = calculateScore(findings);

  return {
    summary,
    findings: findings.map((finding) => {
      const definition = getRuleDefinition(finding.ruleCode);

      if (!definition) {
        return {
          ...finding,
          scoreDelta: 0,
        };
      }

      const earned = earnedWeightForFinding(finding, definition);

      return {
        ...finding,
        category: definition.category,
        scoreDelta: earned === null ? 0 : roundOne(earned - definition.weight),
      };
    }),
  };
}
