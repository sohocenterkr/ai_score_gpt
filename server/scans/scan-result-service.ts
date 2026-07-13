import type {
  Finding,
  FindingSeverity,
  FindingStatus,
  ScanPage,
} from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";
import {
  CURRENT_RULES_VERSION,
  calculateScore,
  getRuleDefinition,
  getRuleSummaryGroup,
  type ScoreSummary,
  type SummaryGroup,
  isPendingContentFinding,
} from "./scoring";
import {
  buildContentReadinessAssessment,
  type ContentReadinessAssessment,
} from "./content-readiness";

export interface PublicScanResultFinding {
  id: string;
  ruleCode: string;
  category: string;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  evidence: unknown;
  recommendation: string | null;
  scoreDelta: number;
  weight: number;
}

export interface PublicScanResultPage {
  id: string;
  url: string;
  statusCode: number | null;
  finalUrl: string | null;
  contentType: string | null;
  rawHtmlHash: string | null;
  initialTextLength: number | null;
  iframeCount: number | null;
}

export interface PublicScanResult {
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
    locale: "ko" | "en";
    score: number | null;
    grade: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorCode: string | null;
    createdAt: string;
  };
  scoreSummary: ScoreSummary | null;
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
    summaryGroup: SummaryGroup;
    title: string;
  }>;
  primaryIssues: PublicScanResultFinding[];
  pages: PublicScanResultPage[];
  findings: PublicScanResultFinding[];
}

export interface ScanResultService {
  getScanResult(user: PublicUser, scanId: string): Promise<PublicScanResult>;

  getScanResultForAdmin?(scanId: string): Promise<PublicScanResult>;
}

export class ScanResultServiceError extends Error {
  constructor(
    public readonly code: "SCAN_RESULT_NOT_FOUND",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScanResultServiceError";
  }
}

function evidenceRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function evidenceString(
  findings: Finding[],
  ruleCode: string,
  key: string,
): string | null {
  const finding = findings.find((item) => item.ruleCode === ruleCode);
  const value = evidenceRecord(finding?.evidenceJson)[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function evidenceNumber(
  findings: Finding[],
  ruleCode: string,
  key: string,
): number | null {
  const finding = findings.find((item) => item.ruleCode === ruleCode);
  const value = evidenceRecord(finding?.evidenceJson)[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function evidenceStrings(
  findings: Finding[],
  ruleCode: string,
  key: string,
): string[] {
  const finding = findings.find((item) => item.ruleCode === ruleCode);
  const value = evidenceRecord(finding?.evidenceJson)[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function publicFinding(finding: Finding): PublicScanResultFinding {
  return {
    id: finding.id,
    ruleCode: finding.ruleCode,
    category: finding.category,
    severity: finding.severity,
    status: finding.status,
    title: finding.title,
    description: finding.description,
    evidence: finding.evidenceJson,
    recommendation: finding.recommendation,
    scoreDelta: finding.scoreDelta,
    weight: getRuleDefinition(finding.ruleCode)?.weight ?? 0,
  };
}

function publicPage(page: ScanPage): PublicScanResultPage {
  return {
    id: page.id,
    url: page.url,
    statusCode: page.statusCode,
    finalUrl: page.finalUrl,
    contentType: page.contentType,
    rawHtmlHash: page.rawHtmlHash,
    initialTextLength: page.initialTextLength,
    iframeCount: page.iframeCount,
  };
}

function severityOrder(severity: FindingSeverity): number {
  return {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  }[severity];
}

function buildFoundInformation(
  findings: Finding[],
  finalUrl: string | null,
): Array<{ label: string; value: string }> {
  const values: Array<{ label: string; value: string }> = [];
  const title = evidenceString(findings, "META-TITLE-001", "title");
  const description = evidenceString(
    findings,
    "META-DESCRIPTION-001",
    "metaDescription",
  );
  const language = evidenceString(findings, "STRUCT-LANG-001", "htmlLang");
  const h1 = evidenceStrings(findings, "STRUCT-H1-001", "h1");
  const jsonLdTypes = evidenceStrings(
    findings,
    "STRUCT-JSONLD-TYPES-001",
    "types",
  );

  if (title) values.push({ label: "문서 제목", value: title });
  if (description) {
    values.push({
      label: "메타 설명",
      value: description,
    });
  }
  if (language) {
    values.push({
      label: "문서 언어",
      value: language,
    });
  }
  if (h1[0]) {
    values.push({
      label: "대표 H1",
      value: h1[0],
    });
  }
  if (jsonLdTypes.length > 0) {
    values.push({
      label: "JSON-LD 유형",
      value: jsonLdTypes.join(", "),
    });
  }
  if (finalUrl) {
    values.push({
      label: "최종 URL",
      value: finalUrl,
    });
  }

  return values;
}

const FETCH_FAILURE_REASONS: Record<string, string> = {
  HTTP_TIMEOUT:
    "사이트 응답이 제한 시간을 초과해 콘텐츠를 확인하지 못했습니다. 사이트가 느리거나 일시적으로 응답하지 않았을 수 있습니다.",
  HTTP_REQUEST_FAILED:
    "진단 서버에서 사이트에 연결하지 못했습니다. 사용자 브라우저에서는 정상 접속되더라도, 진단 서버의 위치나 IP에서는 접속이 차단되었거나 연결되지 않을 수 있습니다.",
  HTTP_REDIRECT_LIMIT:
    "리디렉션이 허용 횟수를 초과해 최종 페이지에 도달하지 못했습니다.",
  HTTP_REDIRECT_INVALID:
    "리디렉션 대상 주소가 올바르지 않아 최종 페이지에 도달하지 못했습니다.",
  HTTP_BODY_TOO_LARGE:
    "응답 본문 크기가 허용 범위를 초과해 콘텐츠 확인을 중단했습니다.",
  HTTP_CONTENT_ENCODING_UNSUPPORTED:
    "지원하지 않는 응답 압축 형식이라 본문을 해석하지 못했습니다.",
};

const DEFAULT_FETCH_FAILURE_REASON =
  "진단 서버에서 원인을 특정하지 못한 오류로 콘텐츠를 확인하지 못했습니다.";

function buildUnderstandingSummary(
  siteName: string,
  findings: Finding[],
  scanStatus: string,
  errorCode: string | null,
): string {
  if (scanStatus === "FAILED") {
    const reason =
      (errorCode && FETCH_FAILURE_REASONS[errorCode]) ??
      DEFAULT_FETCH_FAILURE_REASON;

    return `"${siteName}" 사이트는 진단 서버가 초기 HTML을 읽기 전에 실패했습니다. ${reason}`;
  }

  const title = evidenceString(findings, "META-TITLE-001", "title") ?? siteName;
  const description = evidenceString(
    findings,
    "META-DESCRIPTION-001",
    "metaDescription",
  );
  const language =
    evidenceString(findings, "STRUCT-LANG-001", "htmlLang") ?? "언어 미확인";
  const textLength =
    evidenceNumber(findings, "CONTENT-INITIAL-001", "textLength") ?? 0;
  const jsonLdTypes = evidenceStrings(
    findings,
    "STRUCT-JSONLD-TYPES-001",
    "types",
  );

  const parts = [
    `"${title}" 페이지는 ${language} 문서로 확인되었고 초기 HTML에서 약 ${textLength.toLocaleString("ko-KR")}자의 본문을 읽었습니다.`,
  ];

  if (description) {
    parts.push(`사이트 설명은 "${description}"로 확인됩니다.`);
  }

  parts.push(
    jsonLdTypes.length > 0
      ? `구조화 데이터 유형은 ${jsonLdTypes.join(", ")}입니다.`
      : "식별 가능한 JSON-LD 유형은 확인되지 않았습니다.",
  );

  return parts.join(" ");
}

function buildPublicScanResult(result: {
  id: string;
  type: string;
  status: string;
  rulesVersion: string;
  locale: string;
  score: number | null;
  grade: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  createdAt: Date;
  verificationAttempt: {
    workOrder: {
      version: number;
    };
  } | null;
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
  pages: ScanPage[];
  findings: Finding[];
}): PublicScanResult {
  const isOutdatedRulesVersion = result.rulesVersion !== CURRENT_RULES_VERSION;
  const scoreSummary =
    !isOutdatedRulesVersion && result.findings.length > 0
      ? calculateScore(result.findings)
      : null;
  const findings = result.findings.map(publicFinding);
  const primaryIssues = findings
    .filter(
      (finding) =>
        (finding.status === "FAIL" || finding.status === "BLOCKED") &&
        !isPendingContentFinding(finding),
    )
    .sort(
      (left, right) =>
        right.weight - left.weight ||
        severityOrder(right.severity) - severityOrder(left.severity),
    )
    .slice(0, 5);

  return {
    site: {
      id: result.site.id,
      name: result.site.name,
      baseUrl: result.site.baseUrl,
      finalUrl: result.site.finalUrl,
      siteType: result.site.siteType,
      country: result.site.country,
      region: result.site.region,
      primaryLocale: result.site.primaryLocale,
    },
    scan: {
      id: result.id,
      type: result.type,
      diagnosticNumber: result.verificationAttempt
        ? result.verificationAttempt.workOrder.version + 1
        : 1,
      status: result.status,
      rulesVersion: result.rulesVersion,
      locale: result.locale === "en" ? "en" : "ko",
      score: result.score,
      grade: result.grade,
      startedAt: result.startedAt?.toISOString() ?? null,
      completedAt: result.completedAt?.toISOString() ?? null,
      errorCode: result.errorCode,
      createdAt: result.createdAt.toISOString(),
    },
    scoreSummary,
    currentRulesVersion: CURRENT_RULES_VERSION,
    isOutdatedRulesVersion,
    contentReadiness: buildContentReadinessAssessment({
      siteName: result.site.name,
      siteType: result.site.siteType,
      findings: result.findings,
    }),
    understandingSummary: buildUnderstandingSummary(
      result.site.name,
      result.findings,
      result.status,
      result.errorCode,
    ),
    foundInformation: buildFoundInformation(
      result.findings,
      result.site.finalUrl,
    ),
    missingInformation: findings
      .filter(
        (finding) =>
          finding.weight > 0 &&
          (finding.status === "FAIL" || finding.status === "BLOCKED") &&
          !isPendingContentFinding(finding),
      )
      .map((finding) => ({
        ruleCode: finding.ruleCode,
        summaryGroup: getRuleSummaryGroup(finding.ruleCode),
        title: finding.title,
      })),
    primaryIssues,
    pages: result.pages.map(publicPage),
    findings,
  };
}
export function createPrismaScanResultService(): ScanResultService {
  return {
    async getScanResult(user, scanId) {
      const prisma = getDatabase();
      const result = await prisma.scan.findFirst({
        where: {
          id: scanId,
          site: {
            status: "ACTIVE",
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
        include: {
          site: true,
          verificationAttempt: {
            select: {
              workOrder: {
                select: {
                  version: true,
                },
              },
            },
          },
          pages: {
            orderBy: {
              createdAt: "asc",
            },
          },
          findings: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!result) {
        throw new ScanResultServiceError(
          "SCAN_RESULT_NOT_FOUND",
          "검사 결과를 찾을 수 없습니다.",
          404,
        );
      }

      return buildPublicScanResult(result);
    },

    async getScanResultForAdmin(scanId) {
      const prisma = getDatabase();
      const result = await prisma.scan.findFirst({
        where: {
          id: scanId,
          site: {
            status: "ACTIVE",
          },
        },
        include: {
          site: true,
          verificationAttempt: {
            select: {
              workOrder: {
                select: {
                  version: true,
                },
              },
            },
          },
          pages: {
            orderBy: {
              createdAt: "asc",
            },
          },
          findings: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!result) {
        throw new ScanResultServiceError(
          "SCAN_RESULT_NOT_FOUND",
          "검사 결과를 찾을 수 없습니다.",
          404,
        );
      }

      return buildPublicScanResult(result);
    },
  };
}
