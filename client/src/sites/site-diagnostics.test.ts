import { describe, expect, it } from "vitest";
import type {
  SiteDiagnosticProgress,
  SiteProgress,
  SiteScan,
} from "./site-api";
import {
  diagnosticStep,
  latestQuickDiagnostic,
  type SiteDiagnosticSource,
} from "./site-diagnostics";

function scan(
  id: string,
  type: SiteScan["type"] = "QUICK",
): SiteScan {
  return {
    id,
    siteId: "site-1",
    type,
    status: "COMPLETED",
    rulesVersion: "2026.08-site-archetype-v8",
    isOutdatedRulesVersion: false,
    linkedWorkOrderId: null,
    verificationWorkOrderId: null,
    locale: "ko",
    score: 77,
    grade: "B",
    startedAt: "2026-08-06T04:56:26.717Z",
    completedAt: "2026-08-06T04:56:32.538Z",
    errorCode: null,
    createdAt: "2026-08-06T04:56:26.512Z",
  };
}

function diagnostic(scanId: string): SiteDiagnosticProgress {
  return {
    diagnosticNumber: 1,
    sourceWorkOrderVersion: 1,
    source: "WORK_ORDER_INITIAL",
    scanId,
    scanType: "QUICK",
    status: "COMPLETED",
    score: 55,
    grade: "D",
    rulesVersion: "2026.07-summary-groups-v7.7",
    targetUrl: null,
    completedAt: "2026-08-06T02:16:13.363Z",
    createdAt: "2026-08-06T02:16:02.401Z",
    reportAvailable: true,
    verificationAttemptId: null,
    verificationStatus: null,
  };
}

function source(latestScan: SiteScan | null): SiteDiagnosticSource {
  const progress: Pick<SiteProgress, "diagnostics" | "payment"> = {
    diagnostics: [diagnostic("old-initial-scan")],
    payment: { initialPaid: true, extraPaid: false },
  };
  return { latestScan, progress };
}

describe("site diagnostic display selection", () => {
  it("무료 간편진단 카드는 작업지시서의 과거 진단보다 최신 QUICK 검사를 우선한다", () => {
    const site = source(scan("new-quick-scan"));

    expect(latestQuickDiagnostic(site)?.scanId).toBe("new-quick-scan");
    expect(diagnosticStep(site, 1)?.scanId).toBe("old-initial-scan");
  });

  it("최신 검사가 검증 검사이면 무료 간편진단에는 기존 1차 진단을 유지한다", () => {
    const site = source(scan("verification-scan", "VERIFICATION"));

    expect(latestQuickDiagnostic(site)?.scanId).toBe("old-initial-scan");
  });
});
