import { describe, expect, it } from "vitest";
import {
  buildSiteProgress,
  type PublicScan,
  type SiteProgressSource,
} from "./site-service";

function scan(overrides: Partial<PublicScan> = {}): PublicScan {
  return {
    id: "scan-1",
    siteId: "site-1",
    type: "QUICK",
    status: "COMPLETED",
    rulesVersion: "2026.07-core-v5",
    isOutdatedRulesVersion: false,
    linkedWorkOrderId: null,
    verificationWorkOrderId: null,
    locale: "ko",
    score: 96,
    grade: "A+",
    startedAt: "2026-07-10T09:00:00.000Z",
    completedAt: "2026-07-10T09:01:00.000Z",
    errorCode: null,
    createdAt: "2026-07-10T09:00:00.000Z",
    ...overrides,
  };
}

function recordScan(
  id: string,
  type: "QUICK" | "VERIFICATION",
  score: number | null,
  completedAt: Date | null,
) {
  return {
    id,
    type,
    status: completedAt ? ("COMPLETED" as const) : ("RUNNING" as const),
    rulesVersion: "2026.07-core-v5",
    score,
    grade: score === null ? null : "A+",
    targetUrl: "https://example.com/",
    completedAt,
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
  };
}

function workOrder(
  version: number,
  attemptStatus?:
    | "QUEUED"
    | "RUNNING"
    | "EVALUATING"
    | "PASSED"
    | "REWORK_REQUIRED"
    | "FAILED",
) {
  const completed =
    attemptStatus === "PASSED" || attemptStatus === "REWORK_REQUIRED";

  return {
    id: `work-order-${version}`,
    orderNumber: "WO-20260710-17439",
    version,
    status: attemptStatus ? ("PASSED" as const) : ("ISSUED" as const),
    rulesVersion: "2026.07-core-v5",
    issuedAt: new Date("2026-07-10T09:05:00.000Z"),
    createdAt: new Date("2026-07-10T09:04:00.000Z"),
    initialScan: recordScan(
      `diagnostic-${version}`,
      version === 1 ? "QUICK" : "VERIFICATION",
      95 + version,
      new Date("2026-07-10T09:01:00.000Z"),
    ),
    items: [{ isRequired: true }, { isRequired: false }],
    verificationAttempts: attemptStatus
      ? [
          {
            id: `attempt-${version}`,
            attemptNumber: 1,
            status: attemptStatus,
            scoreAfter: completed ? 97 + version : null,
            gradeAfter: completed ? "A+" : null,
            completedAt: completed
              ? new Date("2026-07-10T10:00:00.000Z")
              : null,
            createdAt: new Date("2026-07-10T09:30:00.000Z"),
            scan: recordScan(
              `diagnostic-${version + 1}`,
              "VERIFICATION",
              completed ? 97 + version : null,
              completed ? new Date("2026-07-10T10:00:00.000Z") : null,
            ),
          },
        ]
      : [],
  };
}

function progress(overrides: Partial<SiteProgressSource> = {}) {
  return buildSiteProgress({
    latestScan: null,
    workOrders: [],
    paidPlans: [],
    ...overrides,
  });
}

describe("site progress summary", () => {
  it("등록 직후에는 무료 간편진단을 다음 단계로 표시한다", () => {
    const result = progress();

    expect(result.currentStage).toEqual({
      kind: "REGISTERED",
      number: null,
      status: "READY",
      nextAction: "START_QUICK_SCAN",
    });
  });

  it("무료 간편진단 완료 후에는 최초 결제를 다음 단계로 표시한다", () => {
    const result = progress({
      latestScan: scan(),
    });

    expect(result.currentStage).toMatchObject({
      kind: "INITIAL_PAYMENT",
      number: 1,
      status: "REQUIRED",
      nextAction: "PURCHASE_INITIAL",
    });
  });

  it("최초 결제와 1차 작업지시서가 있으면 1차 진단과 작업지시서를 집계한다", () => {
    const result = progress({
      latestScan: scan(),
      paidPlans: ["BASIC"],
      workOrders: [workOrder(1)],
    });

    expect(result.payment.initialPaid).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      diagnosticNumber: 1,
      scanId: "diagnostic-1",
      reportAvailable: true,
    });
    expect(result.workOrders[0]).toMatchObject({
      version: 1,
      itemCount: 2,
      requiredItemCount: 1,
    });
    expect(result.currentStage).toMatchObject({
      kind: "WORK_ORDER",
      number: 1,
      nextAction: "VIEW_WORK_ORDER",
    });
  });

  it("1차 수정 후 재진단에 보완 항목이 남으면 2차 작업지시서 발행 대기로 표시한다", () => {
    const result = progress({
      latestScan: scan({ type: "VERIFICATION" }),
      paidPlans: ["BASIC"],
      workOrders: [workOrder(1, "REWORK_REQUIRED")],
    });

    expect(result.diagnostics.map((item) => item.diagnosticNumber)).toEqual([
      1, 2,
    ]);
    expect(result.currentStage).toEqual({
      kind: "WORK_ORDER",
      number: 2,
      status: "PENDING",
      nextAction: "CREATE_NEXT_WORK_ORDER",
    });
  });

  it("3차 진단 후 보완 항목이 남으면 추가 결제를 다음 단계로 표시한다", () => {
    const result = progress({
      latestScan: scan({ type: "VERIFICATION" }),
      paidPlans: ["BASIC"],
      workOrders: [
        workOrder(1, "REWORK_REQUIRED"),
        workOrder(2, "REWORK_REQUIRED"),
      ],
    });

    expect(result.latestDiagnosticNumber).toBe(3);
    expect(result.currentStage).toEqual({
      kind: "EXTRA_PAYMENT",
      number: 3,
      status: "REQUIRED",
      nextAction: "PURCHASE_EXTRA",
    });
  });

  it("추가 결제 후 3차 작업지시서 검수를 통과하면 4차 진단 완료로 표시한다", () => {
    const result = progress({
      latestScan: scan({ type: "VERIFICATION" }),
      paidPlans: ["BASIC", "EXTRA_VERIFICATION"],
      workOrders: [
        workOrder(1, "REWORK_REQUIRED"),
        workOrder(2, "REWORK_REQUIRED"),
        workOrder(3, "PASSED"),
      ],
    });

    expect(result.payment.extraPaid).toBe(true);
    expect(result.latestDiagnosticNumber).toBe(4);
    expect(result.currentStage).toEqual({
      kind: "COMPLETED",
      number: 4,
      status: "PASSED",
      nextAction: "NONE",
    });
  });
});
