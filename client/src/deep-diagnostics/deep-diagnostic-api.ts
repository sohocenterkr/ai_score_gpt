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

export type AiQuestionKind =
  | "BRAND"
  | "DISCOVERY"
  | "FEATURE"
  | "USE_CASE"
  | "TRUST"
  | "COMPARISON"
  | "CUSTOM";

export interface SiteFactDefinition {
  key: SiteFactKey;
  label: string;
  help: string;
  placeholder: string;
  important: boolean;
}

export interface DeepDiagnosticFact {
  id: string;
  factKey: SiteFactKey;
  value: string;
  source: "USER" | "IMPORTED";
  createdAt: string;
  updatedAt: string;
}

export interface DeepDiagnosticQuestion {
  id: string;
  siteId: string;
  code: string;
  kind: AiQuestionKind;
  source: "SYSTEM" | "USER" | "GENERATED";
  status: "ACTIVE" | "ARCHIVED";
  question: string;
  expectedFactKeys: SiteFactKey[];
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeepDiagnosticScan {
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

export interface DeepAnswerSummary {
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

export type FactEvaluationStatus =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "NOT_MENTIONED"
  | "UNCLEAR";

export interface DeepFactEvaluationItem {
  factKey: string;
  label: string;
  status: FactEvaluationStatus;
  reason: string;
  expectedValue: string | null;
}

export interface DeepFactualEvaluation {
  summary: string;
  factualAccuracy: number;
  completeness: number;
  factResults: DeepFactEvaluationItem[];
}

export interface DeepAnswerRun {
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
  factualEvaluation: DeepFactualEvaluation | null;
  expectedFactKeys: string[];
  expectedFactCount: number;
  serviceIdentified: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: string | null;
}

export interface DeepDiagnosticExecution {
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
  latestScan: DeepDiagnosticScan | null;
  summary: DeepAnswerSummary | null;
  runs: DeepAnswerRun[];
}

export interface DeepDiagnosticSetup {
  site: {
    id: string;
    name: string;
    baseUrl: string;
    siteType: string | null;
    primaryLocale: string;
  };
  factDefinitions: SiteFactDefinition[];
  facts: DeepDiagnosticFact[];
  questions: DeepDiagnosticQuestion[];
  execution: DeepDiagnosticExecution;
}

interface ErrorResponse {
  code?: string;
  message?: string;
}

export class DeepDiagnosticApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DeepDiagnosticApiError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let error: ErrorResponse = {};

  try {
    error = (await response.json()) as ErrorResponse;
  } catch {
    error = {};
  }

  throw new DeepDiagnosticApiError(
    error.code ?? "REQUEST_FAILED",
    error.message ?? "요청을 처리하지 못했습니다.",
    response.status,
  );
}

function sitePath(siteId: string): string {
  return `/api/deep-diagnostics/sites/${encodeURIComponent(siteId)}`;
}

export async function getDeepDiagnosticSetup(
  siteId: string,
): Promise<DeepDiagnosticSetup> {
  const response = await fetch(`${sitePath(siteId)}/setup`, {
    credentials: "same-origin",
  });
  const data = await readJson<{ setup: DeepDiagnosticSetup }>(response);
  return data.setup;
}

export async function saveDeepDiagnosticFact(
  siteId: string,
  factKey: SiteFactKey,
  value: string,
): Promise<DeepDiagnosticFact> {
  const response = await fetch(
    `${sitePath(siteId)}/facts/${encodeURIComponent(factKey)}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    },
  );
  const data = await readJson<{ fact: DeepDiagnosticFact }>(response);
  return data.fact;
}

export async function deleteDeepDiagnosticFact(
  siteId: string,
  factKey: SiteFactKey,
): Promise<void> {
  const response = await fetch(
    `${sitePath(siteId)}/facts/${encodeURIComponent(factKey)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
    },
  );

  if (!response.ok) {
    await readJson<never>(response);
  }
}

export async function restoreDefaultQuestions(
  siteId: string,
): Promise<DeepDiagnosticQuestion[]> {
  const response = await fetch(
    `${sitePath(siteId)}/questions/defaults`,
    {
      method: "POST",
      credentials: "same-origin",
    },
  );
  const data = await readJson<{
    questions: DeepDiagnosticQuestion[];
  }>(response);
  return data.questions;
}

export async function createDeepDiagnosticQuestion(
  siteId: string,
  input: {
    kind: AiQuestionKind;
    question: string;
    expectedFactKeys: SiteFactKey[];
    isRequired: boolean;
  },
): Promise<DeepDiagnosticQuestion> {
  const response = await fetch(`${sitePath(siteId)}/questions`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{
    question: DeepDiagnosticQuestion;
  }>(response);
  return data.question;
}

export async function updateDeepDiagnosticQuestion(
  siteId: string,
  questionId: string,
  input: {
    kind?: AiQuestionKind;
    question?: string;
    expectedFactKeys?: SiteFactKey[];
    isRequired?: boolean;
    status?: "ACTIVE" | "ARCHIVED";
  },
): Promise<DeepDiagnosticQuestion> {
  const response = await fetch(
    `${sitePath(siteId)}/questions/${encodeURIComponent(questionId)}`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const data = await readJson<{
    question: DeepDiagnosticQuestion;
  }>(response);
  return data.question;
}


export async function startDeepDiagnostic(
  siteId: string,
): Promise<DeepDiagnosticScan> {
  const response = await fetch(`${sitePath(siteId)}/runs`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await readJson<{ scan: DeepDiagnosticScan }>(response);
  return data.scan;
}
