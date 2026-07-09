interface ErrorResponse {
  code?: string;
  message?: string;
}

export class WorkOrderApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorkOrderApiError";
  }
}

export interface WorkOrderCriterion {
  code: string;
  label: string;
  required: boolean;
}

export interface WorkOrderItem {
  id: string;
  findingId: string | null;
  itemCode: string;
  targetUrl: string;
  title: string;
  requirement: string;
  developerMessage: string;
  acceptanceCriteria: WorkOrderCriterion[];
  isRequired: boolean;
  weight: number;
  status: string;
  finding: {
    ruleCode: string;
    category: string;
    severity: string;
    status: string;
    description: string;
    evidence: unknown;
    recommendation: string | null;
  } | null;
}

export interface VerificationCriterionResult {
  code: string;
  label: string;
  required: boolean;
  status: string;
  automated: boolean;
  message: string;
}

export interface VerificationItemResult {
  id: string;
  workOrderItemId: string;
  status: string;
  criteriaResults: VerificationCriterionResult[];
  evidence: unknown;
  message: string | null;
  createdAt: string;
}

export interface VerificationAttempt {
  id: string;
  attemptNumber: number;
  submittedUrl: string;
  status: string;
  scoreAfter: number | null;
  gradeAfter: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
  scan: {
    id: string;
    type: string;
    status: string;
    targetUrl: string | null;
    score: number | null;
    grade: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorCode: string | null;
  };
  itemResults: VerificationItemResult[];
}

export interface WorkOrderVersionHistoryEntry {
  id: string;
  version: number;
  scoreBefore: number | null;
  gradeBefore: string | null;
  initialScan: {
    id: string;
    score: number | null;
    grade: string | null;
    rulesVersion: string;
    targetUrl: string | null;
    completedAt: string | null;
  };
}

export interface WorkOrderDetail {
  id: string;
  orderNumber: string;
  version: number;
  status: string;
  rulesVersion: string;
  scoreBefore: number | null;
  gradeBefore: string | null;
  expectedScoreMin: number;
  expectedScoreMax: number;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  site: {
    id: string;
    name: string;
    baseUrl: string;
    finalUrl: string | null;
  };
  initialScan: {
    id: string;
    score: number | null;
    grade: string | null;
    rulesVersion: string;
    targetUrl: string | null;
    completedAt: string | null;
  };
  customerOrganization: {
    id: string;
    name: string;
  };
  agencyOrganization: {
    id: string;
    name: string;
  } | null;
  items: WorkOrderItem[];
  verificationAttempts: VerificationAttempt[];
  versionHistory: WorkOrderVersionHistoryEntry[];
}

export interface WorkOrderSummary {
  id: string;
  orderNumber: string;
  version: number;
  status: string;
  scoreBefore: number | null;
  expectedScoreMin: number;
  expectedScoreMax: number;
  createdAt: string;
  issuedAt: string | null;
  itemCount: number;
  site: {
    id: string;
    name: string;
  };
  initialScan: {
    id: string;
  };
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

  throw new WorkOrderApiError(
    error.code ?? "REQUEST_FAILED",
    error.message ?? "요청을 처리하지 못했습니다.",
    response.status,
  );
}

export async function listWorkOrdersRequest(): Promise<WorkOrderSummary[]> {
  const response = await fetch("/api/work-orders", {
    credentials: "same-origin",
  });
  const data = await readJson<{
    workOrders: WorkOrderSummary[];
  }>(response);
  return data.workOrders;
}

export async function createWorkOrderRequest(input: {
  scanId: string;
  findingIds: string[];
  renderedImprovementCodes: string[];
  locale?: "ko" | "en";
}): Promise<WorkOrderDetail> {
  const response = await fetch("/api/work-orders", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function getLatestWorkOrderByScanRequest(
  scanId: string,
): Promise<WorkOrderDetail> {
  const response = await fetch(
    `/api/work-orders/by-scan/${encodeURIComponent(scanId)}`,
    {
      credentials: "same-origin",
    },
  );
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function getWorkOrderRequest(
  workOrderId: string,
): Promise<WorkOrderDetail> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(workOrderId)}`,
    {
      credentials: "same-origin",
    },
  );
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function issueWorkOrderRequest(
  workOrderId: string,
): Promise<WorkOrderDetail> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(workOrderId)}/issue`,
    {
      method: "POST",
      credentials: "same-origin",
    },
  );
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function submitVerificationRequest(
  workOrderId: string,
  submittedUrl: string,
): Promise<WorkOrderDetail> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(workOrderId)}/verifications`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submittedUrl }),
    },
  );
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function reviseWorkOrderRequest(
  workOrderId: string,
): Promise<WorkOrderDetail> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(workOrderId)}/revise`,
    {
      method: "POST",
      credentials: "same-origin",
    },
  );
  const data = await readJson<{
    workOrder: WorkOrderDetail;
  }>(response);
  return data.workOrder;
}

export async function cancelWorkOrderRequest(
  workOrderId: string,
): Promise<void> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(workOrderId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
    },
  );

  if (!response.ok) {
    await readJson<never>(response);
  }
}

export function workOrderExportUrl(
  workOrderId: string,
  format: "json" | "csv" | "pdf",
): string {
  return `/api/work-orders/${encodeURIComponent(workOrderId)}/export.${format}`;
}
