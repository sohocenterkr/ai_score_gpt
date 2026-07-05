import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type {
  PublicWorkOrder,
  PublicWorkOrderItem,
} from "./work-order-service";

const FONT_REGULAR_NAME = "SiteAiScoreWorkOrderRegular";
const FONT_BOLD_NAME = "SiteAiScoreWorkOrderSemiBold";

const COLORS = {
  primary: "#3157E5",
  primaryDark: "#243B91",
  primarySoft: "#EEF2FF",
  text: "#172033",
  muted: "#64748B",
  border: "#DCE3EE",
  surface: "#F8FAFC",
  success: "#166534",
  warning: "#92400E",
  white: "#FFFFFF",
};

const STATUS_LABELS: Record<PublicWorkOrder["status"], string> = {
  DRAFT: "초안",
  ISSUED: "발급",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업 중",
  SUBMITTED: "제출",
  VERIFYING: "검수 중",
  REWORK_REQUIRED: "재작업 필요",
  PASSED: "통과",
  CANCELLED: "취소",
};

const FINDING_STATUS_LABELS: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const SEVERITY_LABELS: Record<string, string> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

function fontPaths(filename: string): string[] {
  return [
    join(
      process.cwd(),
      "dist",
      "assets",
      "fonts",
      "pretendard",
      filename,
    ),
    join(
      process.cwd(),
      "server",
      "assets",
      "fonts",
      "pretendard",
      filename,
    ),
  ];
}

function requireFontPath(filename: string): string {
  const candidates = fontPaths(filename);
  const value = candidates.find((candidate) =>
    existsSync(candidate),
  );

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

function pdfCriterionCode(value: string): string {
  return cleanText(value)
    .replace(
      /^CONTENT-HEADINGS-001-(\d+)$/,
      "HEADINGS-$1",
    )
    .replace(
      /^CONTENT-INITIAL-001-(\d+)$/,
      "INITIAL-TEXT-$1",
    )
    .replace(
      /^CONTENT-ANSWERABILITY-001-(\d+)$/,
      "ANSWER-$1",
    )
    .replace(
      /^STRUCT-LINKS-001-(\d+)$/,
      "LINKS-$1",
    )
    .replace(
      /^RENDERED-ADDED-CONTENT-(\d+)$/,
      "JS-CONTENT-$1",
    )
    .replace(
      /^RENDERED-INCONSISTENT-(?:INFORMATION|INFORM)-(\d+)$/,
      "JS-CONSISTENCY-$1",
    )
    .replace(
      /^INITIAL-HTML-MISSING-CORE-(\d+)$/,
      "INITIAL-HTML-$1",
    );
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

function setRegular(
  document: PDFKit.PDFDocument,
  size = 9.5,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document
    .font(FONT_REGULAR_NAME)
    .fontSize(size)
    .fillColor(color);
}

function setBold(
  document: PDFKit.PDFDocument,
  size = 9.5,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document
    .font(FONT_BOLD_NAME)
    .fontSize(size)
    .fillColor(color);
}

function writeSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
): void {
  ensureSpace(document, 30);
  const x = document.page.margins.left;

  document.x = x;
  setBold(document, 12, COLORS.text).text(
    cleanText(title),
    x,
    document.y,
    {
      width: contentWidth(document),
    },
  );
  document
    .moveDown(0.35)
    .strokeColor(COLORS.border)
    .lineWidth(0.7)
    .moveTo(x, document.y)
    .lineTo(
      document.page.width - document.page.margins.right,
      document.y,
    )
    .stroke()
    .moveDown(0.65);

  document.x = x;
}

function writeLabelValue(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  const width = contentWidth(document);
  const labelWidth = 105;
  const x = document.page.margins.left;
  const y = document.y;
  const safeValue = cleanText(value) || "-";
  const valueHeight = document.heightOfString(safeValue, {
    width: width - labelWidth,
    lineGap: 2,
  });
  const rowHeight = Math.max(18, valueHeight + 2);

  ensureSpace(document, rowHeight + 5);
  const rowY = document.y;

  setBold(document, 8.2, COLORS.muted).text(cleanText(label), x, rowY, {
    width: labelWidth - 10,
    lineBreak: false,
  });
  setRegular(document, 9.2, COLORS.text).text(
    safeValue,
    x + labelWidth,
    rowY,
    {
      width: width - labelWidth,
      lineGap: 2,
    },
  );

  document.y = rowY + rowHeight + 5;
}

function writeTextBox(
  document: PDFKit.PDFDocument,
  title: string,
  text: string,
  options: {
    background?: string;
    border?: string;
    accent?: string;
  } = {},
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const padding = 14;
  const titleHeight = 15;
  const safeText = cleanText(text) || "-";

  setRegular(document, 9.3);
  const bodyHeight = document.heightOfString(safeText, {
    width: width - padding * 2,
    lineGap: 3,
  });
  const boxHeight = padding + titleHeight + 7 + bodyHeight + padding;

  ensureSpace(document, boxHeight + 12);
  const y = document.y;

  document
    .roundedRect(x, y, width, boxHeight, 8)
    .fillAndStroke(
      options.background ?? COLORS.surface,
      options.border ?? COLORS.border,
    );

  if (options.accent) {
    document
      .roundedRect(x, y, 4, boxHeight, 2)
      .fill(options.accent);
  }

  setBold(document, 8.7, COLORS.muted).text(
    cleanText(title),
    x + padding,
    y + padding,
    {
      width: width - padding * 2,
      lineBreak: false,
    },
  );

  setRegular(document, 9.3, COLORS.text).text(
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

function writeCriteria(
  document: PDFKit.PDFDocument,
  item: PublicWorkOrderItem,
  isEnglish: boolean,
): void {
  writeSectionTitle(document, isEnglish ? "Completion criteria" : "완료 판정 기준");

  for (const criterion of item.acceptanceCriteria) {
    const x = document.page.margins.left;
    const width = contentWidth(document);
    const codeWidth = 92;
    const requiredWidth = 40;
    const padding = 10;
    const labelWidth =
      width - codeWidth - requiredWidth - padding * 4;
    const label = cleanText(criterion.label);
    const labelHeight = document.heightOfString(label, {
      width: labelWidth,
      lineGap: 2,
    });
    const rowHeight = Math.max(32, labelHeight + padding * 2);

    ensureSpace(document, rowHeight + 7);
    const y = document.y;

    document
      .roundedRect(x, y, width, rowHeight, 7)
      .fillAndStroke(COLORS.white, COLORS.border);

    setBold(document, 7.7, COLORS.primary).text(
      pdfCriterionCode(criterion.code),
      x + padding,
      y + padding,
      {
        width: codeWidth - padding,
      },
    );

    setRegular(document, 8.8, COLORS.text).text(
      label,
      x + codeWidth + padding,
      y + padding,
      {
        width: labelWidth,
        lineGap: 2,
      },
    );

    setBold(
      document,
      7.4,
      criterion.required ? COLORS.primaryDark : COLORS.muted,
    ).text(
      criterion.required ? (isEnglish ? "Required" : "필수") : (isEnglish ? "Recommended" : "권장"),
      x + width - requiredWidth - padding,
      y + padding,
      {
        width: requiredWidth,
        align: "right",
      },
    );

    document.y = y + rowHeight + 7;
  }

  document.moveDown(0.4);
}

function evidenceText(value: unknown, isEnglish = false): string {
  if (value === null || value === undefined) {
    return isEnglish ? "No saved initial diagnostic evidence." : "저장된 최초 검사 증거가 없습니다.";
  }

  try {
    return cleanText(JSON.stringify(value, null, 2));
  } catch {
    return cleanText(value);
  }
}

function writeEvidence(
  document: PDFKit.PDFDocument,
  item: PublicWorkOrderItem,
  isEnglish: boolean,
): void {
  const text = item.finding
    ? evidenceText(item.finding.evidence, isEnglish)
    : isEnglish ? "This item was automatically generated from the same diagnostic's initial HTML and JavaScript-rendered DOM comparison. Check the diagnostic report for the original comparison values." : "이 항목은 같은 검사의 초기 HTML과 JavaScript 렌더링 비교 결과에서 자동 생성되었습니다. 원본 비교 수치는 진단 보고서에서 확인하세요.";
  const width = contentWidth(document);

  setRegular(document, 7.4, COLORS.muted);
  const evidenceHeight = document.heightOfString(text, {
    width,
    lineGap: 2,
  });
  const requiredHeight = 34 + evidenceHeight + 14;
  const pageBodyHeight =
    document.page.height -
    document.page.margins.top -
    document.page.margins.bottom -
    40;

  if (
    requiredHeight <= pageBodyHeight &&
    document.y + requiredHeight > bottomLimit(document)
  ) {
    document.addPage();
  }

  writeSectionTitle(document, isEnglish ? "Initial diagnostic evidence" : "최초 검사 증거");

  const x = document.page.margins.left;
  document.x = x;
  setRegular(document, 7.4, COLORS.muted).text(
    text,
    x,
    document.y,
    {
      width,
      lineGap: 2,
    },
  );
  document.moveDown(0.8);
}

function writeCover(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
  isEnglish: boolean,
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const top = document.page.margins.top;

  document
    .roundedRect(x, top, width, 116, 12)
    .fill(COLORS.primary);

  setBold(document, 10, COLORS.white).text(
    "SITE AI SCORE",
    x + 22,
    top + 19,
    {
      width: width - 44,
      characterSpacing: 1.2,
    },
  );

  setBold(document, 24, COLORS.white).text(
    isEnglish ? `${cleanText(workOrder.site.name)} Improvement Work Order` : `${cleanText(workOrder.site.name)} 수정 작업지시서`,
    x + 22,
    top + 43,
    {
      width: width - 44,
      lineGap: 3,
    },
  );

  setRegular(document, 9.2, "#DDE5FF").text(
    `${cleanText(workOrder.orderNumber)} / v${workOrder.version} / ${
      isEnglish
        ? workOrder.status.replaceAll("_", " ").toLowerCase()
        : STATUS_LABELS[workOrder.status]
    }`,
    x + 22,
    top + 89,
    {
      width: width - 44,
    },
  );

  document.y = top + 142;

  const gap = 12;
  const scoreWidth = (width - gap) / 2;
  const scoreY = document.y;
  const scoreHeight = 78;

  document
    .roundedRect(x, scoreY, scoreWidth, scoreHeight, 10)
    .fillAndStroke(COLORS.white, COLORS.border);
  document
    .roundedRect(
      x + scoreWidth + gap,
      scoreY,
      scoreWidth,
      scoreHeight,
      10,
    )
    .fillAndStroke(COLORS.primarySoft, "#C7D2FE");

  setBold(document, 8.4, COLORS.muted).text(
    isEnglish ? "Current score" : "현재 점수",
    x + 14,
    scoreY + 13,
    {
      width: scoreWidth - 28,
    },
  );
  setBold(document, 26, COLORS.text).text(
    workOrder.scoreBefore === null
      ? "-"
      : String(workOrder.scoreBefore),
    x + 14,
    scoreY + 31,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );
  setRegular(document, 8.2, COLORS.muted).text(
    cleanText(workOrder.gradeBefore ?? (isEnglish ? "Not calculated" : "미계산")),
    x + 70,
    scoreY + 44,
    {
      width: scoreWidth - 84,
    },
  );

  setBold(document, 8.4, COLORS.primaryDark).text(
    isEnglish ? "Expected score range" : "예상 점수 범위",
    x + scoreWidth + gap + 14,
    scoreY + 13,
    {
      width: scoreWidth - 28,
    },
  );
  setBold(document, 23, COLORS.primary).text(
    `${workOrder.expectedScoreMin} - ${workOrder.expectedScoreMax}`,
    x + scoreWidth + gap + 14,
    scoreY + 33,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );

  document.y = scoreY + scoreHeight + 22;

  writeSectionTitle(document, isEnglish ? "Work order information" : "작업지시서 정보");
  writeLabelValue(document, isEnglish ? "Customer" : "고객", workOrder.customerOrganization.name);
  writeLabelValue(
    document,
    isEnglish ? "Site" : "사이트",
    `${workOrder.site.name} (${workOrder.site.baseUrl})`,
  );
  writeLabelValue(
    document,
    isEnglish ? "Diagnostic URL" : "검사 URL",
    workOrder.site.finalUrl ?? workOrder.site.baseUrl,
  );
  writeLabelValue(document, isEnglish ? "Rules version" : "규칙 버전", workOrder.rulesVersion);
  writeLabelValue(document, isEnglish ? "Issued at (KST)" : "발급 시각(KST)", formatKST(workOrder.issuedAt));
  writeLabelValue(
    document,
    isEnglish ? "PDF generated at (KST)" : "PDF 생성 시각(KST)",
    formatKST(new Date().toISOString()),
  );

  writeSectionTitle(document, isEnglish ? "Work item summary" : "작업 항목 요약");

  workOrder.items.forEach((item, index) => {
    ensureSpace(document, 27);
    const y = document.y;
    setBold(document, 8.1, COLORS.primary).text(
      String(index + 1).padStart(2, "0"),
      x,
      y,
      {
        width: 28,
        lineBreak: false,
      },
    );
    setBold(document, 9.2, COLORS.text).text(
      `${cleanText(item.itemCode)} / ${cleanText(item.title)}`,
      x + 34,
      y,
      {
        width: width - 112,
      },
    );
    setBold(document, 8.1, COLORS.primaryDark).text(
      item.weight > 0 ? (isEnglish ? `${item.weight} pts` : `${item.weight}점`) : (isEnglish ? "Non-score" : "점수 외"),
      x + width - 66,
      y,
      {
        width: 66,
        align: "right",
      },
    );
    document.y = Math.max(document.y, y + 18) + 7;
  });

  document.moveDown(0.5);
  setRegular(document, 7.8, COLORS.muted).text(
    isEnglish ? "The expected score range is calculated only from the selected scoring rule weights. Non-score AI collection improvements are not included, and actual score increases or AI search visibility are not guaranteed. The core goal is to help AI systems understand and cite the service more accurately." : "예상 점수 범위는 선택된 점수 규칙 배점만으로 계산합니다. 점수 외 AI 수집 개선안은 예상 점수에 포함되지 않으며 실제 점수 상승이나 AI 검색 노출을 보장하지 않습니다. 핵심 목표는 AI가 서비스를 더 정확히 인식하고 인용할 수 있게 만드는 것입니다.",
    {
      width,
      lineGap: 2,
    },
  );
}

function writeExecutionPlanPage(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
  isEnglish: boolean,
): void {
  const shouldWritePlan = workOrder.items.some((item) => {
    const itemText = [
      item.title,
      item.requirement,
      item.developerMessage,
    ].join(" ");

    return (
      itemText.includes("초기 HTML") ||
      itemText.includes("SSR") ||
      itemText.includes("SSG") ||
      itemText.includes("렌더링") ||
      itemText.includes("H1") ||
      itemText.includes("내부 링크")
    );
  });

  if (!shouldWritePlan) {
    return;
  }

  document.addPage();

  writeSectionTitle(document, isEnglish ? "Execution work bundles" : "실행용 작업 묶음");

  setRegular(document, 8.6, COLORS.muted).text(
    isEnglish ? "Automatic verification items have been reorganized into Epic-level bundles that are easier for developers to implement." : "자동검수 항목을 개발자가 실제로 처리하기 좋은 Epic 단위로 재구성했습니다.",
    {
      width: contentWidth(document),
      lineGap: 2,
    },
  );

  document.moveDown(0.5);

  setRegular(document, 8.9, COLORS.text).text(
    [
      isEnglish
        ? "The work bundles below are an implementation guide for fixing items that share the same root cause together, not for hiding or removing scoring items."
        : "아래 작업 묶음은 점수 항목을 숨기거나 제거하는 것이 아니라, 같은 원인에서 나온 항목을 한 번에 구현하도록 정리한 실행 가이드입니다.",
      isEnglish
        ? "Automatic verification and scoring still follow the detailed items later in this document. Developers can implement the P0, P1, and P2 bundles first, then review the detailed completion criteria."
        : "자동검수와 점수 계산은 뒤쪽 상세 항목 기준으로 유지되며, 개발자는 먼저 P0·P1·P2 묶음 단위로 구현한 뒤 상세 완료 기준을 확인하면 됩니다.",
    ].join("\n\n"),
    {
      width: contentWidth(document),
      lineGap: 3,
    },
  );

  document.moveDown(0.9);

  const epics = [
    {
      priority: "P0",
      title: isEnglish ? "Adopt SSR/SSG for initial HTML — content, H1, and internal links" : "초기 HTML SSR/SSG 도입 — 본문·H1·내부 링크 보강",
      owner: isEnglish ? "Frontend / full-stack" : "프론트엔드 / 풀스택",
      body: [
        isEnglish ? "Include the service definition, target customers, representative use cases, a 3–5 step usage flow, and pricing/data handling summary in the landing page initial HTML." : "랜딩 페이지의 최초 HTML에 서비스 정의, 대상 고객, 대표 활용 사례, 3~5단계 이용 절차, 요금·데이터 처리 요약을 포함합니다.",
        isEnglish ? "Use exactly one H1, and structure H2 sections around service overview, target users, usage flow, pricing/security, and FAQ." : "H1은 정확히 1개, H2는 서비스 소개·이용 대상·이용 절차·요금/보안·FAQ 등 주요 섹션으로 구성합니다.",
        isEnglish ? "Provide pricing, feature overview, terms, privacy policy, help, and contact links as standard anchor tags with href attributes." : "요금제, 기능 소개, 이용약관, 개인정보처리방침, 도움말/문의 링크는 href가 있는 표준 a 태그로 제공합니다.",
        isEnglish ? "For React-based sites, review Next.js SSR/SSG, react-snap-style prerendering, Prerender.io, or a custom prerendering approach that fits the current architecture." : "React 기반이면 Next.js SSR/SSG, react-snap류 사전 렌더링, Prerender.io 또는 자체 사전 렌더링 방식을 현재 구조에 맞게 검토합니다.",
        isEnglish ? "Completion criteria: initial HTML body has at least 200 characters, internal target is 800 characters, body/links cover at least 75% of rendered DOM or differ by no more than two links, and existing UI/features do not regress." : "완료 기준: 초기 HTML 본문 200자 이상, 내부 목표 800자, 렌더링 DOM 대비 본문·링크 75% 이상 또는 차이 2개 이하, 기존 UI/기능 회귀 없음.",
      ],
    },
    {
      priority: "P1",
      title: isEnglish ? "Check consistency between initial HTML and rendered DOM" : "초기 HTML ↔ 렌더링 DOM 정보 일치성 점검",
      owner: isEnglish ? "Frontend" : "프론트엔드",
      body: [
        isEnglish ? "Compare title, meta description, H1, and JSON-LD values between initial HTML and the JavaScript-rendered DOM." : "초기 HTML과 JavaScript 렌더링 후 DOM의 title, meta description, H1, JSON-LD 값을 비교합니다.",
        isEnglish ? "Make sure client-side code does not overwrite correct initial values with stale or different values." : "클라이언트 코드가 올바른 초기값을 오래된 값이나 다른 값으로 덮어쓰지 않게 정리합니다.",
        isEnglish ? "Information that affects purchase evaluation, such as pricing, security, privacy, and support scope, should convey the same meaning in page content, metadata, and JSON-LD." : "요금, 보안, 개인정보, 지원 범위처럼 구매 검토에 영향을 주는 정보는 화면 본문·메타데이터·JSON-LD가 같은 의미를 전달해야 합니다.",
        isEnglish ? "Completion criteria: one representative H1, no conflicting metadata, and no key-information mismatch before and after rendering in recheck results." : "완료 기준: 대표 H1 1개, 충돌 메타데이터 없음, 재검사에서 렌더링 전후 핵심정보 불일치 없음.",
      ],
    },
    {
      priority: "P2",
      title: isEnglish ? "Add FAQ content and FAQPage JSON-LD" : "FAQ 콘텐츠 및 FAQPage JSON-LD 추가",
      owner: isEnglish ? "Content planning + frontend" : "콘텐츠 기획 + 프론트엔드",
      body: [
        isEnglish ? "Write 3–4 key FAQ items that are visible on the actual page." : "실제 화면에 보이는 핵심 FAQ 3~4개를 작성합니다.",
        isEnglish ? "Prioritize questions real users ask, such as free/paid scope, data handling, how to get started, and support coverage." : "무료/유료 범위, 데이터 처리 방식, 시작 방법, 지원 범위 등 실제 사용자가 묻는 질문을 우선합니다.",
        isEnglish ? "Declare the same questions and answers as FAQPage JSON-LD, and keep the visible FAQ and structured data consistent." : "같은 질문·답변을 FAQPage JSON-LD로 선언하되, 화면 FAQ와 구조화 데이터가 항상 일치해야 합니다.",
        isEnglish ? "Completion criteria: visible FAQ exists, FAQPage JSON-LD is valid, and help/contact links are visible in the initial HTML." : "완료 기준: 화면 FAQ 존재, FAQPage JSON-LD 유효, 도움말·문의 링크가 초기 HTML에서 확인됨.",
      ],
    },
  ];

  epics.forEach((epic) => {
    setBold(document, 9.3, COLORS.primaryDark).text(
      `${epic.priority} · ${epic.title}`,
      {
        width: contentWidth(document),
      },
    );

    setRegular(document, 8.2, COLORS.muted).text(
      isEnglish ? `Recommended owner: ${epic.owner}` : `권장 담당: ${epic.owner}`,
      {
        width: contentWidth(document),
      },
    );

    setRegular(document, 8.7, COLORS.text).text(
      epic.body.map((line) => `• ${line}`).join("\n"),
      {
        width: contentWidth(document),
        lineGap: 2,
      },
    );

    document.moveDown(0.7);
  });

  writeTextBox(
    document,
    isEnglish ? "Verification principles" : "검증 원칙",
    isEnglish ? "After deploying P0, run a Site AI Score recheck against the same production URL. If possible, also ask ChatGPT, Perplexity, and Claude real service-description questions to manually confirm that AI systems describe the service without distortion. The 800-character and 75% values are internal reference criteria and do not guarantee AI search visibility or recommendation results." : "P0 배포 후 같은 운영 URL로 Site AI Score 재검사를 실행하고, 가능하면 ChatGPT·Perplexity·Claude 등에 실제 서비스 설명 질문을 던져 AI가 서비스를 왜곡 없이 설명하는지 수동 확인해 주세요. 800자와 75%는 내부 참고 기준이며 AI 검색 노출이나 추천 결과를 보장하지 않습니다.",
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );
}


function writeItemPage(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
  item: PublicWorkOrderItem,
  index: number,
  isEnglish: boolean,
): void {
  document.addPage();
  const x = document.page.margins.left;
  const width = contentWidth(document);

  setBold(document, 8.2, COLORS.primary).text(
    isEnglish ? `Work item ${index + 1} / ${workOrder.items.length}` : `작업 항목 ${index + 1} / ${workOrder.items.length}`,
    {
      width,
      characterSpacing: 0.7,
    },
  );
  document.moveDown(0.45);

  setBold(document, 18, COLORS.text).text(cleanText(item.title), {
    width,
    lineGap: 3,
  });
  document.moveDown(0.35);

  setRegular(document, 8.3, COLORS.muted).text(
    `${cleanText(item.itemCode)} / ${
      item.finding
        ? item.isRequired
          ? isEnglish ? "Required item" : "필수 항목"
          : isEnglish ? "General item" : "일반 항목"
        : isEnglish ? "Recommended improvement" : "권장 개선"
    } / ${
      item.weight > 0 ? (isEnglish ? `Expected +${item.weight} pts` : `예상 ${item.weight}점`) : (isEnglish ? "Non-score improvement" : "점수 외 개선")
    }`,
    {
      width,
    },
  );
  document.moveDown(1.1);

  document
    .roundedRect(x, document.y, width, 73, 9)
    .fillAndStroke(COLORS.surface, COLORS.border);
  const metaY = document.y + 12;

  setBold(document, 7.6, COLORS.muted).text(isEnglish ? "Target URL" : "대상 URL", x + 13, metaY, {
    width: 70,
  });
  setRegular(document, 8.2, COLORS.text).text(
    cleanText(item.targetUrl),
    x + 83,
    metaY,
    {
      width: width - 96,
      lineGap: 2,
    },
  );

  setBold(document, 7.6, COLORS.muted).text(
    isEnglish ? "Initial finding" : "최초 판정",
    x + 13,
    metaY + 32,
    {
      width: 70,
    },
  );
  const findingStatus = item.finding?.status
    ? FINDING_STATUS_LABELS[item.finding.status] ??
      cleanText(item.finding.status)
    : isEnglish ? "Additional improvement recommended" : "추가 개선 권장";
  const findingSeverity = item.finding?.severity
    ? SEVERITY_LABELS[item.finding.severity] ??
      cleanText(item.finding.severity)
    : isEnglish ? "AI collection stability" : "AI 수집 안정성";

  setRegular(document, 8.2, COLORS.text).text(
    `${findingStatus} / ${findingSeverity}`,
    x + 83,
    metaY + 32,
    {
      width: width - 96,
    },
  );

  document.y = metaY + 76;

  if (item.finding?.description) {
    writeTextBox(
      document,
      isEnglish ? "Current issue" : "현재 문제",
      item.finding.description,
      {
        background: "#FFF7ED",
        border: "#FED7AA",
        accent: "#F59E0B",
      },
    );
  }

  writeTextBox(document, isEnglish ? "Required change" : "수정 요구사항", item.requirement, {
    background: COLORS.white,
    border: COLORS.border,
    accent: COLORS.primary,
  });

  writeTextBox(
    document,
    isEnglish ? "Developer instructions" : "개발자 전달용 문구",
    item.developerMessage,
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );

  writeCriteria(document, item, isEnglish);
  writeEvidence(document, item, isEnglish);
}

function addFooters(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
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

    setRegular(document, 7.2, COLORS.muted).text(
      `${cleanText(workOrder.orderNumber)} / v${workOrder.version}`,
      left,
      y,
      {
        width: width * 0.7,
        lineBreak: false,
      },
    );

    setRegular(document, 7.2, COLORS.muted).text(
      `${pageIndex + 1} / ${range.count}`,
      left + width * 0.7,
      y,
      {
        width: width * 0.3,
        align: "right",
        lineBreak: false,
      },
    );
  }
}

export function workOrderPdfFilename(
  workOrder: Pick<PublicWorkOrder, "orderNumber" | "version">,
): string {
  return `${workOrder.orderNumber}-v${workOrder.version}.pdf`.replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
}

export async function renderWorkOrderPdf(
  workOrder: PublicWorkOrder,
  options: { locale?: "ko" | "en" } = {},
): Promise<Buffer> {
  const isEnglish = options.locale === "en";
  const regularFontPath = requireFontPath(
    "Pretendard-Regular.ttf",
  );
  const boldFontPath = requireFontPath(
    "Pretendard-SemiBold.ttf",
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
      Title: isEnglish ? `${cleanText(workOrder.site.name)} Improvement Work Order` : `${cleanText(workOrder.site.name)} 수정 작업지시서`,
      Author: "Site AI Score",
      Subject: `${cleanText(workOrder.orderNumber)} v${workOrder.version}`,
      Keywords: isEnglish ? "Site AI Score, AEO, work order" : "Site AI Score, AEO, 작업지시서",
      CreationDate: new Date(),
    },
  });

  document.registerFont(
    FONT_REGULAR_NAME,
    regularFontPath,
  );
  document.registerFont(
    FONT_BOLD_NAME,
    boldFontPath,
  );

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

  writeCover(document, workOrder, isEnglish);

  writeExecutionPlanPage(document, workOrder, isEnglish);

  workOrder.items.forEach((item, index) => {
    writeItemPage(document, workOrder, item, index, isEnglish);
  });

  document.addPage();
  writeSectionTitle(document, isEnglish ? "Usage notes and disclaimer" : "이용 안내 및 면책");
  setRegular(document, 9.2, COLORS.text).text(
    isEnglish ? "This work order is based on issues found for the specified diagnostic URL and rules version. The customer site source code does not need to be submitted; after changes are deployed, the completion criteria must be verifiable on the public URL." : "이 작업지시서는 명시된 검사 URL과 규칙 버전에서 발견된 문제를 기준으로 작성되었습니다. 고객 사이트의 소스코드를 제출할 필요는 없으며, 수정 후 배포된 공개 URL에서 완료 기준을 자동검수할 수 있어야 합니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
  document.moveDown(0.9);
  setRegular(document, 9.2, COLORS.text).text(
    isEnglish ? "The expected score range is a reference calculated from the current rule weights. Values such as 800 characters or 75% are internal Site AI Score criteria, not official standards of any search engine or AI service. Actual score increases, AI search visibility, recommendation results, overall site security, and the integrity of all features are not guaranteed." : "예상 점수 범위는 현재 규칙 배점을 기준으로 계산한 참고값입니다. 800자, 75% 같은 수치는 Site AI Score 내부 기준이며 모든 검색엔진이나 AI 서비스의 공식 기준이 아닙니다. 실제 점수 상승, AI 검색 노출, 추천 결과, 사이트 전체 보안성과 모든 기능의 무결성을 보장하지 않습니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
  document.moveDown(1.2);
  setBold(document, 9, COLORS.primaryDark).text(
    isEnglish ? "Site AI Score - Diagnostics, work orders, and independent automatic verification" : "Site AI Score - 진단, 작업지시서, 독립 자동검수",
    {
      width: contentWidth(document),
    },
  );

  addFooters(document, workOrder);
  document.end();

  return completed;
}
