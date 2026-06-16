import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type {
  PublicScanResult,
  PublicScanResultFinding,
} from "./scan-result-service";

const FONT_NAME = "SiteAiScoreReportFont";
export const SCAN_RESULT_PDF_RENDERER_VERSION =
  "2026.06-scan-report-v6";

let cachedFontHash: string | undefined;

const COLORS = {
  primary: "#3157E5",
  primaryDark: "#243B91",
  primarySoft: "#EEF2FF",
  text: "#172033",
  muted: "#64748B",
  border: "#DCE3EE",
  surface: "#F8FAFC",
  white: "#FFFFFF",
  pass: "#166534",
  passSoft: "#F0FDF4",
  fail: "#B91C1C",
  failSoft: "#FEF2F2",
  blocked: "#92400E",
  blockedSoft: "#FFF7ED",
  neutral: "#475569",
  neutralSoft: "#F8FAFC",
};

const STATUS_LABELS: Record<PublicScanResultFinding["status"], string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const SEVERITY_LABELS: Record<
  PublicScanResultFinding["severity"],
  string
> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

function fontPaths(): string[] {
  return [
    join(
      process.cwd(),
      "dist",
      "assets",
      "fonts",
      "DungGeunMo.ttf",
    ),
    join(
      process.cwd(),
      "server",
      "assets",
      "fonts",
      "DungGeunMo.ttf",
    ),
  ];
}

function requireFontPath(): string {
  const candidates = fontPaths();
  const value = candidates.find((candidate) => existsSync(candidate));

  if (!value) {
    throw new Error(
      `PDF 한글 글꼴을 찾을 수 없습니다: ${candidates.join(", ")}`,
    );
  }

  return value;
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function formatKST(value: string | null): string {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function contentWidth(document: PDFKit.PDFDocument): number {
  return (
    document.page.width -
    document.page.margins.left -
    document.page.margins.right
  );
}

function bottomLimit(document: PDFKit.PDFDocument): number {
  return document.page.height - document.page.margins.bottom - 26;
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  requiredHeight: number,
): void {
  if (document.y + requiredHeight > bottomLimit(document)) {
    document.addPage();
  }
}

function setText(
  document: PDFKit.PDFDocument,
  size = 9.2,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document.font(FONT_NAME).fontSize(size).fillColor(color);
}

function writeSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
): void {
  ensureSpace(document, subtitle ? 48 : 34);
  setText(document, 14, COLORS.text).text(cleanText(title), {
    width: contentWidth(document),
  });

  if (subtitle) {
    document.moveDown(0.2);
    setText(document, 8.2, COLORS.muted).text(cleanText(subtitle), {
      width: contentWidth(document),
      lineGap: 2,
    });
  }

  document
    .moveDown(0.4)
    .strokeColor(COLORS.border)
    .lineWidth(0.7)
    .moveTo(document.page.margins.left, document.y)
    .lineTo(
      document.page.width - document.page.margins.right,
      document.y,
    )
    .stroke()
    .moveDown(0.65);
}

function writeLabelValue(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  const width = contentWidth(document);
  const labelWidth = 112;
  const safeValue = cleanText(value) || "-";

  setText(document, 9);
  const valueHeight = document.heightOfString(safeValue, {
    width: width - labelWidth,
    lineGap: 2,
  });
  const rowHeight = Math.max(18, valueHeight + 3);

  ensureSpace(document, rowHeight + 5);
  const x = document.page.margins.left;
  const y = document.y;

  setText(document, 8.1, COLORS.muted).text(cleanText(label), x, y, {
    width: labelWidth - 12,
    lineBreak: false,
  });
  setText(document, 9, COLORS.text).text(
    safeValue,
    x + labelWidth,
    y,
    {
      width: width - labelWidth,
      lineGap: 2,
    },
  );

  document.y = y + rowHeight + 5;
}

function writeTextBox(
  document: PDFKit.PDFDocument,
  title: string,
  text: string,
  options: {
    background?: string;
    border?: string;
    accent?: string;
    fontSize?: number;
    maxCharacters?: number;
  } = {},
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const padding = 14;
  const titleHeight = 15;
  const maxCharacters = options.maxCharacters ?? 5_000;
  const original = cleanText(text) || "-";
  const safeText =
    original.length > maxCharacters
      ? `${original.slice(0, maxCharacters)}\n\n[문서 길이를 위해 이후 증거는 생략했습니다.]`
      : original;
  const fontSize = options.fontSize ?? 9.1;

  setText(document, fontSize);
  const bodyHeight = document.heightOfString(safeText, {
    width: width - padding * 2,
    lineGap: 3,
  });
  const boxHeight = padding + titleHeight + 7 + bodyHeight + padding;
  const usableHeight =
    document.page.height -
    document.page.margins.top -
    document.page.margins.bottom -
    40;

  if (
    boxHeight <= usableHeight &&
    document.y + boxHeight + 12 > bottomLimit(document)
  ) {
    document.addPage();
  } else {
    ensureSpace(document, Math.min(boxHeight + 12, usableHeight));
  }

  const y = document.y;

  document
    .roundedRect(x, y, width, boxHeight, 8)
    .fillAndStroke(
      options.background ?? COLORS.surface,
      options.border ?? COLORS.border,
    );

  if (options.accent) {
    document.roundedRect(x, y, 4, boxHeight, 2).fill(options.accent);
  }

  setText(document, 8.5, COLORS.muted).text(
    cleanText(title),
    x + padding,
    y + padding,
    {
      width: width - padding * 2,
      lineBreak: false,
    },
  );

  setText(document, fontSize, COLORS.text).text(
    safeText,
    x + padding,
    y + padding + titleHeight + 7,
    {
      width: width - padding * 2,
      lineGap: 3,
    },
  );

  document.y = y + boxHeight + 12;
}

function statusColors(
  status: PublicScanResultFinding["status"],
): {
  text: string;
  soft: string;
} {
  if (status === "PASS") {
    return { text: COLORS.pass, soft: COLORS.passSoft };
  }

  if (status === "FAIL") {
    return { text: COLORS.fail, soft: COLORS.failSoft };
  }

  if (status === "BLOCKED") {
    return { text: COLORS.blocked, soft: COLORS.blockedSoft };
  }

  return { text: COLORS.neutral, soft: COLORS.neutralSoft };
}

function pointImpact(finding: PublicScanResultFinding): string {
  if (finding.weight <= 0 || finding.status === "NA") {
    return "점수 영향 없음";
  }

  return finding.status === "PASS"
    ? `배점 ${finding.weight}점 획득`
    : `배점 ${finding.weight}점 미반영`;
}

function sanitizeSensitiveString(value: string): string {
  return value
    .replace(
      /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
      "Bearer [보안상 숨김]",
    )
    .replace(
      /(\b(?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n,;]+/gi,
      "$1[보안상 숨김]",
    )
    .replace(
      /(\b(?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi,
      "$1[보안상 숨김]",
    )
    .replace(
      /(\b(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      "$1[보안상 숨김]",
    );
}

export function sanitizeEvidenceValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidenceValue(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[순환 참조]";
    }

    seen.add(value);
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (
        /authorization|cookie|set-cookie|password|secret|token/i.test(
          key,
        )
      ) {
        result[key] = "[보안상 숨김]";
      } else {
        result[key] = sanitizeEvidenceValue(item, seen);
      }
    }

    return result;
  }

  return cleanText(value);
}

export function sanitizeScanResultForPdf(
  result: PublicScanResult,
): PublicScanResult {
  const sanitizeFinding = (
    finding: PublicScanResultFinding,
  ): PublicScanResultFinding => ({
    ...finding,
    evidence: sanitizeEvidenceValue(finding.evidence),
  });

  return {
    ...result,
    primaryIssues: result.primaryIssues.map(sanitizeFinding),
    findings: result.findings.map(sanitizeFinding),
  };
}

function evidenceText(value: unknown): string {
  if (value === null || value === undefined) {
    return "저장된 검사 증거가 없습니다.";
  }

  try {
    return cleanText(
      JSON.stringify(sanitizeEvidenceValue(value), null, 2),
    );
  } catch {
    return cleanText(value);
  }
}

type EvidenceObject = Record<string, unknown>;

export interface ScanResultRenderedDomComparison {
  status: string;
  browserVersion: string | null;
  durationMs: number | null;
  pageErrorCount: number | null;
  errorCode: string | null;
  message: string | null;
  metrics: {
    textLength: {
      initial: number | null;
      rendered: number | null;
    };
    internalLinks: {
      initial: number | null;
      rendered: number | null;
    };
    h1Count: {
      initial: number | null;
      rendered: number | null;
    };
    h2Count: {
      initial: number | null;
      rendered: number | null;
    };
    jsonLdValidCount: {
      initial: number | null;
      rendered: number | null;
    };
  };
  initialTitle: string | null;
  renderedTitle: string | null;
  initialDescription: string | null;
  renderedDescription: string | null;
  initialH1: string[];
  renderedH1: string[];
  initialJsonLdTypes: string[];
  renderedJsonLdTypes: string[];
}

export interface RenderedDomImprovementPlan {
  code: string;
  title: string;
  currentState: string;
  meaning: string;
  change: string;
  developerInstructions: string[];
  acceptanceCriteria: string[];
}

function evidenceObject(value: unknown): EvidenceObject | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as EvidenceObject)
    : null;
}

function objectNumber(
  record: EvidenceObject | null,
  key: string,
): number | null {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function objectString(
  record: EvidenceObject | null,
  key: string,
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function objectChild(
  record: EvidenceObject | null,
  key: string,
): EvidenceObject | null {
  return evidenceObject(record?.[key]);
}

function objectArrayLength(
  record: EvidenceObject | null,
  key: string,
): number | null {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : null;
}

function objectStringArray(
  record: EvidenceObject | null,
  key: string,
): string[] {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" && Boolean(item.trim()),
  );
}

export function scanResultRenderedDomComparison(
  result: {
    findings: readonly {
      ruleCode: string;
      evidence: unknown;
    }[];
  },
): ScanResultRenderedDomComparison | null {
  const finding = result.findings.find(
    (item) => item.ruleCode === "ENV-MEASUREMENT-001",
  );
  const evidence = evidenceObject(finding?.evidence);
  const renderedEvidence = objectChild(evidence, "renderedDom");

  if (!renderedEvidence) {
    return null;
  }

  const initial = objectChild(renderedEvidence, "initialHtml");
  const rendered = objectChild(renderedEvidence, "renderedDom");
  const initialLinks = objectChild(initial, "links");
  const renderedLinks = objectChild(rendered, "links");
  const initialHeadings = objectChild(initial, "headings");
  const renderedHeadings = objectChild(rendered, "headings");
  const initialJsonLd = objectChild(initial, "jsonLd");
  const renderedJsonLd = objectChild(rendered, "jsonLd");

  return {
    status: objectString(renderedEvidence, "status") ?? "UNKNOWN",
    browserVersion: objectString(
      renderedEvidence,
      "browserVersion",
    ),
    durationMs: objectNumber(renderedEvidence, "durationMs"),
    pageErrorCount: objectNumber(
      renderedEvidence,
      "pageErrorCount",
    ),
    errorCode: objectString(renderedEvidence, "errorCode"),
    message: objectString(renderedEvidence, "message"),
    metrics: {
      textLength: {
        initial: objectNumber(initial, "textLength"),
        rendered: objectNumber(rendered, "textLength"),
      },
      internalLinks: {
        initial: objectNumber(initialLinks, "internal"),
        rendered: objectNumber(renderedLinks, "internal"),
      },
      h1Count: {
        initial: objectArrayLength(initialHeadings, "h1"),
        rendered: objectArrayLength(renderedHeadings, "h1"),
      },
      h2Count: {
        initial: objectNumber(initialHeadings, "h2Count"),
        rendered: objectNumber(renderedHeadings, "h2Count"),
      },
      jsonLdValidCount: {
        initial: objectNumber(initialJsonLd, "validCount"),
        rendered: objectNumber(renderedJsonLd, "validCount"),
      },
    },
    initialTitle: objectString(initial, "title"),
    renderedTitle: objectString(rendered, "title"),
    initialDescription: objectString(
      initial,
      "metaDescription",
    ),
    renderedDescription: objectString(
      rendered,
      "metaDescription",
    ),
    initialH1: objectStringArray(initialHeadings, "h1"),
    renderedH1: objectStringArray(renderedHeadings, "h1"),
    initialJsonLdTypes: objectStringArray(initialJsonLd, "types"),
    renderedJsonLdTypes: objectStringArray(renderedJsonLd, "types"),
  };
}

function normalizedComparisonText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedComparisonList(values: string[]): string {
  return [...values]
    .map((value) => normalizedComparisonText(value))
    .filter(Boolean)
    .sort()
    .join("|");
}

function displayMetric(
  value: number | null,
  suffix: string,
): string {
  return value === null
    ? "미확인"
    : `${value.toLocaleString("ko-KR")}${suffix}`;
}

export function buildRenderedDomImprovementPlans(
  comparison: ScanResultRenderedDomComparison | null,
): RenderedDomImprovementPlan[] {
  if (!comparison || comparison.status !== "SUCCESS") {
    return [];
  }

  const plans: RenderedDomImprovementPlan[] = [];
  const textInitial = comparison.metrics.textLength.initial ?? 0;
  const textRendered = comparison.metrics.textLength.rendered ?? 0;
  const linkInitial = comparison.metrics.internalLinks.initial ?? 0;
  const linkRendered = comparison.metrics.internalLinks.rendered ?? 0;
  const textDelta = textRendered - textInitial;
  const linkDelta = linkRendered - linkInitial;
  const textGrowthRate =
    textInitial > 0 ? textDelta / textInitial : textDelta > 0 ? 1 : 0;

  if (
    textDelta >= 500 ||
    textGrowthRate >= 0.25 ||
    linkDelta >= 10
  ) {
    const stateParts = [
      comparison.metrics.textLength.initial !== null &&
      comparison.metrics.textLength.rendered !== null
        ? `본문 글자 수가 ${displayMetric(
            comparison.metrics.textLength.initial,
            "자",
          )}에서 ${displayMetric(
            comparison.metrics.textLength.rendered,
            "자",
          )}로 늘었습니다.`
        : null,
      comparison.metrics.internalLinks.initial !== null &&
      comparison.metrics.internalLinks.rendered !== null
        ? `내부 링크가 ${displayMetric(
            comparison.metrics.internalLinks.initial,
            "개",
          )}에서 ${displayMetric(
            comparison.metrics.internalLinks.rendered,
            "개",
          )}로 늘었습니다.`
        : null,
    ].filter((value): value is string => Boolean(value));

    plans.push({
      code: "RENDERED-ADDED-CONTENT",
      title:
        "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
      currentState:
        stateParts.join(" ") ||
        "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다.",
      meaning:
        "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.",
      change:
        "모든 화면 기능을 바꿀 필요는 없습니다. 사이트 소개, 주요 서비스, 핵심 정보와 중요한 이동 링크처럼 AI가 사이트를 이해하는 데 필요한 내용만 처음 전달되는 페이지에도 포함되도록 수정합니다.",
      developerInstructions: [
        "핵심 본문과 주요 내부 링크를 초기 HTML에도 출력해 주세요.",
        "필요하면 서버 렌더링(SSR), 정적 생성(SSG) 또는 사전 렌더링을 적용해 주세요.",
        "슬라이더·지도·애니메이션·개인화 기능처럼 부가적인 화면 기능은 기존 JavaScript 방식을 유지할 수 있습니다.",
        "기존 디자인과 사용자 기능을 제거하거나 비활성화하지 마세요.",
      ],
      acceptanceCriteria: [
        "JavaScript 실행 전 HTML에서도 사이트의 핵심 소개와 주요 정보가 확인됩니다.",
        "중요한 내부 페이지로 이동하는 일반 링크가 초기 HTML에 존재합니다.",
        "기존 화면 디자인과 사용자 기능이 정상적으로 동작합니다.",
        "재검사에서 초기 HTML과 렌더링 DOM의 본문·링크 격차가 줄어듭니다.",
      ],
    });
  }

  const mismatchedFields: string[] = [];

  if (
    normalizedComparisonText(comparison.initialTitle) !==
    normalizedComparisonText(comparison.renderedTitle)
  ) {
    mismatchedFields.push("페이지 제목");
  }

  if (
    normalizedComparisonText(comparison.initialDescription) !==
    normalizedComparisonText(comparison.renderedDescription)
  ) {
    mismatchedFields.push("페이지 설명");
  }

  if (
    normalizedComparisonList(comparison.initialH1) !==
    normalizedComparisonList(comparison.renderedH1)
  ) {
    mismatchedFields.push("대표 제목(H1)");
  }

  if (
    normalizedComparisonList(comparison.initialJsonLdTypes) !==
    normalizedComparisonList(comparison.renderedJsonLdTypes)
  ) {
    mismatchedFields.push("구조화 정보(JSON-LD)");
  }

  if (mismatchedFields.length > 0) {
    plans.push({
      code: "RENDERED-INCONSISTENT-INFORMATION",
      title:
        "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다",
      currentState: `${mismatchedFields.join(
        ", ",
      )} 항목이 페이지가 처음 전달될 때와 화면이 완성된 뒤 서로 다릅니다.`,
      meaning:
        "AI 검색 시스템에 따라 처음 받은 정보를 사용하기도 하고 화면 완성 후의 정보를 사용하기도 합니다. 값이 다르면 같은 페이지를 서로 다르게 이해할 수 있습니다.",
      change:
        "글자 하나까지 완전히 같을 필요는 없지만 페이지 주제, 상호명, 서비스명, 주소, 가격, 운영시간처럼 중요한 사실과 의미는 처음과 나중이 일치하도록 맞춥니다.",
      developerInstructions: [
        "초기 HTML과 렌더링 DOM의 title, meta description, H1, JSON-LD 값을 비교해 주세요.",
        "클라이언트 실행 후 올바른 초기 값을 오래되거나 다른 값으로 덮어쓰는 코드를 수정해 주세요.",
        "JSON-LD의 이름·URL·주소·운영시간이 실제 화면 정보와 일치하도록 유지해 주세요.",
        "중복되거나 충돌하는 메타데이터 선언은 하나의 정확한 값으로 정리해 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML과 화면 완성 후의 페이지 제목과 설명이 같은 주제와 의미를 전달합니다.",
        "대표 제목과 구조화 정보의 핵심 사실이 실제 화면 내용과 일치합니다.",
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

  if (comparison.metrics.h1Count.initial === 0) {
    missingInitial.push("대표 제목(H1)");
  }

  if ((comparison.metrics.textLength.initial ?? 0) < 300) {
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
        "페이지를 처음 불러왔을 때도 사이트가 누구를 위한 곳이며 무엇을 제공하는지 알 수 있도록 핵심 소개와 주요 정보를 보완합니다.",
      developerInstructions: [
        "페이지별로 고유하고 구체적인 title과 meta description을 초기 HTML에 제공해 주세요.",
        "페이지의 주제를 설명하는 명확한 H1과 핵심 본문을 초기 HTML에 포함해 주세요.",
        "중요한 콘텐츠 페이지로 이동하는 일반 HTML 링크를 제공해 주세요.",
        "화면에 없는 내용을 검색 노출만을 위해 숨겨 넣지 말고 실제 사용자에게 보이는 정보와 일치시켜 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML만 확인해도 페이지의 주제와 주요 서비스가 이해됩니다.",
        "title, meta description, H1과 핵심 본문의 의미가 서로 일관됩니다.",
        "사용자에게 보이는 내용과 AI에 제공되는 핵심 정보가 일치합니다.",
        "재검사에서 누락된 초기 HTML 핵심 항목이 확인됩니다.",
      ],
    });
  }

  return plans;
}

function comparisonMetricText(
  label: string,
  metric: {
    initial: number | null;
    rendered: number | null;
  },
  suffix: string,
): string {
  const display = (value: number | null) =>
    value === null
      ? "미확인"
      : `${value.toLocaleString("ko-KR")}${suffix}`;
  const delta =
    metric.initial === null || metric.rendered === null
      ? "변화 미확인"
      : `변화 ${
          metric.rendered - metric.initial > 0 ? "+" : ""
        }${(
          metric.rendered - metric.initial
        ).toLocaleString("ko-KR")}${suffix}`;

  return `${label}: ${display(metric.initial)} → ${display(
    metric.rendered,
  )} (${delta})`;
}

function writeCover(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const top = document.page.margins.top;

  document
    .roundedRect(x, top, width, 128, 12)
    .fill(COLORS.primary);

  setText(document, 10, COLORS.white).text(
    "SITE AI SCORE",
    x + 22,
    top + 18,
    {
      width: width - 44,
      characterSpacing: 1.2,
    },
  );

  setText(document, 24, COLORS.white).text(
    `${cleanText(result.site.name)} 진단 보고서`,
    x + 22,
    top + 43,
    {
      width: width - 44,
      lineGap: 3,
    },
  );

  setText(document, 8.6, "#DDE5FF").text(
    `${cleanText(result.scan.id)} / ${cleanText(
      result.scan.rulesVersion,
    )}`,
    x + 22,
    top + 96,
    {
      width: width - 44,
    },
  );

  document.y = top + 151;

  const gap = 12;
  const cardWidth = (width - gap) / 2;
  const cardY = document.y;
  const cardHeight = 88;

  document
    .roundedRect(x, cardY, cardWidth, cardHeight, 10)
    .fillAndStroke(COLORS.white, COLORS.border);

  document
    .roundedRect(
      x + cardWidth + gap,
      cardY,
      cardWidth,
      cardHeight,
      10,
    )
    .fillAndStroke(COLORS.primarySoft, "#C7D2FE");

  setText(document, 8.3, COLORS.muted).text(
    "Site AI Score",
    x + 14,
    cardY + 14,
    {
      width: cardWidth - 28,
    },
  );

  setText(document, 29, COLORS.text).text(
    result.scan.score === null
      ? "-"
      : String(Math.round(result.scan.score)),
    x + 14,
    cardY + 35,
    {
      width: cardWidth - 86,
      lineBreak: false,
    },
  );

  setText(document, 12, COLORS.primaryDark).text(
    cleanText(result.scan.grade ?? "미계산"),
    x + cardWidth - 65,
    cardY + 47,
    {
      width: 50,
      align: "right",
      lineBreak: false,
    },
  );

  setText(document, 8.3, COLORS.primaryDark).text(
    "측정 범위와 개선 가능성",
    x + cardWidth + gap + 14,
    cardY + 14,
    {
      width: cardWidth - 28,
    },
  );

  const coverage = result.scoreSummary?.coverage;
  const improvementMin =
    result.scoreSummary?.expectedImprovementMin ?? 0;
  const improvementMax =
    result.scoreSummary?.expectedImprovementMax ?? 0;

  setText(document, 15, COLORS.primary).text(
    coverage === undefined
      ? "현재 규칙 점수 없음"
      : `측정 ${coverage}% / +${improvementMin}~${improvementMax}점`,
    x + cardWidth + gap + 14,
    cardY + 42,
    {
      width: cardWidth - 28,
      lineGap: 3,
    },
  );

  document.y = cardY + cardHeight + 22;

  writeSectionTitle(document, "검사 기본정보");
  writeLabelValue(document, "사이트", result.site.name);
  writeLabelValue(document, "등록 URL", result.site.baseUrl);
  writeLabelValue(
    document,
    "최종 URL",
    result.site.finalUrl ?? result.site.baseUrl,
  );
  writeLabelValue(
    document,
    "사이트 유형",
    result.site.siteType ?? "미입력",
  );
  writeLabelValue(
    document,
    "지역·언어",
    `${result.site.region ?? result.site.country} / ${
      result.site.primaryLocale
    }`,
  );
  writeLabelValue(document, "검사 유형", result.scan.type);
  writeLabelValue(document, "검사 상태", result.scan.status);
  writeLabelValue(
    document,
    "완료 시각(KST)",
    formatKST(result.scan.completedAt),
  );
  writeLabelValue(
    document,
    "보고서 생성 시각(KST)",
    formatKST(new Date().toISOString()),
  );

  document.moveDown(0.5);
  setText(document, 7.9, COLORS.muted).text(
    "현재 QUICK 점수는 공개 URL의 실제 HTTP 응답과 초기 HTML을 기준으로 계산합니다. JavaScript 실행 후 DOM 비교는 AI 수집 개선안을 만드는 데 활용하며, 모바일·PC 별도 비교, 업종별 기준정보와 질문 정답률은 정밀진단 단계에서 추가됩니다.",
    {
      width,
      lineGap: 3,
    },
  );
}

function writeCategoryScores(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  document.addPage();
  writeSectionTitle(
    document,
    "영역별 점수",
    "현재 규칙 버전의 7개 영역 총 100점 배점을 기준으로 계산했습니다.",
  );

  if (!result.scoreSummary) {
    writeTextBox(
      document,
      "점수 안내",
      "이 결과는 현재 규칙 버전과 달라 영역별 점수를 다시 계산하지 않았습니다.",
    );
    return;
  }

  const x = document.page.margins.left;
  const width = contentWidth(document);

  for (const category of result.scoreSummary.categories) {
    ensureSpace(document, 58);
    const y = document.y;
    const percentage = Math.max(
      0,
      Math.min(100, category.percentage),
    );

    setText(document, 9.2, COLORS.text).text(
      cleanText(category.category),
      x,
      y,
      {
        width: width - 105,
      },
    );

    setText(document, 9.2, COLORS.primaryDark).text(
      `${category.score}/${category.maxScore}점`,
      x + width - 100,
      y,
      {
        width: 100,
        align: "right",
      },
    );

    const barY = y + 25;
    document
      .roundedRect(x, barY, width, 10, 5)
      .fill("#E2E8F0");

    if (percentage > 0) {
      document
        .roundedRect(
          x,
          barY,
          Math.max(4, (width * percentage) / 100),
          10,
          5,
        )
        .fill(COLORS.primary);
    }

    setText(document, 7.4, COLORS.muted).text(
      `${percentage}%`,
      x,
      barY + 16,
      {
        width,
        align: "right",
      },
    );

    document.y = barY + 34;
  }

  if (result.scoreSummary.cap !== null) {
    writeTextBox(
      document,
      "점수 상한 적용",
      `치명적 조건으로 최종 점수가 ${result.scoreSummary.cap}점 이하로 제한되었습니다.`,
      {
        background: COLORS.failSoft,
        border: "#FECACA",
        accent: COLORS.fail,
      },
    );
  }

  writeTextBox(
    document,
    "예상 개선 범위",
    `현재 규칙 배점 기준으로 +${result.scoreSummary.expectedImprovementMin}~${result.scoreSummary.expectedImprovementMax}점의 개선 가능 범위가 계산되었습니다. 실제 상승 점수와 AI 검색 노출을 보장하지 않습니다.`,
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );
}

function writeUnderstanding(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  document.addPage();
  writeSectionTitle(
    document,
    "AI가 읽은 사이트",
    scanResultRenderedDomComparison(result)
      ? "저장된 초기 HTML 검사 증거를 요약했으며 JavaScript 렌더링 비교는 다음 페이지에 표시합니다."
      : "LLM의 추측이 아니라 저장된 초기 HTML 검사 증거를 요약했습니다.",
  );

  writeTextBox(
    document,
    "사이트 이해 요약",
    result.understandingSummary,
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );

  writeSectionTitle(document, "찾은 핵심정보");

  if (result.foundInformation.length === 0) {
    setText(document, 9, COLORS.muted).text(
      "표시할 핵심정보가 없습니다.",
    );
  } else {
    for (const item of result.foundInformation) {
      writeLabelValue(document, item.label, item.value);
    }
  }

  document.moveDown(0.6);
  writeSectionTitle(document, "찾지 못했거나 확인하지 못한 정보");

  if (result.missingInformation.length === 0) {
    setText(document, 9, COLORS.pass).text(
      "현재 가중 규칙에서 누락된 항목이 없습니다.",
    );
  } else {
    for (const item of result.missingInformation) {
      ensureSpace(document, 25);
      setText(document, 8.8, COLORS.fail).text(
        `${cleanText(item.ruleCode)} / ${cleanText(item.title)}`,
        {
          width: contentWidth(document),
          lineGap: 2,
        },
      );
      document.moveDown(0.35);
    }
  }
}

function writeRenderedDomComparison(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const comparison = scanResultRenderedDomComparison(result);
  const improvementPlans =
    buildRenderedDomImprovementPlans(comparison);

  if (!comparison) {
    return;
  }

  document.addPage();
  writeSectionTitle(
    document,
    "초기 HTML vs JavaScript 렌더링",
    "브라우저에서 JavaScript를 실행한 뒤 실제 DOM이 얼마나 확장되는지 비교합니다. 이 결과는 점수에 직접 반영하지 않고 AI 수집 개선안을 만드는 데 활용합니다.",
  );

  if (comparison.status !== "SUCCESS") {
    writeTextBox(
      document,
      "렌더링 결과",
      [
        `상태: ${comparison.status}`,
        `오류 코드: ${comparison.errorCode ?? "미기록"}`,
        `안내: ${
          comparison.message ??
          "JavaScript 렌더링 비교 증거를 생성하지 못했습니다."
        }`,
      ].join("\n"),
      {
        background: COLORS.failSoft,
        border: "#FECACA",
        accent: COLORS.fail,
      },
    );
  } else {
    writeTextBox(
      document,
      "비교 요약",
      [
        comparisonMetricText(
          "본문 글자 수",
          comparison.metrics.textLength,
          "자",
        ),
        comparisonMetricText(
          "내부 링크",
          comparison.metrics.internalLinks,
          "개",
        ),
        comparisonMetricText(
          "H1",
          comparison.metrics.h1Count,
          "개",
        ),
        comparisonMetricText(
          "H2",
          comparison.metrics.h2Count,
          "개",
        ),
        comparisonMetricText(
          "유효 JSON-LD",
          comparison.metrics.jsonLdValidCount,
          "개",
        ),
      ].join("\n"),
      {
        background: COLORS.primarySoft,
        border: "#C7D2FE",
        accent: COLORS.primary,
      },
    );

    writeSectionTitle(document, "렌더링 실행 정보");
    writeLabelValue(
      document,
      "브라우저",
      comparison.browserVersion ?? "미확인",
    );
    writeLabelValue(
      document,
      "렌더링 시간",
      comparison.durationMs === null
        ? "미확인"
        : `${(comparison.durationMs / 1_000).toFixed(1)}초`,
    );
    writeLabelValue(
      document,
      "페이지 JavaScript 오류",
      comparison.pageErrorCount === null
        ? "미확인"
        : `${comparison.pageErrorCount.toLocaleString(
            "ko-KR",
          )}건`,
    );

    writeSectionTitle(
      document,
      "AI 수집 개선안",
      "비개발자도 작업 목적을 이해하고 개발자는 바로 수정할 수 있도록 함께 설명합니다.",
    );

    if (improvementPlans.length === 0) {
      writeTextBox(
        document,
        "현재 판단",
        "초기 HTML과 화면 완성 후의 핵심 구조가 비교적 비슷합니다. 현재 비교 결과에서 별도 개선안이 생성되지 않았습니다.",
        {
          background: COLORS.passSoft,
          border: "#BBF7D0",
          accent: COLORS.pass,
        },
      );
    } else {
      for (const [index, plan] of improvementPlans.entries()) {
        writeTextBox(
          document,
          `개선안 ${index + 1} · ${plan.title}`,
          [
            `현재 어떤 상태인가요?\n${plan.currentState}`,
            `무슨 뜻인가요?\n${plan.meaning}`,
            `무엇을 바꾸나요?\n${plan.change}`,
            `개발자 작업 지시\n${plan.developerInstructions
              .map((item) => `- ${item}`)
              .join("\n")}`,
            `완료 확인 기준\n${plan.acceptanceCriteria
              .map((item) => `- ${item}`)
              .join("\n")}`,
          ].join("\n\n"),
          {
            background: COLORS.primarySoft,
            border: "#C7D2FE",
            accent: COLORS.primary,
            fontSize: 8.5,
            maxCharacters: 6_000,
          },
        );
      }
    }
  }

  writeTextBox(
    document,
    "점수 반영 안내",
    "Site AI Score는 처음 전달되는 초기 HTML을 기준으로 점수를 계산합니다. JavaScript 렌더링 결과는 추가 콘텐츠를 읽을 수 있는 AI 환경까지 고려해 위 개선안을 만드는 데 활용합니다.",
    {
      background: COLORS.surface,
      border: COLORS.border,
      accent: COLORS.neutral,
    },
  );
}

function writeFindingDetail(
  document: PDFKit.PDFDocument,
  finding: PublicScanResultFinding,
  index: number,
  total: number,
): void {
  document.addPage();
  const colors = statusColors(finding.status);
  const x = document.page.margins.left;
  const width = contentWidth(document);

  setText(document, 8.1, COLORS.primary).text(
    `주요 문제 ${index + 1} / ${total}`,
    {
      width,
      characterSpacing: 0.6,
    },
  );
  document.moveDown(0.4);

  setText(document, 18, COLORS.text).text(cleanText(finding.title), {
    width,
    lineGap: 3,
  });
  document.moveDown(0.3);

  setText(document, 8.2, COLORS.muted).text(
    `${cleanText(finding.ruleCode)} / ${cleanText(
      finding.category,
    )}`,
    {
      width,
    },
  );
  document.moveDown(0.9);

  document
    .roundedRect(x, document.y, width, 58, 8)
    .fillAndStroke(colors.soft, colors.text);

  const metaY = document.y + 12;

  setText(document, 8.4, colors.text).text(
    `판정 · ${STATUS_LABELS[finding.status]}`,
    x + 13,
    metaY,
    {
      width: width * 0.32,
    },
  );

  setText(document, 8.4, colors.text).text(
    `중요도 · ${SEVERITY_LABELS[finding.severity]}`,
    x + width * 0.34,
    metaY,
    {
      width: width * 0.3,
    },
  );

  setText(document, 8.4, colors.text).text(
    pointImpact(finding),
    x + width * 0.66,
    metaY,
    {
      width: width * 0.31 - 13,
      align: "right",
    },
  );

  document.y = metaY + 58;

  writeTextBox(document, "진단 내용", finding.description, {
    background: COLORS.white,
    border: COLORS.border,
    accent: colors.text,
  });

  if (finding.recommendation) {
    writeTextBox(
      document,
      "수정 권장사항",
      finding.recommendation,
      {
        background: COLORS.primarySoft,
        border: "#C7D2FE",
        accent: COLORS.primary,
      },
    );
  }

  writeTextBox(
    document,
    "검사 증거",
    evidenceText(finding.evidence),
    {
      background: COLORS.surface,
      border: COLORS.border,
      fontSize: 7.4,
      maxCharacters: 4_000,
    },
  );
}

function writePrimaryIssues(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  if (result.primaryIssues.length === 0) {
    document.addPage();
    writeSectionTitle(document, "주요 문제");
    setText(document, 9.2, COLORS.pass).text(
      "주요 문제로 분류된 항목이 없습니다.",
    );
    return;
  }

  result.primaryIssues.forEach((finding, index) => {
    writeFindingDetail(
      document,
      finding,
      index,
      result.primaryIssues.length,
    );
  });
}

function writeCompactFinding(
  document: PDFKit.PDFDocument,
  finding: PublicScanResultFinding,
): void {
  const colors = statusColors(finding.status);
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const padding = 12;
  const evidence =
    finding.status === "PASS"
      ? ""
      : evidenceText(finding.evidence);
  const evidenceSummary =
    evidence.length > 600
      ? `${evidence.slice(0, 600)}…`
      : evidence;

  setText(document, 9);
  const title = `${cleanText(finding.ruleCode)} / ${cleanText(
    finding.title,
  )}`;
  const titleHeight = document.heightOfString(title, {
    width: width - padding * 2,
    lineGap: 2,
  });
  const descriptionHeight = document.heightOfString(
    cleanText(finding.description),
    {
      width: width - padding * 2,
      lineGap: 2,
    },
  );
  const recommendationHeight = finding.recommendation
    ? document.heightOfString(
        `권장: ${cleanText(finding.recommendation)}`,
        {
          width: width - padding * 2,
          lineGap: 2,
        },
      )
    : 0;
  const evidenceHeight = evidenceSummary
    ? document.heightOfString(`증거 요약: ${evidenceSummary}`, {
        width: width - padding * 2,
        lineGap: 2,
      })
    : 0;
  const boxHeight =
    padding +
    titleHeight +
    23 +
    descriptionHeight +
    (recommendationHeight ? recommendationHeight + 8 : 0) +
    (evidenceHeight ? evidenceHeight + 8 : 0) +
    padding;

  ensureSpace(document, boxHeight + 10);
  const y = document.y;

  document
    .roundedRect(x, y, width, boxHeight, 8)
    .fillAndStroke(COLORS.white, COLORS.border);

  document.roundedRect(x, y, 4, boxHeight, 2).fill(colors.text);

  setText(document, 8.7, COLORS.text).text(
    title,
    x + padding,
    y + padding,
    {
      width: width - padding * 2,
      lineGap: 2,
    },
  );

  let currentY = y + padding + titleHeight + 5;

  setText(document, 7.6, colors.text).text(
    `${STATUS_LABELS[finding.status]} / ${
      SEVERITY_LABELS[finding.severity]
    } / ${pointImpact(finding)}`,
    x + padding,
    currentY,
    {
      width: width - padding * 2,
    },
  );

  currentY += 18;

  setText(document, 8.3, COLORS.text).text(
    cleanText(finding.description),
    x + padding,
    currentY,
    {
      width: width - padding * 2,
      lineGap: 2,
    },
  );

  currentY += descriptionHeight + 8;

  if (finding.recommendation) {
    setText(document, 7.9, COLORS.primaryDark).text(
      `권장: ${cleanText(finding.recommendation)}`,
      x + padding,
      currentY,
      {
        width: width - padding * 2,
        lineGap: 2,
      },
    );
    currentY += recommendationHeight + 8;
  }

  if (evidenceSummary) {
    setText(document, 7.1, COLORS.muted).text(
      `증거 요약: ${evidenceSummary}`,
      x + padding,
      currentY,
      {
        width: width - padding * 2,
        lineGap: 2,
      },
    );
  }

  document.y = y + boxHeight + 10;
}

function writeAllFindings(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  document.addPage();
  writeSectionTitle(
    document,
    "전체 진단 항목",
    `통과·실패·확인 불가·감점 제외를 포함한 ${result.findings.length}개 항목입니다.`,
  );

  const groups = new Map<string, PublicScanResultFinding[]>();

  for (const finding of result.findings) {
    const values = groups.get(finding.category) ?? [];
    values.push(finding);
    groups.set(finding.category, values);
  }

  for (const [category, findings] of groups) {
    ensureSpace(document, 42);
    setText(document, 11.5, COLORS.primaryDark).text(
      cleanText(category),
      {
        width: contentWidth(document),
      },
    );
    document.moveDown(0.5);

    for (const finding of findings) {
      writeCompactFinding(document, finding);
    }

    document.moveDown(0.5);
  }
}

function writeCollectedPages(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  document.addPage();
  writeSectionTitle(
    document,
    "수집 페이지",
    "원본 HTML은 저장하지 않고 해시와 측정값만 보관합니다.",
  );

  if (result.pages.length === 0) {
    setText(document, 9, COLORS.muted).text(
      "저장된 수집 페이지가 없습니다.",
    );
    return;
  }

  for (const [index, page] of result.pages.entries()) {
    ensureSpace(document, 190);
    writeTextBox(
      document,
      `수집 페이지 ${index + 1}`,
      [
        `검사 URL: ${page.url}`,
        `최종 URL: ${page.finalUrl ?? "미확인"}`,
        `HTTP 상태: ${page.statusCode ?? "미확인"}`,
        `Content-Type: ${page.contentType ?? "미확인"}`,
        `초기 텍스트: ${
          page.initialTextLength?.toLocaleString("ko-KR") ??
          "미확인"
        }자`,
        `iframe: ${page.iframeCount ?? "미확인"}개`,
        `HTML SHA-256: ${page.rawHtmlHash ?? "미저장"}`,
      ].join("\n"),
      {
        background: COLORS.surface,
        border: COLORS.border,
        accent: COLORS.primary,
        fontSize: 8.4,
      },
    );
  }
}

function writeMethodology(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  document.addPage();
  writeSectionTitle(document, "검사 범위·이용 안내·면책");

  setText(document, 9.1, COLORS.text).text(
    [
      "1. 이 보고서는 명시된 공개 URL과 검사 시점에 관찰된 실제 HTTP 응답·초기 HTML 증거를 기준으로 작성되며, 사용 가능한 경우 JavaScript 실행 후 DOM 비교 증거를 함께 제공합니다.",
      "2. 종합점수와 판정은 규칙 버전에 정의된 배점과 완료 조건으로 계산하며 LLM이 임의로 결정하지 않습니다.",
      "3. OAI-SearchBot은 검색용, ChatGPT-User는 사용자 요청용, GPTBot은 학습용 접근으로 구분하여 표시합니다.",
      "4. 원본 HTML은 저장하지 않고 SHA-256 해시와 구조화된 검사 증거를 보관합니다.",
      "5. 현재 QUICK 점수는 초기 HTML 기준 25개 규칙으로 계산합니다. JavaScript 실행 후 DOM 비교는 점수에 직접 반영하지 않고 AI 수집 개선안을 만드는 데 활용하며, 모바일·PC 별도 비교, 업종별 기준정보와 질문 정답률은 포함되지 않습니다.",
      "6. 이 보고서는 AI 검색 노출, 추천 결과, 사이트 전체 보안성, 모든 기능의 무결성을 보증하지 않습니다.",
      "7. 수정 전후 비교는 동일 규칙 버전과 같은 조건으로 재검사해야 합니다.",
    ].join("\n\n"),
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );

  document.moveDown(1.2);
  writeLabelValue(document, "규칙 버전", result.scan.rulesVersion);
  writeLabelValue(document, "검사 ID", result.scan.id);
  writeLabelValue(
    document,
    "검사 완료(KST)",
    formatKST(result.scan.completedAt),
  );

  document.moveDown(1.1);
  setText(document, 9, COLORS.primaryDark).text(
    "Site AI Score - 공개 URL 진단, 수정 작업지시서, 독립 자동검수",
    {
      width: contentWidth(document),
    },
  );
}

function addFooters(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const range = document.bufferedPageRange();

  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    document.switchToPage(range.start + pageIndex);
    const left = document.page.margins.left;
    const width = contentWidth(document);
    const y =
      document.page.height -
      document.page.margins.bottom -
      12;

    document
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .moveTo(left, y - 7)
      .lineTo(left + width, y - 7)
      .stroke();

    setText(document, 7.1, COLORS.muted).text(
      `Scan ${cleanText(result.scan.id)} / ${cleanText(
        result.scan.rulesVersion,
      )}`,
      left,
      y,
      {
        width: width * 0.72,
        lineBreak: false,
      },
    );

    setText(document, 7.1, COLORS.muted).text(
      `${pageIndex + 1} / ${range.count}`,
      left + width * 0.72,
      y,
      {
        width: width * 0.28,
        align: "right",
        lineBreak: false,
      },
    );
  }
}

export function scanResultPdfFontHash(): string {
  cachedFontHash ??= createHash("sha256")
    .update(readFileSync(requireFontPath()))
    .digest("hex");
  return cachedFontHash;
}

export function scanResultPdfFilename(
  result: Pick<PublicScanResult, "scan">,
): string {
  return `site-ai-score-${result.scan.id}.pdf`.replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
}

export async function renderScanResultPdf(
  result: PublicScanResult,
): Promise<Buffer> {
  const safeResult = sanitizeScanResultForPdf(result);
  const creationDate = new Date(
    safeResult.scan.completedAt ?? safeResult.scan.createdAt,
  );
  const document = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: {
      top: 45,
      right: 46,
      bottom: 50,
      left: 46,
    },
    info: {
      Title: `${cleanText(safeResult.site.name)} 진단 보고서`,
      Author: "Site AI Score",
      Subject: `${cleanText(safeResult.scan.id)} / ${cleanText(
        safeResult.scan.rulesVersion,
      )}`,
      Keywords: "Site AI Score, AEO, 진단 보고서",
      CreationDate: creationDate,
    },
  });

  document.registerFont(FONT_NAME, requireFontPath());

  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);
  });

  writeCover(document, safeResult);
  writeCategoryScores(document, safeResult);
  writeUnderstanding(document, safeResult);
  writeRenderedDomComparison(document, safeResult);
  writePrimaryIssues(document, safeResult);
  writeAllFindings(document, safeResult);
  writeCollectedPages(document, safeResult);
  writeMethodology(document, safeResult);
  addFooters(document, safeResult);

  document.end();
  return completed;
}
