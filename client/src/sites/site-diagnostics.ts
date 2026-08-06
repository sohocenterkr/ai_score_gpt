import type {
  SiteDiagnosticProgress,
  SiteProgress,
  SiteScan,
} from "./site-api";

export interface DiagnosticStepView {
  scanId: string;
  status: string;
  score: number | null;
  grade: string | null;
  completedAt: string | null;
}

export interface SiteDiagnosticSource {
  latestScan: SiteScan | null;
  progress?: Pick<SiteProgress, "diagnostics" | "payment">;
}

function toDiagnosticView(
  diagnostic: SiteDiagnosticProgress,
): DiagnosticStepView {
  return {
    scanId: diagnostic.scanId,
    status: diagnostic.status,
    score: diagnostic.score,
    grade: diagnostic.grade,
    completedAt: diagnostic.completedAt,
  };
}

function toScanView(scan: SiteScan): DiagnosticStepView {
  return {
    scanId: scan.id,
    status: scan.status,
    score: scan.score,
    grade: scan.grade,
    completedAt: scan.completedAt,
  };
}

export function diagnosticStep(
  site: SiteDiagnosticSource,
  number: number,
): DiagnosticStepView | null {
  const diagnostic = site.progress?.diagnostics.find(
    (item) => item.diagnosticNumber === number,
  );

  if (diagnostic) {
    return toDiagnosticView(diagnostic);
  }

  if (
    number === 1 &&
    site.progress?.payment.initialPaid &&
    site.latestScan &&
    site.latestScan.type !== "VERIFICATION" &&
    ["COMPLETED", "PARTIAL"].includes(site.latestScan.status)
  ) {
    return toScanView(site.latestScan);
  }

  return null;
}

export function latestQuickDiagnostic(
  site: SiteDiagnosticSource,
): DiagnosticStepView | null {
  if (site.latestScan && site.latestScan.type !== "VERIFICATION") {
    return toScanView(site.latestScan);
  }

  return diagnosticStep(site, 1);
}
