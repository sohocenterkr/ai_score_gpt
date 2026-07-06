import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  getScanResultRequest,
  queueSiteScanRequest,
  scanResultPdfUrl,
  SiteApiError,
  type ScanResultFinding,
  type ScanResultResponse,
} from "../sites/site-api";
import "../scan-results.css";
import {
  createWorkOrderRequest,
  WorkOrderApiError,
} from "../work-orders/work-order-api";
import "../work-orders.css";

const statusLabels: Record<ScanResultFinding["status"], string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const severityLabels: Record<ScanResultFinding["severity"], string> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

const severityDescriptions: Record<ScanResultFinding["severity"], string> = {
  INFO: "문제 해결 순서를 정할 때 참고하는 안내 수준입니다.",
  LOW: "점수 영향과 위험이 비교적 낮은 개선 항목입니다.",
  MEDIUM: "점수와 AI 이해도에 영향을 줄 수 있어 확인이 필요한 항목입니다.",
  HIGH: "핵심 접근성이나 이해 정확도에 큰 영향을 줄 수 있는 항목입니다.",
  CRITICAL:
    "검사 결과 전체를 제한할 수 있어 가장 먼저 해결해야 하는 항목입니다.",
};

const englishStatusLabels: Record<ScanResultFinding["status"], string> = {
  PASS: "Pass",
  FAIL: "Fail",
  BLOCKED: "Blocked",
  NA: "Not scored",
};

const englishSeverityLabels: Record<ScanResultFinding["severity"], string> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const englishSeverityDescriptions: Record<
  ScanResultFinding["severity"],
  string
> = {
  INFO: "Informational guidance for prioritizing improvements.",
  LOW: "A relatively low-risk improvement item with limited score impact.",
  MEDIUM:
    "An item that may affect score and AI understanding and should be reviewed.",
  HIGH: "An item that may significantly affect core accessibility or understanding accuracy.",
  CRITICAL:
    "A critical item that may limit the entire diagnostic result and should be addressed first.",
};

const categoryEnglishLabels: Record<string, string> = {
  "접근 및 수집 정책": "Access and crawl policy",
  "콘텐츠 공개 및 맥락": "Content visibility and context",
  "정보·구조화 데이터 맥락": "Information and structured data context",
  "정보 구조와 메타데이터": "Information structure and metadata",
  "브랜드·서비스 식별": "Brand and service identification",
  "핵심정보 인식 명확도": "Key information clarity",
  "구조화 데이터 및 검색 기능성": "Structured data and search functionality",
  "AI 에이전트 서버 가능성": "AI agent/server readiness",
  "사용자 신뢰와 정책": "User trust and policies",
  "콘텐츠 읽기 용이성": "Content readability",
  "정보 구조와 의미 전달": "Information structure and meaning",
  "핵심정보 인식 정확도": "Core information recognition accuracy",
  "콘텐츠 이해 및 답변 가능성": "Content understanding and answerability",
  "AI에이전트 사용 가능성": "AI agent usability",
  "신뢰성 및 추적 환경": "Trust and tracking environment",
  "AI 에이전트 사용 가능성": "AI agent usability",
  "최신성 및 추적 환경": "Freshness and tracking environment",
};

type MissingInformationSummaryKey = "technical" | "content" | "structured";

type MissingInformationSummaryItem = {
  key: MissingInformationSummaryKey;
  koLabel: string;
  enLabel: string;
  count: number;
};

function classifyMissingInformationSummaryItem(item: {
  ruleCode: string;
  title: string;
}): MissingInformationSummaryKey {
  const ruleCode = item.ruleCode.toUpperCase();
  const title = item.title;

  if (
    ruleCode.startsWith("CONTENT-") ||
    /서비스 정의|이용 대상|활용 사례|이용 절차|결과물|요금|무료|유료|고객지원|개인정보|입력자료|차별점|신뢰 근거|운영 주체와 문의 정책|초기 콘텐츠|관련 콘텐츠/.test(
      title,
    )
  ) {
    return "content";
  }

  if (
    ruleCode.startsWith("STRUCT-") ||
    /JSON-LD|sameAs|contactPoint|SearchAction|구조화|문의 구조화/.test(title)
  ) {
    return "structured";
  }

  return "technical";
}

function buildMissingInformationSummary(
  items: Array<{ ruleCode: string; title: string }>,
): MissingInformationSummaryItem[] {
  const counts: Record<MissingInformationSummaryKey, number> = {
    technical: 0,
    content: 0,
    structured: 0,
  };

  for (const item of items) {
    counts[classifyMissingInformationSummaryItem(item)] += 1;
  }

  return [
    {
      key: "technical",
      koLabel: "사이트 설정·기술 구조",
      enLabel: "Site settings and technical structure",
      count: counts.technical,
    },
    {
      key: "content",
      koLabel: "콘텐츠·AI 답변 준비",
      enLabel: "Content and AI answer readiness",
      count: counts.content,
    },
    {
      key: "structured",
      koLabel: "구조화 데이터·신뢰 신호",
      enLabel: "Structured data and trust signals",
      count: counts.structured,
    },
  ];
}

function translateCategoryLabel(value: string, isEnglish: boolean): string {
  return isEnglish ? (categoryEnglishLabels[value] ?? value) : value;
}

const foundLabelEnglishLabels: Record<string, string> = {
  사이트명: "Site name",
  "문서 제목": "Document title",
  제목: "Title",
  설명: "Description",
  "기본 언어": "Primary language",
  "대표 URL": "Main URL",
  "최종 URL": "Final URL",
  "JSON-LD 유형": "JSON-LD types",
  "구조화 데이터 유형": "Structured data types",
  "메타 설명": "Meta description",
  "문서 언어": "Document language",
  "최상위 제목(H1)": "Top-level heading (H1)",
  "제목 계층 구조": "Heading hierarchy",
  "제공 계층 구조": "Heading hierarchy",
  "페이지 링크 구조": "Page link structure",
  "관련 콘텐츠 탐색 단서": "Related content discovery signals",
};

const findingTitleEnglishLabels: Record<string, string> = {
  "HTTP 접근": "HTTP access",
  "robots.txt 접근": "robots.txt access",
  "robots.txt 검색 봇 정책": "robots.txt search bot policy",
  "OAI-SearchBot 검색 접근": "OAI-SearchBot search access",
  "ChatGPT-User 사용자 요청 접근": "ChatGPT-User request access",
  "GPTBot 학습 접근 정책": "GPTBot training access policy",
  "HTTPS 리디렉션": "HTTPS redirect",
  "대표 URL(canonical)": "Canonical URL",
  "페이지 제목": "Page title",
  "페이지 설명": "Page description",
  "대표 제목(H1)": "Main heading (H1)",
  "초기 HTML 텍스트": "Initial HTML text",
  "초기 HTML 내부 링크": "Initial HTML internal links",
  "JSON-LD 구조화 데이터": "JSON-LD structured data",
  "JSON-LD 유형 식별": "JSON-LD type identification",
  사이트맵: "Sitemap",
  "메타 로봇 정책": "Meta robots policy",
  "초기 콘텐츠 답변 기반": "Initial content answer basis",
  "메타 설명": "Meta description",
  "문서 언어": "Document language",
  "최상위 제목(H1)": "Top-level heading (H1)",
  "제목 계층 구조": "Heading hierarchy",
  "제공 계층 구조": "Heading hierarchy",
  "페이지 링크 구조": "Page link structure",
  "관련 콘텐츠 탐색 단서": "Related content discovery signals",
};

function translateFoundLabel(value: string, isEnglish: boolean): string {
  return isEnglish ? (foundLabelEnglishLabels[value] ?? value) : value;
}

function translateFindingTitle(value: string, isEnglish: boolean): string {
  return isEnglish ? (findingTitleEnglishLabels[value] ?? value) : value;
}

function translateStoredEvidenceText(
  value: string,
  isEnglish: boolean,
): string {
  if (!isEnglish) return value;

  const exact: Record<string, string> = {
    "Site AI Score | AI 검색 친화도 진단":
      "Site AI Score | AI Search Readiness Diagnostic",
    "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해되는지 진단하고, 개선 방향과 작업지시서를 제공하는 서비스입니다.":
      "Site AI Score diagnoses whether a website is well understood by AI search and search engines, and provides improvement direction and work orders.",
  };

  if (exact[value]) return exact[value];

  return value
    .replace(
      /Site AI Score \| AI 검색 친화도 진단/g,
      "Site AI Score | AI Search Readiness Diagnostic",
    )
    .replace(
      /Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해되는지 진단하고, 개선 방향과 작업지시서를 제공하는 서비스입니다\./g,
      "Site AI Score diagnoses whether a website is well understood by AI search and search engines, and provides improvement direction and work orders.",
    )
    .replace(
      /"([^"]+)" 페이지는 ([a-z-]+) 문서로 확인되었고 초기 HTML에서 약 ([0-9,]+)자의 본문을 읽었습니다\./g,
      (_match, title: string, language: string, characters: string) =>
        `The page "${translateStoredEvidenceText(title, true)}" was identified as a ${language} document, and about ${characters} characters of body text were read from the initial HTML.`,
    )
    .replace(
      /사이트 설명은 "([^"]+)"로 확인됩니다\./g,
      (_match, description: string) =>
        `The site description was identified as "${translateStoredEvidenceText(description, true)}".`,
    )
    .replace(
      /식별 가능한 JSON-LD 유형은 확인되지 않았습니다\./g,
      "No identifiable JSON-LD type was found.",
    );
}

function translateDiagnosticText(
  value: string | null | undefined,
  isEnglish: boolean,
): string {
  if (!value || !isEnglish) return value ?? "";

  const exact: Record<string, string> = {
    "유효한 JSON-LD 구조화 데이터를 확인했습니다.":
      "Valid JSON-LD structured data was found.",
    "유효한 JSON-LD 구조화 데이터를 확인하지 못했습니다.":
      "Valid JSON-LD structured data was not found.",
    "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.":
      "No valid JSON-LD structured data was found in the initial HTML.",
    "사이트의 업종과 핵심정보에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.":
      "Add Schema.org JSON-LD that matches the website type and key information to the initial HTML.",
    "사이트에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.":
      "Add Schema.org JSON-LD that fits the website to the initial HTML.",
    "JSON-LD에서 Schema.org 유형을 식별했습니다.":
      "A Schema.org type was identified in the JSON-LD.",
    "식별 가능한 JSON-LD @type이 없습니다.":
      "No identifiable JSON-LD @type was found.",
    "초기 HTML에서 탐색 가능한 내부 링크를 확인했습니다.":
      "Navigable internal links were found in the initial HTML.",
    "초기 HTML에서 탐색 가능한 내부 링크를 찾지 못했습니다.":
      "Navigable internal links were not found in the initial HTML.",
    "초기 HTML의 내부 링크가 관련 콘텐츠 탐색 단서를 제공합니다.":
      "Internal links in the initial HTML provide navigation signals to related content.",
    "관련 콘텐츠로 이어지는 내부 링크 단서가 부족합니다.":
      "There are not enough internal link signals leading to related content.",
  };

  return exact[value] ?? value;
}

function translateRenderedText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;

  const exact: Record<string, string> = {
    "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다":
      "Some information is visible on screen but may be missed by some AI systems",
    "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다.":
      "Body content or navigation links are added after the page opens.",
    "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.":
      "It may look normal to users, but some AI search bots that do not fully process JavaScript may miss information and links added later.",
    "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다":
      "The information first received by AI differs from what is displayed on screen",
    "AI가 처음 받는 페이지에 핵심 정보가 부족합니다":
      "The page first received by AI lacks core information",
    "초기 HTML에 핵심 본문과 주요 이동 경로가 충분히 포함되도록 렌더링 의존도를 줄이는 개선이 필요합니다.":
      "Reduce rendering dependency so the initial HTML contains enough core body text and key navigation paths.",
    "초기 HTML과 JavaScript 렌더링 후 화면의 핵심 제목·설명·구조화 정보가 같은 의미를 전달하도록 정합성 점검이 필요합니다.":
      "Check consistency so the initial HTML and rendered page communicate the same core title, description, and structured information.",
    "AI가 첫 응답만 보더라도 페이지 주제와 주요 서비스를 이해할 수 있도록 핵심 정보 보강이 필요합니다.":
      "Add core information so AI can understand the page topic and main service even from the first response.",
  };

  if (exact[value]) return exact[value];

  let translated = value
    .replace(
      /본문 글자 수가 ([0-9,]+)자에서 ([0-9,]+)자로 늘었습니다\./g,
      "Body text length increased from $1 chars to $2 chars.",
    )
    .replace(
      /내부 링크가 ([0-9,]+)개에서 ([0-9,]+)개로 늘었습니다\./g,
      "Internal links increased from $1 to $2.",
    );

  const fieldLabels: Record<string, string> = {
    "페이지 제목": "page title",
    "페이지 설명": "page description",
    "대표 제목(H1)": "main heading (H1)",
    "구조화 정보(JSON-LD)": "structured data (JSON-LD)",
    "핵심 본문": "core body text",
  };

  const translateFieldList = (value: string) =>
    value
      .split(", ")
      .map((item) => fieldLabels[item] ?? item)
      .join(", ");

  const mismatch = translated.match(
    /^(.+) 항목이 페이지가 처음 전달될 때와 화면이 완성된 뒤 서로 다릅니다\.$/,
  );

  if (mismatch) {
    return `${translateFieldList(
      mismatch[1],
    )} differs between the initial response and the completed rendered page.`;
  }

  const missing = translated.match(
    /^(.+) 항목을 초기 HTML에서 충분히 확인하지 못했습니다\.$/,
  );

  if (missing) {
    return `${translateFieldList(
      missing[1],
    )} was not sufficiently found in the initial HTML.`;
  }

  return translated;
}

function pointImpactLabel(
  finding: ScanResultFinding,
  locale: "ko" | "en" = "ko",
): string {
  const isEnglish = locale === "en";

  if (finding.weight <= 0 || finding.status === "NA") {
    return isEnglish ? "No score impact" : "점수 영향 없음";
  }

  return finding.status === "PASS"
    ? isEnglish
      ? `Earned ${finding.weight} pts`
      : `배점 ${finding.weight}점`
    : isEnglish
      ? `Lost ${finding.weight} pts`
      : `감점 ${finding.weight}점`;
}

function pointImpactDescription(
  finding: ScanResultFinding,
  locale: "ko" | "en" = "ko",
): string {
  const isEnglish = locale === "en";

  if (finding.weight <= 0 || finding.status === "NA") {
    return isEnglish
      ? "This item does not affect the current overall score."
      : "이 항목은 현재 종합 점수 계산에 영향을 주지 않습니다.";
  }

  if (finding.status === "PASS") {
    return isEnglish
      ? `This item passed and earned ${finding.weight} points for this rule.`
      : `통과하여 이 규칙의 배점 ${finding.weight}점을 획득했습니다.`;
  }

  return isEnglish
    ? `This item did not pass, so ${finding.weight} points for this rule were not earned.`
    : `통과하지 못해 이 규칙의 배점 ${finding.weight}점이 반영되지 않았습니다.`;
}

function translateUiErrorMessage(message: string, isEnglish: boolean): string {
  if (!isEnglish) return message;

  const exact: Record<string, string> = {
    "검사 결과를 불러오지 못했습니다.": "Could not load the scan result.",
    "검사 번호가 없습니다.": "No scan ID was provided.",
    "사이트와 검사 결과가 일치하지 않습니다.":
      "The site and scan result do not match.",
    "현재 기준으로 다시 진단하지 못했습니다.":
      "Could not run a new diagnostic with the current rules.",
    "상세 산출물 이용을 위해 결제 기능 연결이 필요합니다.":
      "Payment integration is required to access detailed deliverables.",
    "작업지시서를 만들지 못했습니다.": "Could not create the work order.",
  };

  return exact[message] ?? message;
}

function formatKST(value: string | null, isEnglish = false): string {
  if (!value) {
    return isEnglish ? "No record" : "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function messageFromError(error: unknown): string {
  return error instanceof SiteApiError
    ? error.message
    : "검사 결과를 불러오지 못했습니다.";
}

function evidenceText(value: unknown, isEnglish = false): string {
  if (value === null || value === undefined) {
    return isEnglish ? "No saved evidence" : "저장된 증거 없음";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function findingAnchor(ruleCode: string): string {
  return `finding-${ruleCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

type EvidenceRecord = Record<string, unknown>;

interface RenderedDomMetric {
  initial: number | null;
  rendered: number | null;
  delta: number | null;
}

interface RenderedDomComparisonView {
  status: string;
  browserVersion: string | null;
  durationMs: number | null;
  pageErrorCount: number | null;
  errorCode: string | null;
  message: string | null;
  textLength: RenderedDomMetric;
  internalLinks: RenderedDomMetric;
  h1Count: RenderedDomMetric;
  h2Count: RenderedDomMetric;
  jsonLdValidCount: RenderedDomMetric;
  initialTitle: string | null;
  renderedTitle: string | null;
  initialDescription: string | null;
  renderedDescription: string | null;
  initialH1: string[];
  renderedH1: string[];
  initialJsonLdTypes: string[];
  renderedJsonLdTypes: string[];
}

interface RenderedImprovementPlan {
  code: string;
  title: string;
  currentState: string;
  meaning: string;
  change: string;
  developerInstructions: string[];
  acceptanceCriteria: string[];
}

function evidenceRecord(value: unknown): EvidenceRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EvidenceRecord)
    : null;
}

function recordNumber(
  record: EvidenceRecord | null,
  key: string,
): number | null {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recordString(
  record: EvidenceRecord | null,
  key: string,
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedRecord(
  record: EvidenceRecord | null,
  key: string,
): EvidenceRecord | null {
  return evidenceRecord(record?.[key]);
}

function recordArrayLength(
  record: EvidenceRecord | null,
  key: string,
): number | null {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : null;
}

function recordStringArray(
  record: EvidenceRecord | null,
  key: string,
): string[] {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function renderedMetric(
  initial: number | null,
  rendered: number | null,
): RenderedDomMetric {
  return {
    initial,
    rendered,
    delta: initial === null || rendered === null ? null : rendered - initial,
  };
}

function renderedDomComparisonFromFindings(
  findings: ScanResultFinding[],
): RenderedDomComparisonView | null {
  const environment = findings.find(
    (finding) => finding.ruleCode === "ENV-MEASUREMENT-001",
  );
  const evidence = evidenceRecord(environment?.evidence);
  const renderedEvidence = nestedRecord(evidence, "renderedDom");

  if (!renderedEvidence) {
    return null;
  }

  const status = recordString(renderedEvidence, "status") ?? "UNKNOWN";
  const initial = nestedRecord(renderedEvidence, "initialHtml");
  const rendered = nestedRecord(renderedEvidence, "renderedDom");
  const initialLinks = nestedRecord(initial, "links");
  const renderedLinks = nestedRecord(rendered, "links");
  const initialHeadings = nestedRecord(initial, "headings");
  const renderedHeadings = nestedRecord(rendered, "headings");
  const initialJsonLd = nestedRecord(initial, "jsonLd");
  const renderedJsonLd = nestedRecord(rendered, "jsonLd");

  return {
    status,
    browserVersion: recordString(renderedEvidence, "browserVersion"),
    durationMs: recordNumber(renderedEvidence, "durationMs"),
    pageErrorCount: recordNumber(renderedEvidence, "pageErrorCount"),
    errorCode: recordString(renderedEvidence, "errorCode"),
    message: recordString(renderedEvidence, "message"),
    textLength: renderedMetric(
      recordNumber(initial, "textLength"),
      recordNumber(rendered, "textLength"),
    ),
    internalLinks: renderedMetric(
      recordNumber(initialLinks, "internal"),
      recordNumber(renderedLinks, "internal"),
    ),
    h1Count: renderedMetric(
      recordArrayLength(initialHeadings, "h1"),
      recordArrayLength(renderedHeadings, "h1"),
    ),
    h2Count: renderedMetric(
      recordNumber(initialHeadings, "h2Count"),
      recordNumber(renderedHeadings, "h2Count"),
    ),
    jsonLdValidCount: renderedMetric(
      recordNumber(initialJsonLd, "validCount"),
      recordNumber(renderedJsonLd, "validCount"),
    ),
    initialTitle: recordString(initial, "title"),
    renderedTitle: recordString(rendered, "title"),
    initialDescription: recordString(initial, "metaDescription"),
    renderedDescription: recordString(rendered, "metaDescription"),
    initialH1: recordStringArray(initialHeadings, "h1"),
    renderedH1: recordStringArray(renderedHeadings, "h1"),
    initialJsonLdTypes: recordStringArray(initialJsonLd, "types"),
    renderedJsonLdTypes: recordStringArray(renderedJsonLd, "types"),
  };
}

function normalizedText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedList(values: string[]): string {
  return [...values]
    .map((value) => normalizedText(value))
    .filter(Boolean)
    .sort()
    .join("|");
}

function buildRenderedImprovementPlans(
  comparison: RenderedDomComparisonView | null,
): RenderedImprovementPlan[] {
  if (!comparison || comparison.status !== "SUCCESS") {
    return [];
  }

  const plans: RenderedImprovementPlan[] = [];
  const textDelta = comparison.textLength.delta ?? 0;
  const linkDelta = comparison.internalLinks.delta ?? 0;
  const textInitial = comparison.textLength.initial ?? 0;
  const textGrowthRate =
    textInitial > 0 ? textDelta / textInitial : textDelta > 0 ? 1 : 0;
  const hasLargeAddedContent =
    textDelta >= 500 || textGrowthRate >= 0.25 || linkDelta >= 10;

  if (hasLargeAddedContent) {
    const stateParts = [
      comparison.textLength.initial !== null &&
      comparison.textLength.rendered !== null
        ? `본문 글자 수가 ${metricValue(
            comparison.textLength.initial,
            "자",
          )}에서 ${metricValue(
            comparison.textLength.rendered,
            "자",
          )}로 늘었습니다.`
        : null,
      comparison.internalLinks.initial !== null &&
      comparison.internalLinks.rendered !== null
        ? `내부 링크가 ${metricValue(
            comparison.internalLinks.initial,
            "개",
          )}에서 ${metricValue(
            comparison.internalLinks.rendered,
            "개",
          )}로 늘었습니다.`
        : null,
    ].filter((value): value is string => Boolean(value));

    plans.push({
      code: "RENDERED-ADDED-CONTENT",
      title: "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
      currentState:
        stateParts.join(" ") ||
        "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다.",
      meaning:
        "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.",
      change:
        "모든 화면 기능을 바꿀 필요는 없습니다. SSR, SSG 또는 사전 렌더링을 통해 AI가 처음 받는 HTML에도 서비스 정의, 대상 고객, 이용 절차, 요금·보안 정보, FAQ와 중요한 이동 링크가 실제 사용자 화면과 같은 의미로 포함되도록 수정합니다.",
      developerInstructions: [
        "이 항목은 8개의 독립 작업으로 나누기보다 SSR/SSG/사전 렌더링 도입 또는 랜딩 페이지 정적화를 중심 작업으로 묶어 처리해 주세요.",
        "초기 HTML에는 단순 글자 채우기가 아니라 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차를 자연스러운 본문 섹션으로 포함해 주세요.",
        "요금제 또는 무료·유료 이용 범위, 개인정보·입력자료 처리 방식, 운영 주체와 문의 경로를 초기 HTML에 1~2문장 이상 요약하고 관련 정책 페이지로 표준 a 링크를 제공해 주세요.",
        "실제 화면에 보이는 핵심 FAQ 3~4개를 만들고, 같은 질문·답변을 FAQPage JSON-LD로도 선언해 주세요.",
        "주요 내부 링크는 JavaScript 클릭 핸들러만 쓰지 말고 href가 있는 표준 a 링크로 초기 HTML에 제공해 주세요.",
        "필요하면 서버 렌더링(SSR), 정적 생성(SSG) 또는 사전 렌더링을 적용해 주세요.",
        "기존 디자인과 사용자 기능을 제거하거나 비활성화하지 마세요.",
      ],
      acceptanceCriteria: [
        "JavaScript 실행 전 HTML에서도 사이트의 핵심 소개와 주요 정보가 확인됩니다.",
        "초기 HTML만 확인해도 서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약을 이해할 수 있습니다.",
        "중요한 내부 페이지로 이동하는 일반 링크가 초기 HTML에 존재합니다.",
        "실제 화면 FAQ와 FAQPage JSON-LD의 질문·답변이 일치합니다.",
        "기존 화면 디자인과 사용자 기능이 정상적으로 동작합니다.",
        "재검사에서 초기 HTML과 렌더링 DOM의 본문·링크 격차가 줄어듭니다.",
      ],
    });
  }

  const mismatchedFields: string[] = [];

  if (
    normalizedText(comparison.initialTitle) !==
    normalizedText(comparison.renderedTitle)
  ) {
    mismatchedFields.push("페이지 제목");
  }

  if (
    normalizedText(comparison.initialDescription) !==
    normalizedText(comparison.renderedDescription)
  ) {
    mismatchedFields.push("페이지 설명");
  }

  if (
    normalizedList(comparison.initialH1) !==
    normalizedList(comparison.renderedH1)
  ) {
    mismatchedFields.push("대표 제목(H1)");
  }

  if (
    normalizedList(comparison.initialJsonLdTypes) !==
    normalizedList(comparison.renderedJsonLdTypes)
  ) {
    mismatchedFields.push("구조화 정보(JSON-LD)");
  }

  if (mismatchedFields.length > 0) {
    plans.push({
      code: "RENDERED-INCONSISTENT-INFORMATION",
      title: "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다",
      currentState: `${mismatchedFields.join(
        ", ",
      )} 항목이 페이지가 처음 전달될 때와 화면이 완성된 뒤 서로 다릅니다.`,
      meaning:
        "AI 검색 시스템에 따라 처음 받은 정보를 사용하기도 하고 화면 완성 후의 정보를 사용하기도 합니다. 값이 다르면 같은 페이지를 서로 다르게 이해할 수 있으며, B2B 서비스에서는 AI가 서비스명·기능·요금·데이터 처리 방식을 잘못 설명할 위험이 커집니다.",
      change:
        "글자 하나까지 완전히 같을 필요는 없지만 페이지 주제, 서비스명, 핵심 기능, 가격·요금, 개인정보·자료 처리 방식, 운영 주체처럼 중요한 사실과 의미는 처음과 나중이 일치하도록 맞춥니다.",
      developerInstructions: [
        "초기 HTML과 렌더링 DOM의 title, meta description, H1, JSON-LD 값을 비교해 주세요.",
        "클라이언트 실행 후 올바른 초기 값을 오래되거나 다른 값으로 덮어쓰는 코드를 수정해 주세요.",
        "WebApplication, Organization, WebSite, FAQPage 등 JSON-LD의 이름·URL·설명·FAQ 답변이 실제 화면 정보와 일치하도록 유지해 주세요.",
        "중복되거나 충돌하는 메타데이터 선언은 하나의 정확한 값으로 정리해 주세요.",
        "요금, 보안, 개인정보, 지원 범위처럼 구매 검토에 영향을 주는 정보는 화면 본문·메타데이터·JSON-LD가 서로 다른 의미로 말하지 않게 점검해 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML과 화면 완성 후의 페이지 제목과 설명이 같은 주제와 의미를 전달합니다.",
        "대표 제목과 구조화 정보의 핵심 사실이 실제 화면 내용과 일치합니다.",
        "FAQPage JSON-LD를 추가한 경우 실제 화면 FAQ와 질문·답변이 일치합니다.",
        "서로 충돌하거나 오래된 메타데이터가 남아 있지 않습니다.",
        "재검사에서 렌더링 전후 핵심정보 불일치가 사라집니다.",
      ],
    });
  }

  const missingInitial: string[] = [];

  if (!comparison.initialTitle) {
    missingInitial.push("페이지 제목");
  }

  if (!comparison.initialDescription) {
    missingInitial.push("페이지 설명");
  }

  if (comparison.h1Count.initial === 0) {
    missingInitial.push("대표 제목(H1)");
  }

  if ((comparison.textLength.initial ?? 0) < 300) {
    missingInitial.push("핵심 본문");
  }

  if (missingInitial.length > 0) {
    plans.push({
      code: "INITIAL-HTML-MISSING-CORE",
      title: "AI가 처음 받는 페이지에 핵심 정보가 부족합니다",
      currentState: `${missingInitial.join(
        ", ",
      )} 항목을 초기 HTML에서 충분히 확인하지 못했습니다.`,
      meaning:
        "사람은 화면을 둘러보며 내용을 이해할 수 있지만, 일부 AI 검색 봇은 처음 전달된 제목·설명·본문을 중심으로 사이트의 주제를 판단합니다.",
      change:
        "페이지를 처음 불러왔을 때도 사이트가 누구를 위한 곳이며 무엇을 제공하는지, 어떤 절차로 이용하는지, 요금·데이터 처리·FAQ는 어디서 확인할 수 있는지 알 수 있도록 핵심 소개와 주요 정보를 보완합니다.",
      developerInstructions: [
        "페이지별로 고유하고 구체적인 title과 meta description을 초기 HTML에 제공해 주세요.",
        "페이지의 주제를 설명하는 명확한 H1과 핵심 본문을 초기 HTML에 포함해 주세요.",
        "핵심 본문에는 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로를 포함해 주세요.",
        "중요한 콘텐츠 페이지, 요금제, 개인정보처리방침, 이용약관, 도움말·문의 페이지로 이동하는 일반 HTML 링크를 제공해 주세요.",
        "화면에 없는 내용을 검색 노출만을 위해 숨겨 넣지 말고 실제 사용자에게 보이는 정보와 일치시켜 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML만 확인해도 페이지의 주제와 주요 서비스가 이해됩니다.",
        "title, meta description, H1과 핵심 본문의 의미가 서로 일관됩니다.",
        "서비스 정의, 대상 고객, 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로가 사용자 화면과 초기 HTML에서 함께 확인됩니다.",
        "사용자에게 보이는 내용과 AI에 제공되는 핵심 정보가 일치합니다.",
        "재검사에서 누락된 초기 HTML 핵심 항목이 확인됩니다.",
      ],
    });
  }

  return plans;
}

function publicRenderedPlanChange(code: string, fallback: string): string {
  switch (code) {
    case "RENDERED-ADDED-CONTENT":
      return "초기 HTML에 핵심 본문과 주요 이동 경로가 충분히 포함되도록 렌더링 의존도를 줄이는 개선이 필요합니다.";
    case "RENDERED-INCONSISTENT-INFORMATION":
      return "초기 HTML과 JavaScript 렌더링 후 화면의 핵심 제목·설명·구조화 정보가 같은 의미를 전달하도록 정합성 점검이 필요합니다.";
    case "INITIAL-HTML-MISSING-CORE":
      return "AI가 첫 응답만 보더라도 페이지 주제와 주요 서비스를 이해할 수 있도록 핵심 정보 보강이 필요합니다.";
    default:
      return fallback;
  }
}

function metricValue(value: number | null, suffix = ""): string {
  const isEnglishMetric = suffix.startsWith(" ");

  if (value === null) {
    return isEnglishMetric ? "Unknown" : "미확인";
  }

  return `${value.toLocaleString(isEnglishMetric ? "en-US" : "ko-KR")}${suffix}`;
}

function metricDelta(value: number | null, suffix: string): string {
  const isEnglishMetric = suffix.startsWith(" ");

  if (value === null) {
    return isEnglishMetric ? "Change unknown" : "변화 미확인";
  }

  const sign = value > 0 ? "+" : "";
  return isEnglishMetric
    ? `Change ${sign}${value.toLocaleString("en-US")}${suffix}`
    : `변화 ${sign}${value.toLocaleString("ko-KR")}${suffix}`;
}

export function ScanResultPage() {
  const { state: authState } = useAuth();
  const canAccessPaidOutputs =
    authState.status === "authenticated" &&
    authState.user.role === "SUPER_ADMIN" &&
    authState.user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com";
  const isSuperAdmin =
    authState.status === "authenticated" &&
    authState.user.role === "SUPER_ADMIN";
  const { locale = "ko", siteId = "", scanId = "" } = useParams();
  const isEnglish = locale === "en";
  const navigate = useNavigate();
  const [refreshingRulesVersion, setRefreshingRulesVersion] = useState(false);
  const [rulesRefreshError, setRulesRefreshError] = useState("");
  const [result, setResult] = useState<ScanResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [workOrderError, setWorkOrderError] = useState("");
  const [creatingWorkOrder, setCreatingWorkOrder] = useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [
    selectedRenderedImprovementCodes,
    setSelectedRenderedImprovementCodes,
  ] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!scanId) {
      setErrorMessage(
        isEnglish ? "No scan ID was provided." : "검사 번호가 없습니다.",
      );
      setLoading(false);
      return;
    }

    void getScanResultRequest(scanId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (siteId && response.site.id !== siteId) {
          setErrorMessage(
            isEnglish
              ? "The site and scan result do not match."
              : "사이트와 검사 결과가 일치하지 않습니다.",
          );
          return;
        }

        setRulesRefreshError("");
        setResult(response);
        setSelectedFindingIds(
          response.primaryIssues
            .filter((finding) => finding.weight > 0)
            .map((finding) => finding.id),
        );
        setSelectedRenderedImprovementCodes(
          buildRenderedImprovementPlans(
            renderedDomComparisonFromFindings(response.findings),
          ).map((plan) => plan.code),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            translateUiErrorMessage(messageFromError(error), isEnglish),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scanId, siteId]);

  async function handleRefreshWithCurrentRules() {
    if (!result) {
      return;
    }

    setRefreshingRulesVersion(true);
    setRulesRefreshError("");

    try {
      const scan = await queueSiteScanRequest(result.site.id, "QUICK");
      navigate(`/${locale}/sites/${result.site.id}/scans/${scan.id}`);
    } catch (error) {
      setRulesRefreshError(
        error instanceof SiteApiError
          ? error.message
          : isEnglish
            ? "Could not run a new diagnostic with the current rules."
            : "현재 기준으로 다시 진단하지 못했습니다.",
      );
    } finally {
      setRefreshingRulesVersion(false);
    }
  }

  async function handleCreateWorkOrder() {
    const selectedCount =
      selectedFindingIds.length + selectedRenderedImprovementCodes.length;

    if (!result || selectedCount === 0) {
      setWorkOrderError(
        isEnglish
          ? "Payment integration is required to access detailed deliverables."
          : "상세 산출물 이용을 위해 결제 기능 연결이 필요합니다.",
      );
      return;
    }

    setCreatingWorkOrder(true);
    setWorkOrderError("");

    try {
      const workOrder = await createWorkOrderRequest({
        scanId: result.scan.id,
        findingIds: selectedFindingIds,
        renderedImprovementCodes: selectedRenderedImprovementCodes,
        locale: isEnglish ? "en" : "ko",
      });
      navigate(`/${locale}/work-orders/${workOrder.id}`);
    } catch (error) {
      setWorkOrderError(
        error instanceof WorkOrderApiError
          ? error.message
          : isEnglish
            ? "Could not create the work order."
            : "작업지시서를 만들지 못했습니다.",
      );
    } finally {
      setCreatingWorkOrder(false);
    }
  }

  function toggleWorkOrderFinding(findingId: string, checked: boolean) {
    setSelectedFindingIds((current) =>
      checked
        ? [...new Set([...current, findingId])]
        : current.filter((id) => id !== findingId),
    );
  }

  function toggleRenderedImprovement(planCode: string, checked: boolean) {
    setSelectedRenderedImprovementCodes((current) =>
      checked
        ? [...new Set([...current, planCode])]
        : current.filter((code) => code !== planCode),
    );
  }

  const groupedFindings = useMemo(() => {
    const groups = new Map<string, ScanResultFinding[]>();

    for (const finding of result?.findings ?? []) {
      const values = groups.get(finding.category) ?? [];
      values.push(finding);
      groups.set(finding.category, values);
    }

    return [...groups.entries()];
  }, [result]);

  const renderedDomComparison = useMemo(
    () => renderedDomComparisonFromFindings(result?.findings ?? []),
    [result],
  );
  const renderedImprovementPlans = useMemo(
    () => buildRenderedImprovementPlans(renderedDomComparison),
    [renderedDomComparison],
  );
  const selectedWorkOrderItemCount =
    selectedFindingIds.length + selectedRenderedImprovementCodes.length;

  if (loading) {
    return (
      <section className="full-bleed-section scan-result-section">
        <div className="content-container scan-result-loading" role="status">
          {isEnglish
            ? "Loading scan result."
            : "검사 결과를 불러오고 있습니다."}
        </div>
      </section>
    );
  }

  if (!result || errorMessage) {
    return (
      <section className="full-bleed-section scan-result-section">
        <div className="content-container scan-result-loading">
          <p className="scan-result-error" role="alert">
            {errorMessage ||
              (isEnglish
                ? "No scan result was found."
                : "검사 결과가 없습니다.")}
          </p>
          <Link className="scan-result-back" to={`/${locale}/sites`}>
            {isEnglish ? "Back to site dashboard" : "사이트 관리로 돌아가기"}
          </Link>
        </div>
      </section>
    );
  }

  const score = result.scan.score;
  const grade = result.scan.grade;
  const scoreSummary = result.scoreSummary;
  const missingInformationSummary = buildMissingInformationSummary(
    result.missingInformation,
  );
  const totalMissingInformationCount = result.missingInformation.length;
  const isOutdatedRulesVersion = result.isOutdatedRulesVersion;

  return (
    <section className="full-bleed-section scan-result-section">
      <div className="content-container scan-result-content">
        <header className="scan-result-header">
          <div>
            <p className="eyebrow">SCAN RESULT</p>
            <h1>
              {result.site.name}{" "}
              {isEnglish ? "Simple Diagnostic Result" : "간편진단 결과"}
            </h1>
            <p>
              {isEnglish
                ? "The QUICK score is calculated from the real HTTP response and initial HTML of the public URL. JavaScript rendering results are not directly included in the score; they are used for AI collection improvement suggestions and rendering comparison. Mobile/desktop comparison, industry-specific reference data, and question-answer accuracy are added in the deep diagnostic stage."
                : "공개 URL의 실제 HTTP 응답과 초기 HTML을 기준으로 QUICK 점수를 계산합니다. JavaScript 렌더링 결과는 점수에 직접 반영하지 않고 AI 수집 개선안과 렌더링 비교에 활용하며, 모바일·PC 별도 비교·업종별 기준정보·질문 정답률은 정밀진단 단계에서 추가됩니다."}
            </p>
          </div>
          <Link className="scan-result-back" to={`/${locale}/sites`}>
            {isEnglish ? "Site dashboard" : "사이트 관리로"}
          </Link>
        </header>

        {isOutdatedRulesVersion ? (
          <section className="surface scan-rules-version-alert" role="status">
            <div>
              <strong>
                {isEnglish
                  ? "This result was diagnosed with an older rule version."
                  : "이전 판단 기준으로 진단된 결과입니다."}
              </strong>
              <p>
                {isEnglish
                  ? `This result was calculated with ${result.scan.rulesVersion}. The current version is ${result.currentRulesVersion}. Because the evaluation rules have been updated, scores and improvement items may differ. We recommend running a new diagnostic with the current rules.`
                  : `이 결과는 ${result.scan.rulesVersion} 기준으로 계산되었습니다. 현재 기준은 ${result.currentRulesVersion}입니다. 판단 기준이 업데이트되어 점수와 개선 항목이 달라질 수 있으므로 현재 기준으로 다시 진단하는 것을 권장합니다.`}
              </p>
              {rulesRefreshError ? (
                <p className="scan-rules-version-error" role="alert">
                  {rulesRefreshError}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="scan-rules-version-button"
              onClick={handleRefreshWithCurrentRules}
              disabled={refreshingRulesVersion}
            >
              {refreshingRulesVersion
                ? isEnglish
                  ? "Starting new diagnostic..."
                  : "새 기준 진단 시작 중..."
                : isEnglish
                  ? "Re-diagnose with current rules"
                  : "새 기준으로 다시 진단하기"}
            </button>
          </section>
        ) : null}

        <section className="surface scan-score-hero">
          <div className="scan-score-main">
            <span>Site AI Score</span>
            <strong>
              {score === null ? "—" : Math.round(score)}
              <small>/100</small>
            </strong>
            <em>{grade ?? (isEnglish ? "Not calculated" : "미계산")}</em>
          </div>

          <dl className="scan-score-meta">
            <div>
              <dt>{isEnglish ? "Scan status" : "검사 상태"}</dt>
              <dd>{result.scan.status}</dd>
            </div>
            <div>
              <dt>{isEnglish ? "Rule version" : "규칙 버전"}</dt>
              <dd>{result.scan.rulesVersion}</dd>
            </div>
            <div>
              <dt>{isEnglish ? "Completed at (KST)" : "완료 시각(KST)"}</dt>
              <dd>{formatKST(result.scan.completedAt, isEnglish)}</dd>
            </div>
            <div>
              <dt>{isEnglish ? "Final URL" : "최종 URL"}</dt>
              <dd>
                <a
                  href={result.site.finalUrl ?? result.site.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.site.finalUrl ?? result.site.baseUrl}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {scoreSummary ? (
          <section className="surface scan-category-section">
            <div className="scan-section-heading">
              <div>
                <h2>{isEnglish ? "Scores by Category" : "영역별 점수"}</h2>
                <p>
                  {isEnglish
                    ? "The score is based on seven planned categories with a total of 100 points."
                    : "기획서의 7개 영역, 총 100점 배점입니다."}
                </p>
              </div>
              <span>
                {isEnglish ? "Measured rule coverage" : "현재 규칙 측정 범위"}{" "}
                {scoreSummary.coverage}%
              </span>
            </div>

            <div className="scan-category-grid">
              {scoreSummary.categories.map((category) => (
                <article className="scan-category-card" key={category.category}>
                  <div>
                    <strong>
                      {translateCategoryLabel(category.category, isEnglish)}
                    </strong>
                    <span>
                      {category.score}/{category.maxScore}
                      {isEnglish ? " pts" : "점"}
                    </span>
                  </div>
                  <div
                    className="scan-category-bar"
                    role="progressbar"
                    aria-label={`${translateCategoryLabel(category.category, isEnglish)} ${isEnglish ? "score" : "점수"}`}
                    aria-valuemin={0}
                    aria-valuemax={category.maxScore}
                    aria-valuenow={category.score}
                  >
                    <span
                      style={{
                        width: `${category.percentage}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>

            {scoreSummary.cap !== null ? (
              <p className="scan-cap-notice">
                {isEnglish
                  ? `A critical condition limited the final score to ${scoreSummary.cap} points or lower.`
                  : `치명적 조건으로 최종 점수가 ${scoreSummary.cap}점 이하로 제한되었습니다.`}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="surface scan-legacy-notice">
            {isEnglish
              ? "This result was created with an older rule version and has no score. Run a new simple diagnostic to calculate a score with the current rules."
              : "이 결과는 이전 규칙 버전으로 생성되어 점수가 없습니다. 새 간편검사를 실행하면 현재 규칙으로 점수를 계산합니다."}
          </section>
        )}

        <section className="surface scan-understanding-section">
          <div className="scan-section-heading">
            <div>
              <h2>
                {isEnglish ? "What AI Read from the Site" : "AI가 읽은 사이트"}
              </h2>
              <p>
                {isEnglish
                  ? "This is a summary of stored initial HTML evidence, not an LLM guess."
                  : "LLM의 추측이 아니라 저장된 초기 HTML 증거를 요약했습니다."}
              </p>
            </div>
          </div>
          <p className="scan-understanding-text">
            {translateStoredEvidenceText(
              result.understandingSummary,
              isEnglish,
            )}
          </p>

          <div className="scan-information-grid">
            <div>
              <h3>{isEnglish ? "Found Information" : "찾은 정보"}</h3>
              {result.foundInformation.length > 0 ? (
                <dl className="scan-information-list">
                  {result.foundInformation.map((item) => (
                    <div
                      key={`${item.label}-${translateStoredEvidenceText(item.value, isEnglish)}`}
                    >
                      <dt>{translateFoundLabel(item.label, isEnglish)}</dt>
                      <dd>
                        {translateStoredEvidenceText(item.value, isEnglish)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>
                  {isEnglish
                    ? "No key information to display."
                    : "표시할 핵심정보가 없습니다."}
                </p>
              )}
            </div>

            <div>
              <h3>
                {isEnglish ? "Improvement Item Summary" : "개선 필요 항목 요약"}
              </h3>
              {totalMissingInformationCount > 0 ? (
                <>
                  <dl className="scan-improvement-summary">
                    {missingInformationSummary.map((group) => (
                      <div
                        className="scan-improvement-summary-card"
                        key={group.key}
                      >
                        <dt>{isEnglish ? group.enLabel : group.koLabel}</dt>
                        <dd>
                          {isEnglish
                            ? `${group.count} ${group.count === 1 ? "item" : "items"} need improvement`
                            : `개선 필요 ${group.count}개`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="scan-improvement-summary-note">
                    {isEnglish
                      ? "Detailed improvement items and completion criteria are available in the detailed report or improvement work order."
                      : "자세한 개선 항목과 완료 기준은 상세 보고서 또는 수정 작업지시서에서 확인할 수 있습니다."}
                  </p>
                </>
              ) : (
                <p>
                  {isEnglish
                    ? "No improvement items were found under the current weighted rules."
                    : "현재 가중 규칙에서 개선 필요 항목이 없습니다."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="surface scan-issues-section">
          <div className="scan-section-heading">
            <div>
              <h2>
                {locale === "en"
                  ? "Detailed report example"
                  : "상세보고서 예시"}
              </h2>
              <p>
                {locale === "en"
                  ? "The detailed PDF report presents technical settings, structured data, content readiness issues, and inspection evidence in this format. This page shows only a summarized count and one high-priority example before payment."
                  : "상세 PDF 보고서에서는 기술 설정, 구조화 데이터, 콘텐츠·AI 답변 준비 항목의 문제와 검사 근거를 확인할 수 있습니다. 아래에는 중요도가 높은 예시 1개만 미리 보여드립니다."}
              </p>
            </div>
          </div>

          <div
            className="scan-finding-guide"
            role="note"
            aria-label={isEnglish ? "Diagnostic badge guide" : "진단 배지 안내"}
          >
            <strong>
              {isEnglish
                ? "How to Read Diagnostic Badges"
                : "진단 배지 읽는 법"}
            </strong>
            <dl>
              <div>
                <dt>{isEnglish ? "Status" : "판정"}</dt>
                <dd>
                  {isEnglish
                    ? "The actual inspection result, such as pass, fail, or blocked."
                    : "통과·실패·확인 불가 등 실제 검사 결과입니다."}
                </dd>
              </div>
              <div>
                <dt>{isEnglish ? "Severity" : "중요도"}</dt>
                <dd>
                  {isEnglish
                    ? "Shows the resolution priority from info to critical."
                    : "참고·낮음·주의·높음·매우 높음 순으로 해결 우선순위를 나타냅니다."}
                </dd>
              </div>
              <div>
                <dt>{isEnglish ? "Score impact" : "점수 영향"}</dt>
                <dd>
                  {isEnglish
                    ? "Passed items show earned points, while failed or blocked items show lost points."
                    : "통과한 항목은 배점, 실패·확인 불가 항목은 감점으로 표시합니다."}
                </dd>
              </div>
            </dl>
          </div>

          {result.primaryIssues.length > 0 ? (
            <div className="scan-issue-list">
              {result.primaryIssues.slice(0, 1).map((finding) => (
                <FindingCard
                  finding={finding}
                  key={finding.id}
                  locale={isEnglish ? "en" : "ko"}
                  primary
                  selectable={finding.weight > 0}
                  selected={selectedFindingIds.includes(finding.id)}
                  onToggle={toggleWorkOrderFinding}
                />
              ))}
            </div>
          ) : (
            <p className="scan-empty-message">
              {isEnglish
                ? "No items were classified as primary issues."
                : "주요 문제로 분류된 항목이 없습니다."}
            </p>
          )}

          {workOrderError ? (
            <p className="work-order-message work-order-error" role="alert">
              {workOrderError}
            </p>
          ) : null}
        </section>

        {renderedDomComparison ? (
          <section className="surface scan-rendered-section">
            <div className="scan-section-heading">
              <div>
                <h2>
                  {isEnglish
                    ? "Additional Technical Reference: JavaScript Rendering Comparison"
                    : "추가 기술 참고: JavaScript 렌더링 비교"}
                </h2>
                <p>
                  {isEnglish
                    ? "This compares how much the actual DOM expands after JavaScript runs in the browser."
                    : "브라우저에서 JavaScript를 실행한 뒤 실제 DOM이 얼마나 확장되는지 비교했습니다."}
                </p>
              </div>
              <span
                className={`scan-rendered-status scan-rendered-status-${renderedDomComparison.status.toLowerCase()}`}
              >
                {renderedDomComparison.status === "SUCCESS"
                  ? isEnglish
                    ? "Comparison complete"
                    : "비교 완료"
                  : renderedDomComparison.status === "FAILED"
                    ? isEnglish
                      ? "Comparison failed"
                      : "비교 실패"
                    : isEnglish
                      ? "Not compared"
                      : "비교 미실행"}
              </span>
            </div>

            {renderedDomComparison.status === "SUCCESS" ? (
              <>
                <div className="scan-rendered-grid">
                  {[
                    {
                      label: isEnglish ? "Body text length" : "본문 글자 수",
                      metric: renderedDomComparison.textLength,
                      suffix: isEnglish ? " chars" : "자",
                    },
                    {
                      label: isEnglish ? "Internal links" : "내부 링크",
                      metric: renderedDomComparison.internalLinks,
                      suffix: isEnglish ? " items" : "개",
                    },
                    {
                      label: "H1",
                      metric: renderedDomComparison.h1Count,
                      suffix: isEnglish ? " items" : "개",
                    },
                    {
                      label: "H2",
                      metric: renderedDomComparison.h2Count,
                      suffix: isEnglish ? " items" : "개",
                    },
                    {
                      label: isEnglish ? "Valid JSON-LD" : "유효 JSON-LD",
                      metric: renderedDomComparison.jsonLdValidCount,
                      suffix: isEnglish ? " items" : "개",
                    },
                  ].map((item) => (
                    <article className="scan-rendered-card" key={item.label}>
                      <h3>{item.label}</h3>
                      <div className="scan-rendered-values">
                        <div>
                          <span>
                            {isEnglish ? "Initial HTML" : "초기 HTML"}
                          </span>
                          <strong>
                            {metricValue(item.metric.initial, item.suffix)}
                          </strong>
                        </div>
                        <b aria-hidden="true">→</b>
                        <div>
                          <span>
                            {isEnglish ? "Rendered DOM" : "렌더링 DOM"}
                          </span>
                          <strong>
                            {metricValue(item.metric.rendered, item.suffix)}
                          </strong>
                        </div>
                      </div>
                      <p>{metricDelta(item.metric.delta, item.suffix)}</p>
                    </article>
                  ))}
                </div>

                <dl className="scan-rendered-meta">
                  <div>
                    <dt>{isEnglish ? "Browser" : "브라우저"}</dt>
                    <dd>
                      {renderedDomComparison.browserVersion ??
                        (isEnglish ? "Unknown" : "미확인")}
                    </dd>
                  </div>
                  <div>
                    <dt>{isEnglish ? "Rendering time" : "렌더링 시간"}</dt>
                    <dd>
                      {renderedDomComparison.durationMs === null
                        ? isEnglish
                          ? "Unknown"
                          : "미확인"
                        : isEnglish
                          ? `${(
                              renderedDomComparison.durationMs / 1_000
                            ).toFixed(1)} sec`
                          : `${(
                              renderedDomComparison.durationMs / 1_000
                            ).toFixed(1)}초`}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {isEnglish
                        ? "Page JavaScript errors"
                        : "페이지 JavaScript 오류"}
                    </dt>
                    <dd>
                      {metricValue(
                        renderedDomComparison.pageErrorCount,
                        isEnglish ? " errors" : "건",
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="scan-rendered-improvements">
                  <div>
                    <p className="eyebrow">RENDERING SUMMARY</p>
                    <h3>
                      {isEnglish
                        ? "JavaScript Rendering Comparison Notes"
                        : "JavaScript 렌더링 비교 참고 의견"}
                    </h3>
                    <p>
                      {isEnglish
                        ? "This explains what the comparison numbers mean and, when needed, summarizes improvement direction."
                        : "위 비교 수치가 뜻하는 바와 필요한 경우의 개선 방향을 함께 설명합니다."}
                    </p>
                  </div>

                  {renderedImprovementPlans.length > 0 ? (
                    <div className="scan-rendered-improvement-list">
                      {renderedImprovementPlans.slice(0, 1).map((plan) => (
                        <article
                          className={`scan-rendered-improvement-card${
                            selectedRenderedImprovementCodes.includes(plan.code)
                              ? " scan-rendered-improvement-selected"
                              : ""
                          }`}
                          key={plan.code}
                        >
                          <div className="scan-rendered-improvement-header">
                            <h4>
                              {translateRenderedText(plan.title, isEnglish)}
                            </h4>
                          </div>

                          <div className="scan-rendered-explanation">
                            <section>
                              <strong>
                                {isEnglish
                                  ? "Current state"
                                  : "현재 어떤 상태인가요?"}
                              </strong>
                              <p>
                                {translateRenderedText(
                                  plan.currentState,
                                  isEnglish,
                                )}
                              </p>
                            </section>
                            <section>
                              <strong>
                                {isEnglish ? "What it means" : "무슨 뜻인가요?"}
                              </strong>
                              <p>
                                {translateRenderedText(plan.meaning, isEnglish)}
                              </p>
                            </section>
                            <section>
                              <strong>
                                {isEnglish
                                  ? "Improvement summary"
                                  : "개선 방향 요약"}
                              </strong>
                              <p>
                                {translateRenderedText(
                                  publicRenderedPlanChange(
                                    plan.code,
                                    plan.change,
                                  ),
                                  isEnglish,
                                )}
                              </p>
                            </section>
                          </div>

                          <div className="scan-rendered-action-grid">
                            <section>
                              <h5>
                                {isEnglish
                                  ? "Diagnostic report scope"
                                  : "진단 보고서 제공 범위"}
                              </h5>
                              <p>
                                {isEnglish
                                  ? "This preview summarizes only the current state, impact, and improvement direction. Detailed implementation steps and completion criteria are provided in the work order."
                                  : "이 보고서는 현재 상태, 영향, 개선 방향만 요약합니다. 세부 구현 순서와 완료 기준은 작업지시서에서 제공합니다."}
                              </p>
                            </section>
                            <section>
                              <h5>
                                {locale === "en" ? "Next step" : "다음 단계"}
                              </h5>
                              <p>
                                {locale === "en"
                                  ? "Detailed next-step instructions and completion criteria are available in the paid diagnostic report and improvement work order after payment."
                                  : "세부 다음 단계와 완료 기준은 결제 후 제공되는 상세 보고서와 작업지시서에서 확인할 수 있습니다."}
                              </p>
                            </section>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="scan-rendered-no-improvement">
                      {isEnglish
                        ? "The core structure of the initial HTML and the completed rendered page is relatively similar. No separate improvement plan was generated from this comparison."
                        : "초기 HTML과 화면 완성 후의 핵심 구조가 비교적 비슷합니다. 현재 비교 결과에서 별도 개선안이 생성되지 않았습니다."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="scan-rendered-failure" role="status">
                <strong>
                  {renderedDomComparison.errorCode ??
                    renderedDomComparison.status}
                </strong>
                <p>
                  {renderedDomComparison.message ??
                    (isEnglish
                      ? "JavaScript rendering changes were not compared in this simple diagnostic. This is an auxiliary technical reference and not a required scoring item."
                      : "JavaScript 실행 후 화면 변화는 이번 간편진단에서 비교하지 않았습니다. 이 항목은 점수 산정 필수 항목이 아니라 보조 참고 자료입니다.")}
                </p>
              </div>
            )}

            <p className="scan-rendered-note">
              {isEnglish
                ? "Site AI Score calculates the score based on the initial HTML delivered first. JavaScript rendering results are used to create the comparison summary and improvement suggestions for AI environments that can read additional rendered content."
                : "Site AI Score는 처음 전달되는 초기 HTML을 기준으로 점수를 계산합니다. JavaScript 렌더링 결과는 추가 콘텐츠를 읽을 수 있는 AI 환경까지 고려해 위 비교 총평과 필요한 개선 제안을 만드는 데 활용합니다."}
            </p>
          </section>
        ) : null}

        <section className="surface scan-page-section">
          <div className="scan-section-heading">
            <div>
              <h2>
                {isEnglish
                  ? "Detailed Report and Work Order"
                  : "상세 보고서와 작업지시서"}
              </h2>
              <p>
                {isEnglish
                  ? "The simple diagnostic result page provides only the core score and key issue examples. After payment, you can access and save the detailed diagnostic PDF report and improvement work order."
                  : "간편진단 결과 화면은 핵심 점수와 개선 필요 항목 개수 요약만 제공합니다. 결제 후에는 기술 설정, 구조화 데이터, 콘텐츠·AI 답변 준비 상태를 상세 진단 PDF 보고서와 수정 작업지시서로 확인하고 저장할 수 있습니다."}
              </p>
            </div>
          </div>

          <div className="scan-paid-products-grid">
            <div
              className="work-order-selection scan-paid-product-card"
              role="note"
            >
              <strong>
                {isEnglish
                  ? "Detailed Diagnostic PDF Report"
                  : "상세 진단 PDF 보고서"}
              </strong>
              <p>
                {isEnglish
                  ? "The following items are provided in the detailed report based on the current site state."
                  : "현재 사이트 상태를 기준으로 기술 설정, 구조화 데이터, 콘텐츠·AI 답변 준비 개선 항목을 상세 보고서로 제공합니다."}
              </p>
              <ul className="scan-paid-feature-list">
                <li>
                  {isEnglish ? "Full diagnostic items" : "전체 진단 항목"}
                </li>
                <li>
                  {isEnglish
                    ? "Measurement evidence from collected pages"
                    : "수집 페이지의 측정 증거"}
                </li>
                <li>
                  {isEnglish
                    ? "Initial HTML and JavaScript rendering comparison"
                    : "초기 HTML과 JavaScript 렌더링 비교"}
                </li>
                <li>
                  {isEnglish
                    ? "Key issues and improvement direction"
                    : "주요 문제와 개선 방향"}
                </li>
              </ul>
            </div>

            <div
              className="work-order-selection scan-paid-product-card"
              role="note"
            >
              <strong>
                {isEnglish ? "Improvement Work Order" : "수정 작업지시서"}
              </strong>
              <p>
                {isEnglish
                  ? "The following items are organized into an actionable document for actually improving the website."
                  : "사이트를 실제로 수정할 수 있도록 아래 항목을 실행용 문서로 정리합니다."}
              </p>
              <ul className="scan-paid-feature-list">
                <li>{isEnglish ? "Work priorities" : "작업 우선순위"}</li>
                <li>
                  {isEnglish
                    ? "Developer handoff instructions"
                    : "개발자 전달 문구"}
                </li>
                <li>{isEnglish ? "Completion criteria" : "완료 판정 기준"}</li>
                <li>
                  {isEnglish
                    ? "Regression prevention and automated review criteria"
                    : "회귀 방지 기준과 자동검수 기준"}
                </li>
              </ul>
            </div>

            <div
              className="work-order-selection scan-paid-product-card scan-paid-followup-card"
              role="note"
            >
              <strong>
                {isEnglish
                  ? "Additional Post-Improvement Guidance"
                  : "개선 후 추가 제공"}
              </strong>
              <p>
                {isEnglish
                  ? "After site improvements and re-diagnosis, additional content suggestions may be provided so AI can answer more specific questions."
                  : "사이트 수정·업그레이드 후 재진단 결과를 바탕으로 AI가 더 구체적으로 답변할 수 있도록 보완 콘텐츠 제안을 추가로 제공합니다."}
              </p>
              <ul className="scan-paid-feature-list">
                <li>
                  {isEnglish
                    ? "Additional content suggestions for AI answers"
                    : "AI 답변을 위한 추가 콘텐츠 제안"}
                </li>
                <li>
                  {isEnglish
                    ? "Optional content improvements for the website operator"
                    : "운영자가 선택적으로 보완할 콘텐츠 제안"}
                </li>
                <li>
                  {isEnglish
                    ? "Re-diagnostic criteria for before-and-after comparison"
                    : "개선 전후 비교를 위한 재진단 기준 안내"}
                </li>
              </ul>
            </div>
          </div>

          <div className="scan-paywall-button-wrap">
            {canAccessPaidOutputs ? (
              <div
                className="scan-admin-actions"
                role="group"
                aria-label={
                  isEnglish ? "Super admin deliverables" : "수퍼관리자 산출물"
                }
              >
                <a
                  className="scan-report-link"
                  href={scanResultPdfUrl(
                    result.scan.id,
                    isEnglish ? "en" : "ko",
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {isEnglish
                    ? "Detailed Diagnostic Report"
                    : "상세 진단 보고서"}
                </a>
                <button
                  className="scan-report-link secondary"
                  type="button"
                  onClick={handleCreateWorkOrder}
                  disabled={
                    creatingWorkOrder || selectedWorkOrderItemCount === 0
                  }
                >
                  {creatingWorkOrder
                    ? isEnglish
                      ? "Creating work order..."
                      : "작업지시서 생성 중..."
                    : selectedWorkOrderItemCount > 0
                      ? isEnglish
                        ? "Create Work Order"
                        : "작업지시서 생성"
                      : isEnglish
                        ? "No work order items"
                        : "작업지시서 대상 없음"}
                </button>
                <Link
                  className="scan-report-link ghost"
                  to={`/${locale}/work-orders`}
                >
                  {isEnglish ? "Work Orders" : "작업지시서 목록"}
                </Link>
              </div>
            ) : (
              <div
                className="scan-admin-actions"
                role="group"
                aria-label={
                  isEnglish ? "Paid deliverables guide" : "유료 산출물 안내"
                }
              >
                <button
                  className="scan-report-link scan-paid-locked-action"
                  type="button"
                  disabled
                >
                  {isEnglish
                    ? "Detailed Diagnostic Report"
                    : "상세 진단 보고서"}
                </button>
                <button
                  className="scan-report-link secondary scan-paid-locked-action"
                  type="button"
                  disabled
                >
                  {isEnglish ? "Create Work Order" : "작업지시서 생성"}
                </button>
                <Link
                  className="scan-report-link ghost"
                  to={`/${locale}/work-orders`}
                >
                  {isEnglish ? "Work Orders" : "작업지시서 목록"}
                </Link>
              </div>
            )}

            <Link
              className="primary"
              to={`/${locale}/checkout?scanId=${encodeURIComponent(
                result.scan.id,
              )}`}
            >
              {isEnglish ? "Proceed to Payment" : "결제하기"}
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}

function FindingCard({
  finding,
  locale = "ko",
  primary = false,
  selectable = false,
  selected = false,
  onToggle,
}: {
  finding: ScanResultFinding;
  locale?: "ko" | "en";
  primary?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (findingId: string, checked: boolean) => void;
}) {
  const isEnglish = locale === "en";
  const statusLabel = isEnglish
    ? englishStatusLabels[finding.status]
    : statusLabels[finding.status];
  const severityLabel = isEnglish
    ? englishSeverityLabels[finding.severity]
    : severityLabels[finding.severity];
  const severityDescription = isEnglish
    ? englishSeverityDescriptions[finding.severity]
    : severityDescriptions[finding.severity];

  return (
    <article
      className={`scan-finding-card scan-status-${finding.status.toLowerCase()}${
        primary ? " scan-finding-primary" : ""
      }`}
      id={findingAnchor(finding.ruleCode)}
    >
      <div className="scan-finding-header">
        <div>
          <span>{finding.ruleCode}</span>
          <h4>{translateFindingTitle(finding.title, isEnglish)}</h4>
        </div>
        <div
          className="scan-finding-badges"
          aria-label={
            isEnglish
              ? "Diagnostic status and score impact"
              : "진단 판정과 점수 영향"
          }
        >
          <span
            className={`scan-badge scan-badge-status scan-badge-status-${finding.status.toLowerCase()}`}
            title={`${isEnglish ? "Status" : "판정"}: ${statusLabel}`}
          >
            {isEnglish ? "Status" : "판정"} · {statusLabel}
          </span>
          <span
            className={`scan-badge scan-badge-severity scan-badge-severity-${finding.severity.toLowerCase()}`}
            title={severityDescription}
          >
            {isEnglish ? "Severity" : "중요도"} · {severityLabel}
          </span>
          <span
            className={`scan-badge scan-badge-points ${
              finding.weight <= 0 || finding.status === "NA"
                ? "scan-badge-points-none"
                : finding.status === "PASS"
                  ? "scan-badge-points-earned"
                  : "scan-badge-points-lost"
            }`}
            title={pointImpactDescription(finding, locale)}
          >
            {pointImpactLabel(finding, locale)}
          </span>
        </div>
      </div>

      <p>{translateDiagnosticText(finding.description, isEnglish)}</p>

      {finding.recommendation ? (
        <div className="scan-recommendation">
          <strong>{isEnglish ? "Recommended fix" : "수정 권장사항"}</strong>
          <p>{translateDiagnosticText(finding.recommendation, isEnglish)}</p>
        </div>
      ) : null}

      <div className="scan-evidence-inline">
        <strong>{isEnglish ? "Inspection evidence" : "검사 증거"}</strong>
        <pre>{evidenceText(finding.evidence, isEnglish)}</pre>
      </div>
    </article>
  );
}
