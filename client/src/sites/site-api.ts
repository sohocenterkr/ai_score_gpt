export interface SiteScan {
  id: string;
  siteId: string;
  type: "QUICK" | "DEEP" | "VERIFICATION" | "MONITORING";
  status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "PARTIAL"
    | "FAILED"
    | "CANCELLED";
  rulesVersion: string;
  score: number | null;
  grade: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface RegisteredSite {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  baseUrl: string;
  finalUrl: string | null;
  siteType: string | null;
  country: string;
  region: string | null;
  primaryLocale: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  latestScan: SiteScan | null;
}

export interface CreateSiteRequest {
  name: string;
  baseUrl: string;
  siteType?: string;
  country: string;
  region?: string;
  primaryLocale: string;
}

export interface UpdateSiteRequest {
  name?: string;
  baseUrl?: string;
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

export type ScanFindingStatus = "PASS" | "FAIL" | "BLOCKED" | "NA";
export type ScanFindingSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

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
  maxScore: number;
  percentage: number;
}

export interface ScanScoreSummary {
  score: number;
  rawScore: number;
  grade: string;
  cap: number | null;
  coverage: number;
  lostPoints: number;
  expectedImprovementMin: number;
  expectedImprovementMax: number;
  categories: ScanCategoryScore[];
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
    status: string;
    rulesVersion: string;
    score: number | null;
    grade: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorCode: string | null;
    createdAt: string;
  };
  scoreSummary: ScanScoreSummary | null;
  understandingSummary: string;
  foundInformation: Array<{
    label: string;
    value: string;
  }>;
  missingInformation: Array<{
    ruleCode: string;
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
  const data = await readJson<{ result: ScanResultResponse }>(
    response,
  );
  return data.result;
}
