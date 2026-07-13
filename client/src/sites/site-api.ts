import { withDevUserPreviewQuery } from "../auth/dev-user-preview";

export interface SiteScan {
  id: string;
  siteId: string;
  type: "QUICK" | "DEEP" | "VERIFICATION" | "MONITORING";
  status:
    "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  rulesVersion: string;
  isOutdatedRulesVersion: boolean;
  linkedWorkOrderId: string | null;
  verificationWorkOrderId: string | null;
  locale: "ko" | "en";
  score: number | null;
  grade: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface SiteDiagnosticProgress {
  diagnosticNumber: number;
  sourceWorkOrderVersion: number;
  source: "WORK_ORDER_INITIAL" | "WORK_ORDER_VERIFICATION";
  scanId: string;
  scanType: string;
  status: string;
  score: number | null;
  grade: string | null;
  rulesVersion: string;
  targetUrl: string | null;
  completedAt: string | null;
  createdAt: string;
  reportAvailable: boolean;
  verificationAttemptId: string | null;
  verificationStatus: string | null;
}

export interface SiteWorkOrderProgress {
  id: string;
  orderNumber: string;
  version: number;
  status: string;
  rulesVersion: string;
  issuedAt: string | null;
  createdAt: string;
  itemCount: number;
  requiredItemCount: number;
  latestVerificationAttemptId: string | null;
  latestVerificationStatus: string | null;
}

export type SiteProgressStageKind =
  | "REGISTERED"
  | "QUICK_SCAN"
  | "INITIAL_PAYMENT"
  | "DIAGNOSTIC"
  | "WORK_ORDER"
  | "EXTRA_PAYMENT"
  | "COMPLETED";

export type SiteProgressNextAction =
  | "START_QUICK_SCAN"
  | "WAIT"
  | "PURCHASE_INITIAL"
  | "VIEW_WORK_ORDER"
  | "CREATE_NEXT_WORK_ORDER"
  | "PURCHASE_EXTRA"
  | "NONE";

export interface SiteProgress {
  payment: {
    initialPaid: boolean;
    extraPaid: boolean;
  };
  diagnostics: SiteDiagnosticProgress[];
  workOrders: SiteWorkOrderProgress[];
  latestDiagnosticNumber: number | null;
  latestWorkOrderVersion: number | null;
  currentStage: {
    kind: SiteProgressStageKind;
    number: number | null;
    status: string;
    nextAction: SiteProgressNextAction;
  };
}

export interface RegisteredSite {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  baseUrl: string;
  finalUrl: string | null;
  siteType: string | null;
  description: string | null;
  country: string;
  region: string | null;
  primaryLocale: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  latestScan: SiteScan | null;
  progress?: SiteProgress;
}

export interface CreateSiteRequest {
  name: string;
  baseUrl: string;
  description?: string;
  siteType?: string;
  country?: string;
  region?: string;
  primaryLocale?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  baseUrl?: string;
  description?: string | null;
  siteType?: string | null;
  country?: string;
  region?: string | null;
  primaryLocale?: string;
}

interface ErrorResponse {
  code?: string;
  message?: string;
}

export class SiteApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SiteApiError";
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

  throw new SiteApiError(
    error.code ?? "REQUEST_FAILED",
    error.message ?? "요청을 처리하지 못했습니다.",
    response.status,
  );
}

export async function listSitesRequest(): Promise<RegisteredSite[]> {
  const response = await fetch("/api/sites", {
    credentials: "same-origin",
  });
  const data = await readJson<{ sites: RegisteredSite[] }>(response);
  return data.sites;
}

export async function createSiteRequest(
  input: CreateSiteRequest,
): Promise<RegisteredSite> {
  const response = await fetch("/api/sites", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ site: RegisteredSite }>(response);
  return data.site;
}

export async function updateSiteRequest(
  siteId: string,
  input: UpdateSiteRequest,
): Promise<RegisteredSite> {
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ site: RegisteredSite }>(response);
  return data.site;
}

export async function archiveSiteRequest(siteId: string): Promise<void> {
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    await readJson<never>(response);
  }
}

export async function queueSiteScanRequest(
  siteId: string,
  type: "QUICK" | "DEEP" = "QUICK",
  locale: "ko" | "en" = "ko",
): Promise<SiteScan> {
  const response = await fetch(
    `/api/sites/${encodeURIComponent(siteId)}/scans`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    },
  );
  const data = await readJson<{ scan: SiteScan }>(response);
  return data.scan;
}

export async function listSiteScansRequest(
  siteId: string,
): Promise<SiteScan[]> {
  const response = await fetch(
    `/api/sites/${encodeURIComponent(siteId)}/scans`,
    {
      credentials: "same-origin",
    },
  );
  const data = await readJson<{ scans: SiteScan[] }>(response);
  return data.scans;
}

export type ScanSummaryGroup = "TECHNICAL" | "CONTENT" | "TRUST";
export type ScanFindingStatus = "PASS" | "FAIL" | "BLOCKED" | "NA";
export type ScanFindingSeverity =
  "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ScanResultFinding {
  id: string;
  ruleCode: string;
  category: string;
  severity: ScanFindingSeverity;
  status: ScanFindingStatus;
  title: string;
  description: string;
  evidence: unknown;
  recommendation: string | null;
  scoreDelta: number;
  weight: number;
}

export interface ScanCategoryScore {
  category: string;
  score: number;
  pendingScore?: number;
  maxScore: number;
  percentage: number;
}

export interface ScanScoreSummary {
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
  categories: ScanCategoryScore[];
}

export type ContentReadinessStatus = "NEEDS_WORK" | "PARTIAL" | "BASIC_READY";

export interface ContentReadinessTopic {
  code: string;
  title: string;
  status: "PARTIAL" | "REVIEW_REQUIRED";
  reason: string;
  questions: string[];
  suggestedSections: string[];
  contentWriterInstruction: string;
  developerInstruction: string;
  acceptanceCriteria: string[];
}

export interface ContentReadinessAssessment {
  status: ContentReadinessStatus;
  label: string;
  summary: string;
  confirmedSignals: string[];
  topics: ContentReadinessTopic[];
  benchmarkNote: string;
  disclaimer: string;
}

export interface ScanResultResponse {
  site: {
    id: string;
    name: string;
    baseUrl: string;
    finalUrl: string | null;
    siteType: string | null;
    country: string;
    region: string | null;
    primaryLocale: string;
  };
  scan: {
    id: string;
    type: string;
    diagnosticNumber: number;
    status: string;
    rulesVersion: string;
    score: number | null;
    grade: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorCode: string | null;
    createdAt: string;
  };
  paidFeatureAccess: boolean;
  scoreSummary: ScanScoreSummary | null;
  currentRulesVersion: string;
  isOutdatedRulesVersion: boolean;
  contentReadiness?: ContentReadinessAssessment;
  understandingSummary: string;
  foundInformation: Array<{
    label: string;
    value: string;
  }>;
  missingInformation: Array<{
    ruleCode: string;
    summaryGroup: ScanSummaryGroup;
    title: string;
  }>;
  primaryIssues: ScanResultFinding[];
  pages: Array<{
    id: string;
    url: string;
    statusCode: number | null;
    finalUrl: string | null;
    contentType: string | null;
    rawHtmlHash: string | null;
    initialTextLength: number | null;
    iframeCount: number | null;
  }>;
  findings: ScanResultFinding[];
}

export async function getScanResultRequest(
  scanId: string,
): Promise<ScanResultResponse> {
  const response = await fetch(
    `/api/scan-results/${encodeURIComponent(scanId)}`,
    {
      credentials: "same-origin",
    },
  );
  const data = await readJson<{ result: ScanResultResponse }>(response);
  return data.result;
}

export function scanResultPdfUrl(scanId: string, locale?: "ko" | "en"): string {
  const baseUrl = `/api/scan-results/${encodeURIComponent(scanId)}/export.pdf`;

  const localizedUrl = locale === "en" ? `${baseUrl}?locale=en` : baseUrl;
  return withDevUserPreviewQuery(localizedUrl);
}
