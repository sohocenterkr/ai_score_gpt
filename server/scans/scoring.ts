import type { CollectedFinding, CollectedFindingStatus } from "./scan-engine";

export const CURRENT_RULES_VERSION = "2026.07-core-v5";

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

export interface RuleDefinition {
  ruleCode: string;
  category: ScoreCategory;
  weight: number;
}

export const RULE_DEFINITIONS: readonly RuleDefinition[] = [
  {
    ruleCode: "ACCESS-HTTP-001",
    category: "접근 및 수집 정책",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-HTTPS-001",
    category: "접근 및 수집 정책",
    weight: 1,
  },
  {
    ruleCode: "ACCESS-ROBOTS-001",
    category: "접근 및 수집 정책",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-OAI-SEARCHBOT-001",
    category: "접근 및 수집 정책",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-SITEMAP-001",
    category: "접근 및 수집 정책",
    weight: 2,
  },
  {
    ruleCode: "ACCESS-LLMS-TXT-001",
    category: "접근 및 수집 정책",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-HTML-001",
    category: "콘텐츠 읽기 용이성",
    weight: 3,
  },
  {
    ruleCode: "CONTENT-INITIAL-001",
    category: "콘텐츠 읽기 용이성",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-H1-001",
    category: "콘텐츠 읽기 용이성",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-IFRAME-001",
    category: "콘텐츠 읽기 용이성",
    weight: 1,
  },
  {
    ruleCode: "META-TITLE-001",
    category: "정보 구조와 의미 전달",
    weight: 2,
  },
  {
    ruleCode: "META-DESCRIPTION-001",
    category: "정보 구조와 의미 전달",
    weight: 2,
  },
  {
    ruleCode: "META-CANONICAL-001",
    category: "정보 구조와 의미 전달",
    weight: 1,
  },
  {
    ruleCode: "STRUCT-LANG-001",
    category: "정보 구조와 의미 전달",
    weight: 1,
  },
  {
    ruleCode: "META-OG-001",
    category: "정보 구조와 의미 전달",
    weight: 1,
  },
  {
    ruleCode: "STRUCT-JSONLD-001",
    category: "핵심정보 인식 정확도",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-JSONLD-TYPES-001",
    category: "핵심정보 인식 정확도",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-SAMEAS-001",
    category: "핵심정보 인식 정확도",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-CONTACTPOINT-001",
    category: "핵심정보 인식 정확도",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-SEARCHACTION-001",
    category: "핵심정보 인식 정확도",
    weight: 2,
  },
  {
    ruleCode: "STRUCT-JSONLD-ENTITY-TRUST-001",
    category: "핵심정보 인식 정확도",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-ANSWERABILITY-001",
    category: "콘텐츠 이해 및 답변 가능성",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-HEADINGS-001",
    category: "콘텐츠 이해 및 답변 가능성",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-NAVIGATION-001",
    category: "콘텐츠 이해 및 답변 가능성",
    weight: 1,
  },
  {
    ruleCode: "ACCESS-CHATGPT-USER-001",
    category: "AI 에이전트 사용 가능성",
    weight: 0,
  },
  {
    ruleCode: "ACCESS-INDEXABILITY-001",
    category: "AI 에이전트 사용 가능성",
    weight: 3,
  },
  {
    ruleCode: "STRUCT-LINKS-001",
    category: "AI 에이전트 사용 가능성",
    weight: 2,
  },
  {
    ruleCode: "ENV-MEASUREMENT-001",
    category: "최신성 및 측정 환경",
    weight: 2,
  },
  {
    ruleCode: "CONTENT-CORE-DEFINITION-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 8,
  },
  {
    ruleCode: "CONTENT-AUDIENCE-USECASE-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-WORKFLOW-OUTCOME-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-PRICING-TERMS-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 8,
  },
  {
    ruleCode: "CONTENT-SUPPORT-CONTACT-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-DATA-POLICY-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 6,
  },
  {
    ruleCode: "CONTENT-DIFFERENTIATION-PROOF-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 5,
  },
  {
    ruleCode: "CONTENT-TRANSACTION-POLICY-001",
    category: "AI 답변 준비 콘텐츠",
    weight: 5,
  },
] as const;

const rulesByCode = new Map(
  RULE_DEFINITIONS.map((definition) => [definition.ruleCode, definition]),
);

export interface ScoreCategoryResult {
  category: ScoreCategory;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface ScoreSummary {
  score: number;
  rawScore: number;
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
  status: CollectedFindingStatus;
}

function earnedWeight(status: CollectedFindingStatus, weight: number): number {
  return status === "PASS" || status === "NA" ? weight : 0;
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

  if (statusFor(findingsByCode, "ACCESS-HTTP-001") !== "PASS") {
    caps.push(10);
  }

  if (statusFor(findingsByCode, "ACCESS-INDEXABILITY-001") === "FAIL") {
    caps.push(30);
  }

  if (statusFor(findingsByCode, "CONTENT-HTML-001") !== "PASS") {
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
    { score: number; maxScore: number }
  >(SCORE_CATEGORIES.map((category) => [category, { score: 0, maxScore: 0 }]));
  let rawScore = 0;
  let measuredWeight = 0;

  for (const definition of RULE_DEFINITIONS) {
    const finding = findingsByCode.get(definition.ruleCode);
    const category = categoryValues.get(definition.category);

    if (!category) {
      continue;
    }

    category.maxScore += definition.weight;

    if (finding) {
      measuredWeight += definition.weight;
      const earned = earnedWeight(finding.status, definition.weight);
      category.score += earned;
      rawScore += earned;
    }
  }

  const cap = scoreCap(findingsByCode);
  const score = Math.round(cap === null ? rawScore : Math.min(rawScore, cap));
  const lostPoints = Math.max(0, 100 - score);

  return {
    score,
    rawScore: Math.round(rawScore),
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
        maxScore: 0,
      };

      return {
        category,
        score: Math.round(value.score),
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

      return {
        ...finding,
        category: definition.category,
        scoreDelta: finding.status === "PASS" || finding.status === "NA" ? 0 : -definition.weight,
      };
    }),
  };
}
