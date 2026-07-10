import { getRuleDefinition } from "../scans/scoring";

type FindingStatus = "PASS" | "FAIL" | "BLOCKED" | "NA";

export type VerificationEvaluationStatus = "PASSED" | "REWORK_REQUIRED";

export type VerificationItemEvaluationStatus =
  "PASS" | "FAIL" | "BLOCKED" | "NOT_APPLICABLE";

export type VerificationCriterionEvaluationStatus =
  VerificationItemEvaluationStatus | "WARNING";

export interface VerificationCriterionEvaluation {
  code: string;
  label: string;
  required: boolean;
  status: VerificationCriterionEvaluationStatus;
  automated: boolean;
  message: string;
}

export interface VerificationItemEvaluation {
  workOrderItemId: string;
  status: VerificationItemEvaluationStatus;
  criteriaResults: VerificationCriterionEvaluation[];
  evidence: Record<string, unknown>;
  message: string;
  nextItemStatus:
    | "IN_PROGRESS"
    | "REWORK_REQUIRED"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "NOT_APPLICABLE";
  isRequired: boolean;
}

export interface VerificationEvaluation {
  status: VerificationEvaluationStatus;
  workOrderStatus: VerificationEvaluationStatus;
  itemResults: VerificationItemEvaluation[];
  regressionRuleCodes: string[];
  summary: {
    pass: number;
    fail: number;
    blocked: number;
    notApplicable: number;
  };
}

interface FindingInput {
  ruleCode: string;
  status: string;
  evidence?: unknown;
  evidenceJson?: unknown;
}

interface WorkOrderItemInput {
  id: string;
  itemCode: string;
  isRequired: boolean;
  acceptanceCriteriaJson: unknown;
  finding: {
    ruleCode: string;
  } | null;
}

export interface EvaluateVerificationInput {
  items: readonly WorkOrderItemInput[];
  initialFindings: readonly FindingInput[];
  verificationFindings: readonly FindingInput[];
  submittedUrl: string;
  scanTargetUrl: string | null;
}

interface AcceptanceCriterion {
  code: string;
  label: string;
  required: boolean;
}

type EvidenceObject = Record<string, unknown>;

function evidenceObject(value: unknown): EvidenceObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EvidenceObject)
    : {};
}

function evidenceFor(finding: FindingInput | undefined): unknown {
  return finding?.evidenceJson ?? finding?.evidence ?? null;
}

function child(record: EvidenceObject, key: string): EvidenceObject {
  return evidenceObject(record[key]);
}

function numberValue(record: EvidenceObject, key: string): number | null {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(record: EvidenceObject, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringValues(record: EvidenceObject, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function criteria(value: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;

    if (typeof record.code !== "string" || typeof record.label !== "string") {
      return [];
    }

    return [
      {
        code: record.code,
        label: record.label,
        required: record.required !== false,
      },
    ];
  });
}

function findingStatus(
  finding: FindingInput | undefined,
): FindingStatus | null {
  return finding && ["PASS", "FAIL", "BLOCKED", "NA"].includes(finding.status)
    ? (finding.status as FindingStatus)
    : null;
}

function itemStatusFromFinding(
  status: FindingStatus | null,
): VerificationItemEvaluationStatus {
  if (status === "PASS") return "PASS";
  if (status === "FAIL") return "FAIL";
  if (status === "NA") return "NOT_APPLICABLE";
  return "BLOCKED";
}

function normalizeUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.hash = "";

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return value.trim() || null;
  }
}

function sameSubmittedUrl(
  submittedUrl: string,
  scanTargetUrl: string | null,
): boolean {
  return normalizeUrl(submittedUrl) === normalizeUrl(scanTargetUrl);
}

function normalizedText(value: string | null): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s*([,.;:!?()[\]{}"“”‘’·ㆍ・])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizedList(values: string[]): string {
  return values
    .map((value) => normalizedText(value))
    .filter(Boolean)
    .sort()
    .join("|");
}

function renderedComparison(verificationFindings: readonly FindingInput[]): {
  status: string | null;
  initial: EvidenceObject;
  rendered: EvidenceObject;
  raw: unknown;
} {
  const finding = verificationFindings.find(
    (item) => item.ruleCode === "ENV-MEASUREMENT-001",
  );
  const raw = evidenceFor(finding);
  const root = evidenceObject(raw);
  const renderedDom = child(root, "renderedDom");

  return {
    status: stringValue(renderedDom, "status"),
    initial: child(renderedDom, "initialHtml"),
    rendered: child(renderedDom, "renderedDom"),
    raw,
  };
}

function evaluateRenderedItem(
  itemCode: string,
  verificationFindings: readonly FindingInput[],
): {
  status: VerificationItemEvaluationStatus;
  message: string;
  evidence: Record<string, unknown>;
} {
  const comparison = renderedComparison(verificationFindings);

  if (comparison.status !== "SUCCESS") {
    return {
      status: "BLOCKED",
      message:
        "JavaScript 렌더링 비교가 성공하지 않아 이 개선안을 자동 판정할 수 없습니다.",
      evidence: {
        itemCode,
        renderedDomStatus: comparison.status ?? "MISSING",
        renderedDomEvidence: comparison.raw,
      },
    };
  }

  const initialLinks = child(comparison.initial, "links");
  const renderedLinks = child(comparison.rendered, "links");
  const initialHeadings = child(comparison.initial, "headings");
  const renderedHeadings = child(comparison.rendered, "headings");
  const initialJsonLd = child(comparison.initial, "jsonLd");
  const renderedJsonLd = child(comparison.rendered, "jsonLd");

  if (itemCode === "RENDERED-ADDED-CONTENT") {
    const initialText = numberValue(comparison.initial, "textLength") ?? 0;
    const renderedText = numberValue(comparison.rendered, "textLength") ?? 0;
    const initialInternal = numberValue(initialLinks, "internal") ?? 0;
    const renderedInternal = numberValue(renderedLinks, "internal") ?? 0;
    const textDelta = renderedText - initialText;
    const linkDelta = renderedInternal - initialInternal;
    const textCoverage =
      renderedText > 0
        ? Math.min(initialText / renderedText, 1)
        : initialText > 0
          ? 1
          : 0;
    const linkCoverage =
      renderedInternal > 0
        ? Math.min(initialInternal / renderedInternal, 1)
        : 1;
    const textReady = initialText >= 200 && textCoverage >= 0.75;
    const linksReady =
      renderedInternal === 0 ||
      (initialInternal >= 1 &&
        (linkCoverage >= 0.75 || Math.abs(linkDelta) <= 2));
    const passed = textReady && linksReady;

    return {
      status: passed ? "PASS" : "FAIL",
      message: passed
        ? "초기 HTML이 렌더링 DOM 본문과 주요 내부 링크를 충분히 포함합니다."
        : "초기 HTML의 본문 또는 주요 내부 링크 포함 비율이 아직 부족합니다.",
      evidence: {
        itemCode,
        initialText,
        renderedText,
        textDelta,
        initialTextCoverage: textCoverage,
        initialTextCoveragePercent: Number((textCoverage * 100).toFixed(1)),
        initialInternalLinks: initialInternal,
        renderedInternalLinks: renderedInternal,
        internalLinkDelta: linkDelta,
        initialLinkCoverage: linkCoverage,
        initialLinkCoveragePercent: Number((linkCoverage * 100).toFixed(1)),
        checks: {
          minimumInitialText: initialText >= 200,
          textCoverageAtLeast75Percent: textCoverage >= 0.75,
          importantLinksAvailable: linksReady,
        },
        thresholds: {
          minimumInitialText: 200,
          minimumTextCoverage: 0.75,
          minimumLinkCoverage: 0.75,
          allowedInternalLinkDifference: 2,
        },
      },
    };
  }

  if (
    itemCode === "RENDERED-INCONSISTENT-INFORMATION" ||
    itemCode === "RENDERED-INCONSISTENT-INFORM"
  ) {
    const fields = {
      title:
        normalizedText(stringValue(comparison.initial, "title")) ===
        normalizedText(stringValue(comparison.rendered, "title")),
      description:
        normalizedText(stringValue(comparison.initial, "metaDescription")) ===
        normalizedText(stringValue(comparison.rendered, "metaDescription")),
      h1:
        normalizedList(stringValues(initialHeadings, "h1")) ===
        normalizedList(stringValues(renderedHeadings, "h1")),
      singleRenderedH1: stringValues(renderedHeadings, "h1").length === 1,
      jsonLdTypes:
        normalizedList(stringValues(initialJsonLd, "types")) ===
        normalizedList(stringValues(renderedJsonLd, "types")),
    };
    const passed = Object.values(fields).every(Boolean);

    return {
      status: passed ? "PASS" : "FAIL",
      message: passed
        ? "초기 HTML과 렌더링 DOM의 핵심 제목·설명·구조화 정보가 일치합니다."
        : "초기 HTML과 렌더링 DOM 사이에 핵심정보 불일치가 남아 있습니다.",
      evidence: {
        itemCode,
        matchingFields: fields,
        initial: {
          title: stringValue(comparison.initial, "title"),
          metaDescription: stringValue(comparison.initial, "metaDescription"),
          h1: stringValues(initialHeadings, "h1"),
          jsonLdTypes: stringValues(initialJsonLd, "types"),
        },
        rendered: {
          title: stringValue(comparison.rendered, "title"),
          metaDescription: stringValue(comparison.rendered, "metaDescription"),
          h1: stringValues(renderedHeadings, "h1"),
          jsonLdTypes: stringValues(renderedJsonLd, "types"),
        },
      },
    };
  }

  if (itemCode === "INITIAL-HTML-MISSING-CORE") {
    const textLength = numberValue(comparison.initial, "textLength") ?? 0;
    const h1 = stringValues(initialHeadings, "h1");
    const internalLinks = numberValue(initialLinks, "internal") ?? 0;
    const title = stringValue(comparison.initial, "title");
    const description = stringValue(comparison.initial, "metaDescription");
    const checks = {
      title: Boolean(title),
      description: Boolean(description),
      h1: h1.length > 0,
      readableText: textLength >= 200,
      internalLinks: internalLinks >= 1,
    };
    const passed = Object.values(checks).every(Boolean);

    return {
      status: passed ? "PASS" : "FAIL",
      message: passed
        ? "초기 HTML에서 제목·설명·H1·핵심 본문·내부 링크를 확인했습니다."
        : "초기 HTML 핵심 정보가 아직 충분하지 않습니다.",
      evidence: {
        itemCode,
        checks,
        title,
        metaDescription: description,
        h1,
        textLength,
        internalLinks,
      },
    };
  }

  return {
    status: "BLOCKED",
    message: "이 개선안 코드는 현재 자동 판정 규칙에 연결되어 있지 않습니다.",
    evidence: {
      itemCode,
      renderedDomStatus: comparison.status,
    },
  };
}

function criterionEvaluation(
  criterion: AcceptanceCriterion,
  baseStatus: VerificationItemEvaluationStatus,
  baseMessage: string,
  regressionRuleCodes: readonly string[],
  submittedUrlMatches: boolean,
): VerificationCriterionEvaluation {
  const text = `${criterion.code} ${criterion.label}`;

  if (/디자인|사용자 기능|브라우저 스모크|수동 확인/.test(text)) {
    return {
      ...criterion,
      status: "WARNING",
      automated: false,
      message:
        "자동 판정 범위 밖의 항목입니다. 주요 버튼·로그인·페이지 이동과 화면 디자인은 브라우저 스모크 테스트 또는 수동 확인을 권장합니다.",
    };
  }

  if (/회귀/.test(text)) {
    const passed = regressionRuleCodes.length === 0;

    return {
      ...criterion,
      status: passed ? "PASS" : "FAIL",
      automated: true,
      message: passed
        ? "이전 진단에서 통과한 가중 규칙의 신규 실패를 확인하지 못했습니다."
        : `초기 통과 규칙 중 ${regressionRuleCodes.join(
            ", ",
          )} 항목이 이번 차수 진단에서 통과하지 못했습니다.`,
    };
  }

  if (
    /대상 URL|운영 URL|제출 URL/.test(text) ||
    criterion.label ===
      "검사에서 사용한 대상 URL과 동일한 운영 URL에 반영되어 있다."
  ) {
    return {
      ...criterion,
      status: submittedUrlMatches ? "PASS" : "FAIL",
      automated: true,
      message: submittedUrlMatches
        ? "제출된 공개 URL을 이번 차수 진단의 대상 URL로 사용했습니다."
        : "제출 URL과 실제 진단 대상 URL이 일치하지 않습니다.",
    };
  }

  return {
    ...criterion,
    status: baseStatus,
    automated: true,
    message:
      baseStatus === "PASS"
        ? `${baseMessage} 세부 완료 기준은 연결된 규칙의 이번 차수 진단 결과로 판정했습니다.`
        : baseStatus === "FAIL"
          ? baseMessage
          : baseStatus === "NOT_APPLICABLE"
            ? "이번 차수 진단에서 감점 제외 항목으로 판정되었습니다."
            : baseMessage,
  };
}

export function evaluateVerification(
  input: EvaluateVerificationInput,
): VerificationEvaluation {
  const currentByRule = new Map(
    input.verificationFindings.map((finding) => [finding.ruleCode, finding]),
  );
  const initialByRule = new Map(
    input.initialFindings.map((finding) => [finding.ruleCode, finding]),
  );

  const regressionRuleCodes = input.initialFindings
    .filter((finding) => {
      const definition = getRuleDefinition(finding.ruleCode);
      return (
        definition &&
        definition.weight > 0 &&
        findingStatus(finding) === "PASS" &&
        findingStatus(currentByRule.get(finding.ruleCode)) !== "PASS"
      );
    })
    .map((finding) => finding.ruleCode)
    .sort();

  const submittedUrlMatches = sameSubmittedUrl(
    input.submittedUrl,
    input.scanTargetUrl,
  );

  const itemResults = input.items.map((item): VerificationItemEvaluation => {
    const itemRuleDefinition = getRuleDefinition(item.itemCode);
    const linkedRuleCode =
      item.finding?.ruleCode ?? (itemRuleDefinition ? item.itemCode : null);
    const initialFinding = linkedRuleCode
      ? initialByRule.get(linkedRuleCode)
      : undefined;
    const currentFinding = linkedRuleCode
      ? currentByRule.get(linkedRuleCode)
      : undefined;

    let status: VerificationItemEvaluationStatus;
    let message: string;
    let evidence: Record<string, unknown>;

    if (linkedRuleCode) {
      const currentStatus = findingStatus(currentFinding);
      status = itemStatusFromFinding(currentStatus);
      message =
        status === "PASS"
          ? `${linkedRuleCode} 규칙이 이번 차수 진단에서 통과했습니다.`
          : status === "FAIL"
            ? `${linkedRuleCode} 규칙이 이번 차수 진단에서도 통과하지 못했습니다.`
            : status === "NOT_APPLICABLE"
              ? `${linkedRuleCode} 규칙이 이번 차수 진단에서 감점 제외로 판정되었습니다.`
              : `${linkedRuleCode} 규칙의 이번 차수 진단 결과를 자동으로 확인할 수 없습니다.`;
      evidence = {
        evaluationType: "RULE_STATUS",
        ruleCode: linkedRuleCode,
        initialStatus: findingStatus(initialFinding) ?? "MISSING",
        verificationStatus: currentStatus ?? "MISSING",
        initialEvidence: evidenceFor(initialFinding),
        verificationEvidence: evidenceFor(currentFinding),
        submittedUrl: input.submittedUrl,
        scanTargetUrl: input.scanTargetUrl,
      };
    } else {
      const renderedResult = evaluateRenderedItem(
        item.itemCode,
        input.verificationFindings,
      );
      status = renderedResult.status;
      message = renderedResult.message;
      evidence = {
        evaluationType: "RENDERED_IMPROVEMENT",
        ...renderedResult.evidence,
        submittedUrl: input.submittedUrl,
        scanTargetUrl: input.scanTargetUrl,
      };
    }

    if (regressionRuleCodes.length > 0 && status === "PASS") {
      status = "FAIL";
      message =
        "선택 항목 자체는 통과했지만 초기 검사에서 정상이던 가중 규칙에 회귀가 발견되었습니다.";
    }

    const criterionResults = criteria(item.acceptanceCriteriaJson).map(
      (criterion) =>
        criterionEvaluation(
          criterion,
          status,
          message,
          regressionRuleCodes,
          submittedUrlMatches,
        ),
    );

    const requiredCriterionFailure = criterionResults.some(
      (criterion) =>
        criterion.required &&
        criterion.automated &&
        !["PASS", "NOT_APPLICABLE"].includes(criterion.status),
    );

    if (status === "PASS" && requiredCriterionFailure) {
      status = "FAIL";
      message =
        "연결 규칙은 통과했지만 필수 완료 기준 중 통과하지 못한 항목이 있습니다.";
    }

    return {
      workOrderItemId: item.id,
      status,
      criteriaResults: criterionResults,
      evidence: {
        ...evidence,
        regressionRuleCodes,
        submittedUrlMatches,
      },
      message,
      nextItemStatus:
        status === "PASS"
          ? "COMPLETED"
          : status === "FAIL"
            ? "REWORK_REQUIRED"
            : status === "BLOCKED"
              ? "REVIEW_REQUIRED"
              : status === "NOT_APPLICABLE"
                ? "NOT_APPLICABLE"
                : "IN_PROGRESS",
      isRequired: item.isRequired,
    };
  });

  const hasRequiredItems = itemResults.some((item) => item.isRequired);
  const blockingResults = itemResults.filter(
    (item) =>
      (item.isRequired || !hasRequiredItems) &&
      !["PASS", "NOT_APPLICABLE"].includes(item.status),
  );
  const status: VerificationEvaluationStatus =
    blockingResults.length === 0 ? "PASSED" : "REWORK_REQUIRED";

  const summary = {
    pass: itemResults.filter((item) => item.status === "PASS").length,
    fail: itemResults.filter((item) => item.status === "FAIL").length,
    blocked: itemResults.filter((item) => item.status === "BLOCKED").length,
    notApplicable: itemResults.filter(
      (item) => item.status === "NOT_APPLICABLE",
    ).length,
  };

  return {
    status,
    workOrderStatus: status,
    itemResults,
    regressionRuleCodes,
    summary,
  };
}
