import { randomUUID } from "node:crypto";
import {
  Prisma,
  type AiQuestion,
  type AiQuestionKind,
  type AiQuestionStatus,
  type SiteFact,
} from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { env } from "../config/env";
import { getDatabase } from "../db";
import {
  calculateAnswerPerformance,
} from "./answer-performance";
import {
  answerExplicitlyDoesNotIdentifyTarget,
} from "./deep-answer-trust";
import { CURRENT_RULES_VERSION } from "../scans/scoring";

export const SITE_FACT_KEYS = [
  "service_definition",
  "primary_features",
  "target_audience",
  "usage_steps",
  "supported_platforms",
  "pricing",
  "data_handling",
  "operator",
  "contact",
  "unsupported_capabilities",
] as const;

export type SiteFactKey = (typeof SITE_FACT_KEYS)[number];

export interface SiteFactDefinition {
  key: SiteFactKey;
  label: string;
  help: string;
  placeholder: string;
  important: boolean;
}

export const SITE_FACT_DEFINITIONS: readonly SiteFactDefinition[] = [
  {
    key: "service_definition",
    label: "서비스 정의",
    help: "사이트가 실제로 제공하는 서비스와 해결하는 문제를 작성합니다.",
    placeholder: "예: 사진·음성·메모를 바탕으로 블로그 초안을 만드는 서비스입니다.",
    important: true,
  },
  {
    key: "primary_features",
    label: "주요 기능",
    help: "현재 실제로 제공하는 핵심 기능을 줄바꿈으로 구분해 작성합니다.",
    placeholder: "예: 사진 내용 정리\n음성 메모 반영\n블로그 초안 생성",
    important: true,
  },
  {
    key: "target_audience",
    label: "이용 대상",
    help: "주요 이용자와 도움이 되는 사용 상황을 작성합니다.",
    placeholder: "예: 현장 사진으로 홍보 글을 작성해야 하는 소상공인",
    important: true,
  },
  {
    key: "usage_steps",
    label: "이용 절차",
    help: "가입부터 결과 확인까지 실제 이용 순서를 작성합니다.",
    placeholder: "예: 회원가입 → 자료 등록 → 초안 생성 → 검토·수정",
    important: true,
  },
  {
    key: "supported_platforms",
    label: "지원 환경·플랫폼",
    help: "지원 기기, 브라우저, 언어, 파일 형식 등을 작성합니다.",
    placeholder: "예: 모바일·PC 웹, 한국어, JPG·PNG·음성 메모",
    important: true,
  },
  {
    key: "pricing",
    label: "요금·무료 범위",
    help: "현재 공개 가능한 실제 요금과 무료 이용 범위를 작성합니다.",
    placeholder: "예: 베타 기간 무료 / 유료 요금제 준비 중",
    important: false,
  },
  {
    key: "data_handling",
    label: "자료·개인정보 처리",
    help: "업로드 자료의 저장·삭제·이용 방식을 사실대로 작성합니다.",
    placeholder: "예: 업로드 자료는 초안 생성에만 사용하며 탈퇴 시 삭제합니다.",
    important: false,
  },
  {
    key: "operator",
    label: "운영 주체",
    help: "서비스 운영 회사·사업자·기관 정보를 작성합니다.",
    placeholder: "예: 주식회사 예시 / 대한민국 서울",
    important: false,
  },
  {
    key: "contact",
    label: "문의 방법",
    help: "고객이 실제로 이용할 수 있는 문의 채널을 작성합니다.",
    placeholder: "예: support@example.com / 평일 09:00~18:00",
    important: false,
  },
  {
    key: "unsupported_capabilities",
    label: "제공하지 않는 기능·주의사항",
    help: "AI가 과장하거나 잘못 답하면 안 되는 내용을 작성합니다.",
    placeholder: "예: 자동 게시 기능은 제공하지 않으며 생성 결과는 사용자가 검토해야 합니다.",
    important: false,
  },
];

interface AccessibleSite {
  id: string;
  name: string;
  baseUrl: string;
  siteType: string | null;
  primaryLocale: string;
}

interface DefaultQuestionTemplate {
  code: string;
  kind: AiQuestionKind;
  expectedFactKeys: SiteFactKey[];
  question: (site: AccessibleSite) => string;
}

function topicSubject(name: string): string {
  const trimmed = name.trim();
  const lastCharacter = trimmed.at(-1);

  if (!lastCharacter) {
    return trimmed;
  }

  const codePoint = lastCharacter.charCodeAt(0);
  const isHangulSyllable =
    codePoint >= 0xac00 && codePoint <= 0xd7a3;
  const hasFinalConsonant =
    isHangulSyllable && (codePoint - 0xac00) % 28 !== 0;

  return `${trimmed}${hasFinalConsonant ? "은" : "는"}`;
}

function legacyDefaultQuestion(
  code: string,
  site: AccessibleSite,
): string | null {
  if (code === "BRAND-01") {
    return `${site.name}은 어떤 서비스이며 어떤 문제를 해결하나요?`;
  }

  if (code === "USE-CASE-01") {
    return `${site.name}은 누구에게 어떤 상황에서 도움이 되나요?`;
  }

  return null;
}

const DEFAULT_QUESTIONS: readonly DefaultQuestionTemplate[] = [
  {
    code: "BRAND-01",
    kind: "BRAND",
    expectedFactKeys: ["service_definition", "primary_features"],
    question: (site) =>
      `${topicSubject(site.name)} 어떤 서비스이며 어떤 문제를 해결하나요?`,
  },
  {
    code: "FEATURE-01",
    kind: "FEATURE",
    expectedFactKeys: [
      "primary_features",
      "supported_platforms",
      "unsupported_capabilities",
    ],
    question: (site) =>
      `${site.name}의 주요 기능과 제공 범위는 무엇인가요?`,
  },
  {
    code: "USE-CASE-01",
    kind: "USE_CASE",
    expectedFactKeys: ["target_audience", "service_definition"],
    question: (site) =>
      `${topicSubject(site.name)} 누구에게 어떤 상황에서 도움이 되나요?`,
  },
  {
    code: "TRUST-01",
    kind: "TRUST",
    expectedFactKeys: [
      "pricing",
      "data_handling",
      "operator",
      "contact",
    ],
    question: (site) =>
      `${site.name}의 요금, 운영 주체, 자료 처리 방식과 문의 방법은 무엇인가요?`,
  },
  {
    code: "DISCOVERY-01",
    kind: "DISCOVERY",
    expectedFactKeys: [
      "service_definition",
      "primary_features",
      "target_audience",
    ],
    question: (site) =>
      `${site.siteType?.trim() || "이와 같은 온라인 서비스"}를 찾는 사용자가 고려할 수 있는 서비스는 무엇인가요?`,
  },
  {
    code: "COMPARISON-01",
    kind: "COMPARISON",
    expectedFactKeys: [
      "service_definition",
      "primary_features",
      "pricing",
      "unsupported_capabilities",
    ],
    question: (site) =>
      `${site.name}을 비슷한 서비스와 비교할 때 확인할 특징은 무엇인가요?`,
  },
];

export interface PublicSiteFact {
  id: string;
  factKey: SiteFactKey;
  value: string;
  source: "USER" | "IMPORTED";
  createdAt: string;
  updatedAt: string;
}

export interface PublicAiQuestion {
  id: string;
  siteId: string;
  code: string;
  kind: AiQuestionKind;
  source: "SYSTEM" | "USER" | "GENERATED";
  status: AiQuestionStatus;
  question: string;
  expectedFactKeys: SiteFactKey[];
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicDeepDiagnosticScan {
  id: string;
  status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "PARTIAL"
    | "FAILED"
    | "CANCELLED";
  score: number | null;
  grade: string | null;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PublicDeepAnswerSummary {
  provider: string;
  model: string;
  methodologyVersion: string;
  plannedQuestionCount: number;
  completedQuestionCount: number;
  totalRunCount: number;
  completedRunCount: number;
  partialRunCount: number;
  failedRunCount: number;
  answerCompletionRate: number | null;
  brandMentionRate: number | null;
  targetCitationRate: number | null;
  factualAccuracy: number | null;
  completeness: number | null;
  consistency: number | null;
  performanceScore: number | null;
  scoreCoverage: number | null;
  serviceIdentificationRate: number | null;
}

export type PublicFactEvaluationStatus =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "NOT_MENTIONED"
  | "UNCLEAR";

export interface PublicFactEvaluationItem {
  factKey: string;
  label: string;
  status: PublicFactEvaluationStatus;
  reason: string;
  expectedValue: string | null;
}

export interface PublicFactualEvaluation {
  summary: string;
  factualAccuracy: number;
  completeness: number;
  factResults: PublicFactEvaluationItem[];
}

export interface PublicDeepAnswerRun {
  id: string;
  questionCode: string;
  questionKind: AiQuestionKind;
  questionText: string;
  runNumber: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  answerText: string | null;
  brandMentioned: boolean | null;
  targetDomainCited: boolean | null;
  citations: Array<{
    url: string;
    title: string | null;
  }>;
  sources: Array<{
    url: string;
    title: string | null;
  }>;
  factualEvaluation: PublicFactualEvaluation | null;
  expectedFactKeys: string[];
  expectedFactCount: number;
  serviceIdentified: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: string | null;
}

export interface PublicDeepDiagnosticExecution {
  apiConfigured: boolean;
  provider: "OPENAI";
  model: string;
  evaluationModel: string;
  runsPerQuestion: number;
  maxQuestions: number;
  activeQuestionCount: number;
  plannedAnswerRuns: number;
  plannedApiCalls: number;
  requiredFactCount: number;
  savedRequiredFactCount: number;
  canStart: boolean;
  blockers: string[];
  latestScan: PublicDeepDiagnosticScan | null;
  summary: PublicDeepAnswerSummary | null;
  runs: PublicDeepAnswerRun[];
}

export interface PublicDeepDiagnosticSetup {
  site: AccessibleSite;
  factDefinitions: readonly SiteFactDefinition[];
  facts: PublicSiteFact[];
  questions: PublicAiQuestion[];
  execution: PublicDeepDiagnosticExecution;
}

export interface CreateAiQuestionInput {
  kind: AiQuestionKind;
  question: string;
  expectedFactKeys: SiteFactKey[];
  isRequired: boolean;
}

export interface UpdateAiQuestionInput {
  kind?: AiQuestionKind;
  question?: string;
  expectedFactKeys?: SiteFactKey[];
  isRequired?: boolean;
  status?: AiQuestionStatus;
}

export interface DeepDiagnosticAdminService {
  getSetup(
    user: PublicUser,
    siteId: string,
  ): Promise<PublicDeepDiagnosticSetup>;
  saveFact(
    user: PublicUser,
    siteId: string,
    factKey: SiteFactKey,
    value: string,
  ): Promise<PublicSiteFact>;
  deleteFact(
    user: PublicUser,
    siteId: string,
    factKey: SiteFactKey,
  ): Promise<void>;
  ensureDefaultQuestions(
    user: PublicUser,
    siteId: string,
  ): Promise<PublicAiQuestion[]>;
  createQuestion(
    user: PublicUser,
    siteId: string,
    input: CreateAiQuestionInput,
  ): Promise<PublicAiQuestion>;
  updateQuestion(
    user: PublicUser,
    siteId: string,
    questionId: string,
    input: UpdateAiQuestionInput,
  ): Promise<PublicAiQuestion>;
  startDiagnostic(
    user: PublicUser,
    siteId: string,
  ): Promise<PublicDeepDiagnosticScan>;
}

export class DeepDiagnosticAdminServiceError extends Error {
  constructor(
    public readonly code:
      | "SITE_NOT_FOUND"
      | "QUESTION_NOT_FOUND"
      | "FACT_KEY_NOT_ALLOWED"
      | "OPENAI_NOT_CONFIGURED"
      | "DEEP_NOT_READY"
      | "SCAN_ALREADY_RUNNING",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DeepDiagnosticAdminServiceError";
  }
}

function normalizeMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isSiteFactKey(value: string): value is SiteFactKey {
  return (SITE_FACT_KEYS as readonly string[]).includes(value);
}

function jsonValueText(value: Prisma.JsonValue): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  ) {
    return value.join("\n");
  }

  return JSON.stringify(value, null, 2);
}

function jsonFactKeys(value: Prisma.JsonValue): SiteFactKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is SiteFactKey =>
      typeof item === "string" && isSiteFactKey(item),
  );
}

function publicFact(fact: SiteFact): PublicSiteFact {
  if (!isSiteFactKey(fact.factKey)) {
    throw new DeepDiagnosticAdminServiceError(
      "FACT_KEY_NOT_ALLOWED",
      "지원하지 않는 기준정보 항목입니다.",
      400,
    );
  }

  return {
    id: fact.id,
    factKey: fact.factKey,
    value: jsonValueText(fact.expectedValue),
    source: fact.source,
    createdAt: fact.createdAt.toISOString(),
    updatedAt: fact.updatedAt.toISOString(),
  };
}

function publicQuestion(question: AiQuestion): PublicAiQuestion {
  return {
    id: question.id,
    siteId: question.siteId,
    code: question.code,
    kind: question.kind,
    source: question.source,
    status: question.status,
    question: question.question,
    expectedFactKeys: jsonFactKeys(question.expectedFactKeys),
    isRequired: question.isRequired,
    sortOrder: question.sortOrder,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

async function findAccessibleSite(
  userId: string,
  siteId: string,
): Promise<AccessibleSite> {
  const prisma = getDatabase();
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      status: "ACTIVE",
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      siteType: true,
      primaryLocale: true,
    },
  });

  if (!site) {
    throw new DeepDiagnosticAdminServiceError(
      "SITE_NOT_FOUND",
      "사이트를 찾을 수 없습니다.",
      404,
    );
  }

  return site;
}

async function ensureDefaultsForSite(
  site: AccessibleSite,
): Promise<void> {
  const prisma = getDatabase();
  const existing = await prisma.aiQuestion.findMany({
    where: {
      siteId: site.id,
      code: {
        in: DEFAULT_QUESTIONS.map((template) => template.code),
      },
    },
    select: {
      id: true,
      code: true,
      question: true,
      source: true,
      isRequired: true,
      expectedFactKeys: true,
    },
  });
  const existingByCode = new Map(
    existing.map((item) => [item.code, item]),
  );
  const missing = DEFAULT_QUESTIONS.filter(
    (template) => !existingByCode.has(template.code),
  );

  if (missing.length > 0) {
    await prisma.aiQuestion.createMany({
      data: missing.map((template, index) => ({
        siteId: site.id,
        code: template.code,
        kind: template.kind,
        source: "SYSTEM",
        status: "ACTIVE",
        question: template.question(site),
        expectedFactKeys:
          template.expectedFactKeys as unknown as Prisma.InputJsonValue,
        isRequired: true,
        sortOrder: (index + 1) * 10,
      })),
      skipDuplicates: true,
    });
  }

  const legacyRepairs = DEFAULT_QUESTIONS.flatMap((template) => {
    const current = existingByCode.get(template.code);

    if (!current || current.source !== "SYSTEM") {
      return [];
    }

    const shouldRepairFacts =
      jsonFactKeys(current.expectedFactKeys).length === 0;
    const legacyQuestion = legacyDefaultQuestion(
      template.code,
      site,
    );
    const shouldRepairQuestion =
      legacyQuestion !== null &&
      current.question === legacyQuestion;

    if (!shouldRepairFacts && !shouldRepairQuestion) {
      return [];
    }

    return [
      prisma.aiQuestion.update({
        where: { id: current.id },
        data: {
          expectedFactKeys: shouldRepairFacts
            ? (template.expectedFactKeys as unknown as Prisma.InputJsonValue)
            : undefined,
          isRequired: shouldRepairFacts ? true : undefined,
          question: shouldRepairQuestion
            ? template.question(site)
            : undefined,
        },
      }),
    ];
  });

  if (legacyRepairs.length > 0) {
    await Promise.all(legacyRepairs);
  }
}

async function listQuestions(
  siteId: string,
): Promise<PublicAiQuestion[]> {
  const prisma = getDatabase();
  const questions = await prisma.aiQuestion.findMany({
    where: { siteId },
    orderBy: [
      { status: "asc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });

  return questions.map(publicQuestion);
}


function publicJsonLinks(
  value: Prisma.JsonValue | null,
): Array<{ url: string; title: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const links = new Map<
    string,
    { url: string; title: string | null }
  >();

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      continue;
    }

    const record = item as Record<string, unknown>;

    if (typeof record.url !== "string") {
      continue;
    }

    const normalizedUrl = record.url.trim();

    if (!normalizedUrl || links.has(normalizedUrl)) {
      continue;
    }

    links.set(normalizedUrl, {
      url: normalizedUrl,
      title:
        typeof record.title === "string"
          ? record.title
          : null,
    });
  }

  return [...links.values()];
}

export function serviceIdentificationFromEvaluation(
  value: Prisma.JsonValue | null,
  context: {
    hasServiceDefinition?: boolean;
    targetDomainCited?: boolean | null;
    answerText?: string | null;
  } = {},
): boolean | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const factResults = record.factResults;

  if (
    context.targetDomainCited === false &&
    answerExplicitlyDoesNotIdentifyTarget(
      context.answerText,
    )
  ) {
    return false;
  }

  if (!Array.isArray(factResults)) {
    return null;
  }

  const serviceDefinition = factResults.find((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return false;
    }

    return (
      (item as Record<string, unknown>).factKey ===
      "service_definition"
    );
  });

  if (
    serviceDefinition &&
    typeof serviceDefinition === "object" &&
    !Array.isArray(serviceDefinition)
  ) {
    const status = (
      serviceDefinition as Record<string, unknown>
    ).status;

    if (status === "SUPPORTED") {
      return true;
    }

    if (status === "CONTRADICTED") {
      return false;
    }
  }

  const factualAccuracy =
    typeof record.factualAccuracy === "number"
      ? record.factualAccuracy
      : null;

  const hasContradiction = factResults.some((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return false;
    }

    return (
      (item as Record<string, unknown>).status ===
      "CONTRADICTED"
    );
  });

  if (
    context.hasServiceDefinition === true &&
    context.targetDomainCited === false &&
    factualAccuracy !== null &&
    factualAccuracy < 50 &&
    hasContradiction
  ) {
    return false;
  }

  return null;
}

function factDefinitionLabel(factKey: string): string {
  return (
    SITE_FACT_DEFINITIONS.find(
      (definition) => definition.key === factKey,
    )?.label ?? factKey
  );
}

function percentValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null;
}

function publicEvaluationStatus(
  value: unknown,
): PublicFactEvaluationStatus | null {
  return value === "SUPPORTED" ||
    value === "CONTRADICTED" ||
    value === "NOT_MENTIONED" ||
    value === "UNCLEAR"
    ? value
    : null;
}

export function buildPublicFactualEvaluation(
  value: Prisma.JsonValue | null,
  expectedFactsSnapshot: Prisma.JsonValue,
): PublicFactualEvaluation | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary =
    typeof record.summary === "string"
      ? record.summary.trim()
      : "";
  const factualAccuracy = percentValue(record.factualAccuracy);
  const completeness = percentValue(record.completeness);
  const rawResults = Array.isArray(record.factResults)
    ? record.factResults
    : [];
  const expectedFacts =
    expectedFactsSnapshot &&
    typeof expectedFactsSnapshot === "object" &&
    !Array.isArray(expectedFactsSnapshot)
      ? (expectedFactsSnapshot as Record<string, unknown>)
      : {};

  if (
    !summary ||
    factualAccuracy === null ||
    completeness === null
  ) {
    return null;
  }

  const factResults = rawResults.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return [];
    }

    const fact = item as Record<string, unknown>;
    const factKey =
      typeof fact.factKey === "string"
        ? fact.factKey.trim()
        : "";
    const status = publicEvaluationStatus(fact.status);
    const reason =
      typeof fact.reason === "string"
        ? fact.reason.trim()
        : "";

    if (!factKey || !status || !reason) {
      return [];
    }

    const rawExpected = expectedFacts[factKey];
    const expectedValue =
      typeof rawExpected === "string"
        ? rawExpected
        : rawExpected === undefined
          ? null
          : JSON.stringify(rawExpected, null, 2);

    return [{
      factKey,
      label: factDefinitionLabel(factKey),
      status,
      reason,
      expectedValue,
    }];
  });

  return {
    summary,
    factualAccuracy,
    completeness,
    factResults,
  };
}

function percent(
  values: readonly boolean[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return (
    Math.round(
      (values.filter(Boolean).length / values.length) *
        1_000,
    ) / 10
  );
}

async function executionState(
  siteId: string,
  facts: readonly SiteFact[],
  questions: readonly PublicAiQuestion[],
): Promise<PublicDeepDiagnosticExecution> {
  const prisma = getDatabase();
  const requiredKeys = SITE_FACT_DEFINITIONS
    .filter((definition) => definition.important)
    .map((definition) => definition.key);
  const savedKeys = new Set(facts.map((fact) => fact.factKey));
  const activeQuestions = questions
    .filter((question) => question.status === "ACTIVE")
    .slice(0, env.DEEP_DIAGNOSTIC_MAX_QUESTIONS);
  const requiredQuestions = activeQuestions.filter(
    (question) => question.isRequired,
  );
  const blockers: string[] = [];

  if (!env.OPENAI_API_KEY) {
    blockers.push(
      "관리자가 Replit Secrets에 OPENAI_API_KEY를 설정해야 합니다.",
    );
  }

  const missingRequiredFacts = requiredKeys.filter(
    (key) => !savedKeys.has(key),
  );

  if (missingRequiredFacts.length > 0) {
    blockers.push(
      `핵심 기준정보 ${missingRequiredFacts.length}개를 더 저장해 주세요.`,
    );
  }

  if (activeQuestions.length === 0) {
    blockers.push("사용 중인 AI 테스트 질문이 없습니다.");
  }

  const questionsWithoutFacts = activeQuestions.filter(
    (question) =>
      !question.expectedFactKeys.some((key) => savedKeys.has(key)),
  );

  if (questionsWithoutFacts.length > 0) {
    blockers.push(
      `사용 중인 질문 ${questionsWithoutFacts.length}개에 저장된 기준정보가 연결되어 있지 않습니다.`,
    );
  }

  const activeScan = await prisma.scan.findFirst({
    where: {
      siteId,
      status: {
        in: ["QUEUED", "RUNNING"],
      },
    },
    select: { id: true },
  });

  if (activeScan) {
    blockers.push(
      "이 사이트에서 이미 대기 중이거나 실행 중인 검사가 있습니다.",
    );
  }

  const latest = await prisma.scan.findFirst({
    where: {
      siteId,
      type: "DEEP",
    },
    orderBy: { createdAt: "desc" },
    include: {
      aiAnswerSummary: true,
      aiAnswerRuns: {
        orderBy: [
          { questionCode: "asc" },
          { runNumber: "asc" },
        ],
      },
    },
  });

  const latestRunMetrics =
    latest?.aiAnswerRuns.map((run) => {
      const evaluation = buildPublicFactualEvaluation(
        run.factualEvaluationJson,
        run.expectedFactsSnapshot,
      );
      const hasServiceDefinition = Boolean(
        run.expectedFactsSnapshot &&
          typeof run.expectedFactsSnapshot === "object" &&
          !Array.isArray(run.expectedFactsSnapshot) &&
          Object.prototype.hasOwnProperty.call(
            run.expectedFactsSnapshot,
            "service_definition",
          ),
      );
      const serviceIdentified =
        serviceIdentificationFromEvaluation(
          run.factualEvaluationJson,
          {
            hasServiceDefinition,
            targetDomainCited: run.targetDomainCited,
            answerText: run.answerText,
          },
        );

      return {
        questionCode: run.questionCode,
        status: run.status,
        brandMentioned: run.brandMentioned,
        serviceIdentified,
        targetDomainCited: run.targetDomainCited,
        factualAccuracy:
          serviceIdentified === true
            ? evaluation?.factualAccuracy ?? null
            : null,
        completeness:
          serviceIdentified === true
            ? evaluation?.completeness ?? null
            : null,
        supportedFactCount:
          serviceIdentified === true
            ? evaluation?.factResults.filter(
                (item) => item.status === "SUPPORTED",
              ).length ?? 0
            : 0,
        contradictedFactCount:
          serviceIdentified === true
            ? evaluation?.factResults.filter(
                (item) => item.status === "CONTRADICTED",
              ).length ?? 0
            : 0,
        consistencySignature:
          serviceIdentified === true
            ? run.consistencySignature
            : null,
      };
    }) ?? [];

  const currentPerformance =
    calculateAnswerPerformance(latestRunMetrics);

  return {
    apiConfigured: Boolean(env.OPENAI_API_KEY),
    provider: "OPENAI",
    model: env.OPENAI_WEB_SEARCH_MODEL,
    evaluationModel: env.OPENAI_EVALUATION_MODEL,
    runsPerQuestion: env.DEEP_DIAGNOSTIC_RUNS_PER_QUESTION,
    maxQuestions: env.DEEP_DIAGNOSTIC_MAX_QUESTIONS,
    activeQuestionCount: activeQuestions.length,
    plannedAnswerRuns:
      activeQuestions.length *
      env.DEEP_DIAGNOSTIC_RUNS_PER_QUESTION,
    plannedApiCalls:
      activeQuestions.length *
      env.DEEP_DIAGNOSTIC_RUNS_PER_QUESTION *
      2,
    requiredFactCount: requiredKeys.length,
    savedRequiredFactCount:
      requiredKeys.length - missingRequiredFacts.length,
    canStart: blockers.length === 0,
    blockers,
    latestScan: latest
      ? {
          id: latest.id,
          status: latest.status,
          score: latest.score,
          grade: latest.grade,
          errorCode: latest.errorCode,
          createdAt: latest.createdAt.toISOString(),
          startedAt: latest.startedAt?.toISOString() ?? null,
          completedAt: latest.completedAt?.toISOString() ?? null,
        }
      : null,
    summary: latest?.aiAnswerSummary
      ? {
          provider: latest.aiAnswerSummary.provider,
          model: latest.aiAnswerSummary.model,
          methodologyVersion:
            currentPerformance.methodologyVersion,
          plannedQuestionCount:
            currentPerformance.plannedQuestionCount,
          completedQuestionCount:
            currentPerformance.completedQuestionCount,
          totalRunCount:
            currentPerformance.totalRunCount,
          completedRunCount:
            currentPerformance.completedRunCount,
          partialRunCount:
            currentPerformance.partialRunCount,
          failedRunCount:
            currentPerformance.failedRunCount,
          answerCompletionRate:
            currentPerformance.answerCompletionRate,
          brandMentionRate:
            currentPerformance.brandMentionRate,
          targetCitationRate:
            currentPerformance.targetCitationRate,
          factualAccuracy:
            currentPerformance.factualAccuracy,
          completeness:
            currentPerformance.completeness,
          consistency:
            currentPerformance.consistency,
          performanceScore:
            currentPerformance.performanceScore,
          scoreCoverage:
            currentPerformance.scoreCoverage,
          serviceIdentificationRate:
            currentPerformance.serviceIdentificationRate,
        }
      : null,
    runs:
      latest?.aiAnswerRuns.map((run) => ({
        id: run.id,
        questionCode: run.questionCode,
        questionKind: run.questionKind,
        questionText: run.questionText,
        runNumber: run.runNumber,
        status: run.status,
        answerText: run.answerText,
        brandMentioned: run.brandMentioned,
        targetDomainCited: run.targetDomainCited,
        citations: publicJsonLinks(run.citationsJson),
        sources: publicJsonLinks(run.sourcesJson),
        factualEvaluation:
          serviceIdentificationFromEvaluation(
            run.factualEvaluationJson,
            {
              hasServiceDefinition: Boolean(
                run.expectedFactsSnapshot &&
                  typeof run.expectedFactsSnapshot === "object" &&
                  !Array.isArray(run.expectedFactsSnapshot) &&
                  Object.prototype.hasOwnProperty.call(
                    run.expectedFactsSnapshot,
                    "service_definition",
                  ),
              ),
              targetDomainCited: run.targetDomainCited,
              answerText: run.answerText,
            },
          ) === true
            ? buildPublicFactualEvaluation(
                run.factualEvaluationJson,
                run.expectedFactsSnapshot,
              )
            : null,
        expectedFactKeys:
          run.expectedFactsSnapshot &&
          typeof run.expectedFactsSnapshot === "object" &&
          !Array.isArray(run.expectedFactsSnapshot)
            ? Object.keys(
                run.expectedFactsSnapshot as Record<string, unknown>,
              )
            : [],
        expectedFactCount:
          run.expectedFactsSnapshot &&
          typeof run.expectedFactsSnapshot === "object" &&
          !Array.isArray(run.expectedFactsSnapshot)
            ? Object.keys(
                run.expectedFactsSnapshot as Record<string, unknown>,
              ).length
            : 0,
        serviceIdentified:
          serviceIdentificationFromEvaluation(
            run.factualEvaluationJson,
            {
              hasServiceDefinition: Boolean(
                run.expectedFactsSnapshot &&
                  typeof run.expectedFactsSnapshot === "object" &&
                  !Array.isArray(run.expectedFactsSnapshot) &&
                  Object.prototype.hasOwnProperty.call(
                    run.expectedFactsSnapshot,
                    "service_definition",
                  ),
              ),
              targetDomainCited: run.targetDomainCited,
              answerText: run.answerText,
            },
          ),
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        completedAt: run.completedAt?.toISOString() ?? null,
      })) ?? [],
  };
}

export function createPrismaDeepDiagnosticAdminService(): DeepDiagnosticAdminService {
  return {
    async getSetup(user, siteId) {
      const prisma = getDatabase();
      const site = await findAccessibleSite(user.id, siteId);
      await ensureDefaultsForSite(site);

      const [facts, questions] = await Promise.all([
        prisma.siteFact.findMany({
          where: {
            siteId,
            factKey: {
              in: [...SITE_FACT_KEYS],
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        listQuestions(siteId),
      ]);

      return {
        site,
        factDefinitions: SITE_FACT_DEFINITIONS,
        facts: facts.map(publicFact),
        questions,
        execution: await executionState(
          siteId,
          facts,
          questions,
        ),
      };
    },

    async saveFact(user, siteId, factKey, value) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);

      if (!isSiteFactKey(factKey)) {
        throw new DeepDiagnosticAdminServiceError(
          "FACT_KEY_NOT_ALLOWED",
          "지원하지 않는 기준정보 항목입니다.",
          400,
        );
      }

      const normalized = normalizeMultiline(value);
      const fact = await prisma.siteFact.upsert({
        where: {
          siteId_factKey: {
            siteId,
            factKey,
          },
        },
        create: {
          siteId,
          factKey,
          expectedValue: normalized,
          source: "USER",
        },
        update: {
          expectedValue: normalized,
          source: "USER",
        },
      });

      return publicFact(fact);
    },

    async deleteFact(user, siteId, factKey) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);

      if (!isSiteFactKey(factKey)) {
        throw new DeepDiagnosticAdminServiceError(
          "FACT_KEY_NOT_ALLOWED",
          "지원하지 않는 기준정보 항목입니다.",
          400,
        );
      }

      await prisma.siteFact.deleteMany({
        where: {
          siteId,
          factKey,
        },
      });
    },

    async ensureDefaultQuestions(user, siteId) {
      const site = await findAccessibleSite(user.id, siteId);
      await ensureDefaultsForSite(site);
      return listQuestions(siteId);
    },

    async createQuestion(user, siteId, input) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);

      const last = await prisma.aiQuestion.findFirst({
        where: { siteId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const question = await prisma.aiQuestion.create({
        data: {
          siteId,
          code: `USER-${randomUUID()
            .replace(/-/g, "")
            .slice(0, 12)
            .toUpperCase()}`,
          kind: input.kind,
          source: "USER",
          status: "ACTIVE",
          question: normalizeMultiline(input.question),
          expectedFactKeys:
            input.expectedFactKeys as unknown as Prisma.InputJsonValue,
          isRequired: input.isRequired,
          sortOrder: (last?.sortOrder ?? 0) + 10,
        },
      });

      return publicQuestion(question);
    },

    async updateQuestion(user, siteId, questionId, input) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);

      const current = await prisma.aiQuestion.findFirst({
        where: {
          id: questionId,
          siteId,
        },
        select: { id: true },
      });

      if (!current) {
        throw new DeepDiagnosticAdminServiceError(
          "QUESTION_NOT_FOUND",
          "AI 테스트 질문을 찾을 수 없습니다.",
          404,
        );
      }

      const question = await prisma.aiQuestion.update({
        where: { id: current.id },
        data: {
          kind: input.kind,
          question:
            input.question === undefined
              ? undefined
              : normalizeMultiline(input.question),
          expectedFactKeys:
            input.expectedFactKeys === undefined
              ? undefined
              : (input.expectedFactKeys as unknown as Prisma.InputJsonValue),
          isRequired: input.isRequired,
          status: input.status,
        },
      });

      return publicQuestion(question);
    },

    async startDiagnostic(user, siteId) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);
      const facts = await prisma.siteFact.findMany({
        where: {
          siteId,
          factKey: {
            in: [...SITE_FACT_KEYS],
          },
        },
      });
      const questions = await listQuestions(siteId);
      const execution = await executionState(
        siteId,
        facts,
        questions,
      );

      if (!execution.apiConfigured) {
        throw new DeepDiagnosticAdminServiceError(
          "OPENAI_NOT_CONFIGURED",
          "OpenAI API 연결이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.",
          503,
        );
      }

      if (!execution.canStart) {
        throw new DeepDiagnosticAdminServiceError(
          execution.blockers.some((blocker) =>
            blocker.includes("이미 대기 중"),
          )
            ? "SCAN_ALREADY_RUNNING"
            : "DEEP_NOT_READY",
          execution.blockers[0] ??
            "정밀진단 준비 정보를 확인해 주세요.",
          409,
        );
      }

      const scan = await prisma.scan.create({
        data: {
          siteId,
          type: "DEEP",
          status: "QUEUED",
          rulesVersion: CURRENT_RULES_VERSION,
          createdBy: user.id,
        },
      });

      return {
        id: scan.id,
        status: scan.status,
        score: scan.score,
        grade: scan.grade,
        errorCode: scan.errorCode,
        createdAt: scan.createdAt.toISOString(),
        startedAt: scan.startedAt?.toISOString() ?? null,
        completedAt: scan.completedAt?.toISOString() ?? null,
      };
    },
  };
}
