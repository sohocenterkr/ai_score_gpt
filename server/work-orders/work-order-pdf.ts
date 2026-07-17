import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type {
  PublicWorkOrder,
  PublicWorkOrderItem,
} from "./work-order-service";

function workOrderScoreGoal(scoreBefore: number | null | undefined) {
  const current = Math.max(0, Math.min(100, Math.round(scoreBefore ?? 0)));
  const firstMin =
    current < 70 ? 70 : current < 80 ? 80 : current < 90 ? 90 : current;
  const firstMax = firstMin < 80 ? 80 : 100;
  const finalMin = Math.max(80, Math.min(100, firstMin));

  return {
    firstMin,
    firstMax,
    finalMin,
    finalMax: 100,
  };
}

function pdfGoalRange(
  min: number,
  max: number,
  isEnglish: boolean,
  plus = false,
): string {
  const range =
    min === max ? String(min) : isEnglish ? `${min}-${max}` : `${min}~${max}`;
  return plus
    ? isEnglish
      ? `${range}+`
      : `${range}점 이상`
    : isEnglish
      ? range
      : `${range}점`;
}

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
  VERIFYING: "다음 진단 중",
  REWORK_REQUIRED: "추가 개선 필요",
  PASSED: "진단 완료",
  CANCELLED: "취소",
};

const STATUS_LABELS_EN: Record<PublicWorkOrder["status"], string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  VERIFYING: "Next diagnostic in progress",
  REWORK_REQUIRED: "Additional improvement needed",
  PASSED: "Diagnostic completed",
  CANCELLED: "Cancelled",
};

const FINDING_STATUS_LABELS: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const FINDING_STATUS_LABELS_EN: Record<string, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  BLOCKED: "Blocked",
  NA: "Not scored",
};

const SEVERITY_LABELS: Record<string, string> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

const SEVERITY_LABELS_EN: Record<string, string> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const WORK_ORDER_FINDING_DESCRIPTION_EN: Record<string, string> = {
  "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.":
    "No valid JSON-LD structured data was found in the initial HTML.",
  "유효한 JSON-LD 구조화 데이터를 확인하지 못했습니다.":
    "Valid JSON-LD structured data was not found.",
  "식별 가능한 JSON-LD @type이 없습니다.":
    "No identifiable JSON-LD @type was found.",
  "초기 HTML에서 H1 제목을 찾지 못했습니다.":
    "No H1 heading was found in the initial HTML.",
  "H1과 H2를 함께 사용한 기본 제목 계층이 부족합니다.":
    "The page lacks a basic heading hierarchy using both H1 and H2.",
  "초기 HTML의 읽을 수 있는 본문 텍스트가 매우 적습니다.":
    "The initial HTML contains very little readable body text.",
  "초기 HTML 본문량이 적어 사이트 기반 답변 생성이 제한될 수 있습니다.":
    "The initial HTML has too little body text, which may limit site-based answer generation.",
  "초기 HTML에서 탐색 가능한 내부 링크를 찾지 못했습니다.":
    "Navigable internal links were not found in the initial HTML.",
  "관련 콘텐츠로 이어지는 내부 링크 단서가 부족합니다.":
    "There are not enough internal-link signals leading to related content.",
};

function workOrderFindingDescription(
  value: string,
  isEnglish: boolean,
): string {
  return isEnglish
    ? (WORK_ORDER_FINDING_DESCRIPTION_EN[value] ?? value)
    : value;
}

const WORK_ORDER_RENDERED_TEXT_EN: Record<string, string> = {
  "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다":
    "Some information is visible on screen but may be missed by some AI systems",
  "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다":
    "The information first received by AI differs from what is displayed on screen",
  "AI가 처음 받는 페이지에 핵심 정보가 부족합니다":
    "The page first received by AI lacks core information",
  "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다.":
    "Body content or navigation links are added after the page opens.",
  "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.":
    "It may look normal to users, but some AI search bots that do not fully process JavaScript may miss information and links added later.",
  "초기 HTML에 핵심 본문과 주요 이동 경로가 충분히 포함되도록 렌더링 의존도를 줄이는 개선이 필요합니다.":
    "Reduce rendering dependency so the initial HTML contains enough core body text and key navigation paths.",
  "AI 검색 시스템에 따라 처음 받은 정보를 사용하기도 하고 화면 완성 후의 정보를 사용하기도 합니다. 값이 다르면 같은 페이지를 서로 다르게 이해할 수 있으며, B2B 서비스에서는 AI가 서비스명·기능·요금·데이터 처리 방식을 잘못 설명할 위험이 커집니다.":
    "Depending on the AI search system, it may use the initially received information or the fully rendered page. If they differ, the same page can be understood differently, increasing the risk that AI misstates the service name, features, pricing, or data handling.",
  "글자 하나까지 완전히 같을 필요는 없지만 페이지 주제, 서비스명, 핵심 기능, 가격·요금, 개인정보·자료 처리 방식, 운영 주체처럼 중요한 사실과 의미는 처음과 나중이 일치하도록 맞춥니다.":
    "The text does not need to be identical character by character, but important facts and meaning such as page topic, service name, key features, pricing, privacy/data handling, and operator information should stay consistent before and after rendering.",
  "페이지를 처음 불러왔을 때도 사이트가 누구를 위한 곳이며 무엇을 제공하는지, 어떤 절차로 이용하는지, 요금·데이터 처리·FAQ는 어디서 확인할 수 있는지 알 수 있도록 핵심 소개와 주요 정보를 보완합니다.":
    "Add core introduction and key information so that even the initially loaded page explains who the site is for, what it provides, how to use it, and where pricing, data handling, and FAQs can be found.",
  "점수만 올리기 위한 숨김 텍스트가 아니라, 실제 사용자 화면과 같은 의미의 콘텐츠를 초기 HTML과 구조화 데이터에 반영해 주세요.":
    "Do not add hidden text just to raise the score. Reflect content with the same meaning as the real user-facing page in the initial HTML and structured data.",
  "AI 검색 노출 보장이 아니라 AI가 서비스를 정확히 인식·인용할 가능성을 높이는 작업으로 이해해 주세요.":
    "Treat this as work that helps AI systems understand and cite the service more accurately, not as a guarantee of AI search visibility.",
  "핵심 본문을 초기 HTML에 출력해 주세요.":
    "Output the core body content in the initial HTML.",
  "기존 화면 기능을 유지해 주세요.": "Keep existing UI behavior working.",
  "핵심 본문에는 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로를 포함해 주세요.":
    "Include the service definition and core value, target users and representative use cases, a 3-5 step usage flow, pricing/data handling summary, and FAQ or help paths in the core body content.",
  "서비스 정의, 대상 고객, 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로가 사용자 화면과 초기 HTML에서 함께 확인됩니다.":
    "The service definition, target customers, usage process, pricing/data handling summary, and FAQ or help paths are visible both on the user-facing page and in the initial HTML.",
  "이 항목은 8개의 독립 작업으로 나누기보다 SSR/SSG/사전 렌더링 도입 또는 랜딩 페이지 정적화를 중심 작업으로 묶어 처리해 주세요.":
    "Treat this as one bundled SSR/SSG, prerendering, or landing-page static rendering task rather than eight separate tasks.",
  "요금제 또는 무료·유료 이용 범위, 개인정보·입력자료 처리 방식, 운영 주체와 문의 경로를 초기 HTML에 1~2문장 이상 요약하고 관련 정책 페이지로 표준 a 링크를 제공해 주세요.":
    "Summarize pricing or free/paid scope, privacy/input-data handling, operator information, and contact paths in at least 1-2 sentences in the initial HTML, and provide standard anchor links to related policy pages.",
  "실제 화면에 보이는 핵심 FAQ 3~4개를 만들고, 같은 질문·답변을 FAQPage JSON-LD로도 선언해 주세요.":
    "Create 3-4 key FAQs visible on the actual page, and declare the same questions and answers as FAQPage JSON-LD.",
  "주요 내부 링크는 JavaScript 클릭 핸들러만 쓰지 말고 href가 있는 표준 a 링크로 초기 HTML에 제공해 주세요.":
    "Provide key internal links in the initial HTML as standard anchor links with href attributes, not only JavaScript click handlers.",
  "초기 HTML 본문이 렌더링 DOM 본문의 75% 이상을 포함하도록 핵심 설명을 앞단에 제공해 주세요.":
    "Place core explanations upfront so the initial HTML contains at least 75% of the rendered DOM body text.",
  "초기 HTML 본문은 최소 200자 이상이어야 하며, 별도 답변 기반 규칙은 800자를 내부 참고 기준으로 사용합니다.":
    "The initial HTML body should contain at least 200 characters, and the separate answerability rule uses 800 characters as an internal reference target.",
  "주요 내부 링크는 렌더링 DOM 링크의 75% 이상을 포함하거나 차이가 2개 이하가 되도록 제공해 주세요.":
    "Provide key internal links so the initial HTML contains at least 75% of rendered DOM links or differs by no more than two links.",
  "og:image, favicon, lang, hreflang 등 공유·언어 메타데이터가 실제 응답하고 현재 페이지 언어와 충돌하지 않는지도 함께 점검해 주세요.":
    "Also check that sharing and language metadata such as og:image, favicon, lang, and hreflang respond correctly and do not conflict with the current page language.",
  "기존 디자인과 사용자 기능을 제거하거나 비활성화하지 마세요.":
    "Do not remove or disable the existing design or user-facing features.",
  "초기 HTML과 렌더링 DOM의 title, meta description, H1, JSON-LD 값을 비교해 주세요.":
    "Compare the title, meta description, H1, and JSON-LD values between the initial HTML and rendered DOM.",
  "클라이언트 실행 후 올바른 초기 값을 오래되거나 다른 값으로 덮어쓰는 코드를 수정해 주세요.":
    "Fix any code that overwrites correct initial values with outdated or different values after client-side execution.",
  "WebApplication, Organization, WebSite, FAQPage 등 JSON-LD의 이름·URL·설명·FAQ 답변이 실제 화면 정보와 일치하도록 유지해 주세요.":
    "Keep JSON-LD names, URLs, descriptions, and FAQ answers for WebApplication, Organization, WebSite, FAQPage, and similar types consistent with the visible page information.",
  "중복되거나 충돌하는 메타데이터 선언은 하나의 정확한 값으로 정리해 주세요.":
    "Consolidate duplicate or conflicting metadata declarations into one accurate value.",
  "렌더링 DOM에 H1이 2개 이상이면 페이지 대표 제목 하나만 H1으로 유지하고 나머지는 일반 텍스트나 H2로 변경해 주세요.":
    "If the rendered DOM has two or more H1s, keep only one representative page title as H1 and change the others to regular text or H2.",
  "요금, 보안, 개인정보, 지원 범위처럼 구매 검토에 영향을 주는 정보는 화면 본문·메타데이터·JSON-LD가 서로 다른 의미로 말하지 않게 점검해 주세요.":
    "Check that page content, metadata, and JSON-LD do not communicate different meanings for purchase-evaluation information such as pricing, security, privacy, and support scope.",
  "페이지별로 고유하고 구체적인 title과 meta description을 초기 HTML에 제공해 주세요.":
    "Provide a unique and specific title and meta description for each page in the initial HTML.",
  "페이지의 주제를 설명하는 명확한 H1과 핵심 본문을 초기 HTML에 포함해 주세요.":
    "Include a clear H1 and core body content that explain the page topic in the initial HTML.",
  "중요한 콘텐츠 페이지, 요금제, 개인정보처리방침, 이용약관, 도움말·문의 페이지로 이동하는 일반 HTML 링크를 제공해 주세요.":
    "Provide standard HTML links to important content pages, pricing, privacy policy, terms, help, and contact pages.",
  "화면에 없는 내용을 검색 노출만을 위해 숨겨 넣지 말고 실제 사용자에게 보이는 정보와 일치시켜 주세요.":
    "Do not hide content only for search exposure; keep AI-facing information consistent with what users can actually see.",
  "중요한 내부 링크가 초기 HTML에 존재하고 렌더링 DOM과의 차이가 허용 범위입니다.":
    "Important internal links exist in the initial HTML, and the difference from the rendered DOM is within the allowed range.",
  "실제 화면 FAQ와 FAQPage JSON-LD의 질문·답변이 일치합니다.":
    "The visible FAQ questions and answers match the FAQPage JSON-LD.",
  "기존 화면 디자인과 주요 사용자 기능은 브라우저 스모크 테스트 또는 수동 확인으로 검증합니다.":
    "The existing screen design and major user-facing features are verified by a browser smoke test or manual check.",
  "배포 파이프라인 또는 수동 점검에 초기 HTML H1과 본문 200자 이상 확인 스모크 테스트를 추가합니다.":
    "Add a smoke test to the deployment pipeline or manual checklist to confirm an initial HTML H1 and at least 200 characters of body text.",
  "수정 후 ChatGPT, Perplexity, Claude 등 실제 AI 도구에 사이트 설명 질문을 해 보고 서비스 설명이 왜곡되지 않는지 확인합니다.":
    "After the fix, ask real AI tools such as ChatGPT, Perplexity, and Claude service-description questions and confirm that the service is not misrepresented.",
  "초기 HTML과 화면 완성 후의 페이지 제목과 설명이 같은 주제와 의미를 전달합니다.":
    "The page title and description in the initial HTML and after rendering communicate the same topic and meaning.",
  "대표 제목(H1)은 렌더링 DOM에 정확히 1개이며 초기 HTML과 같은 핵심 주제를 전달합니다.":
    "The representative H1 appears exactly once in the rendered DOM and communicates the same core topic as the initial HTML.",
  "대표 제목과 구조화 정보의 핵심 사실이 실제 화면 내용과 일치합니다.":
    "The core facts in the representative heading and structured data match the actual visible page content.",
  "FAQPage JSON-LD를 추가한 경우 실제 화면 FAQ와 질문·답변이 일치합니다.":
    "If FAQPage JSON-LD is added, its questions and answers match the visible FAQ.",
  "서로 충돌하거나 오래된 메타데이터가 남아 있지 않습니다.":
    "No conflicting or outdated metadata remains.",
  "이번 차수 진단에서 렌더링 전후 핵심정보 불일치가 사라졌음이 확인됩니다.":
    "The current diagnostic confirms that key-information inconsistencies before and after rendering have been resolved.",
  "초기 HTML만 확인해도 페이지의 주제와 주요 서비스가 이해됩니다.":
    "The page topic and main service can be understood from the initial HTML alone.",
  "title, meta description, H1과 핵심 본문의 의미가 서로 일관됩니다.":
    "The title, meta description, H1, and core body content are semantically consistent.",
  "사용자에게 보이는 내용과 AI에 제공되는 핵심 정보가 일치합니다.":
    "The content visible to users matches the core information provided to AI.",
  "이번 차수 진단에서 이전에 누락된 초기 HTML 핵심 항목이 보완되었음이 확인됩니다.":
    "The current diagnostic confirms that the previously missing initial HTML core items are now present.",
  "초기 HTML에는 단순 글자 채우기가 아니라 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차를 자연스러운 본문 섹션으로 포함해 주세요.":
    "Do not add filler text to the initial HTML. Include the service definition and core value, target users and representative use cases, and a 3-5 step usage flow as natural body sections.",
  "초기 HTML 본문이 200자 이상이며 렌더링 DOM 본문의 75% 이상을 포함합니다.":
    "The initial HTML body has at least 200 characters and contains at least 75% of the rendered DOM body.",
  "초기 HTML만 확인해도 서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약을 이해할 수 있습니다.":
    "The service definition, target customers, representative use cases, usage process, and pricing/data handling summary can be understood from the initial HTML alone.",
  "이번 차수 진단에서 초기 HTML 본문·링크 포함 비율이 기준을 충족합니다.":
    "The current diagnostic confirms that initial HTML body and link coverage meet the criteria.",
};

function workOrderRenderedText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;

  const translateLine = (line: string): string => {
    const trimmed = line.trim();
    const bullet = trimmed.startsWith("- ");
    const body = bullet ? trimmed.slice(2).trim() : trimmed;
    const exact = WORK_ORDER_RENDERED_TEXT_EN[body];

    if (exact) {
      return `${bullet ? "- " : ""}${exact}`;
    }

    return line
      .replace(/현재 상태:/g, "Current state:")
      .replace(/무슨 뜻인가요:/g, "What it means:")
      .replace(/무엇을 바꾸나요:/g, "What to change:")
      .replace(/초기 HTML/g, "initial HTML")
      .replace(/렌더링 DOM/g, "rendered DOM")
      .replace(
        /본문 글자 수가 ([0-9,]+)자에서 ([0-9,]+)자로 늘었습니다\./g,
        "Body text length increased from $1 chars to $2 chars.",
      )
      .replace(
        /내부 링크가 ([0-9,]+)개에서 ([0-9,]+)개로 늘었습니다\./g,
        "Internal links increased from $1 to $2.",
      )
      .replace(
        /초기 HTML 본문 포함 비율은 ([0-9.]+)%입니다\./g,
        "Initial HTML body coverage is $1%.",
      )
      .replace(
        /초기 HTML 내부 링크 포함 비율은 ([0-9.]+)%입니다\./g,
        "Initial HTML internal link coverage is $1%.",
      );
  };

  return value.split("\n").map(translateLine).join("\n");
}

function fontPaths(filename: string): string[] {
  return [
    join(process.cwd(), "dist", "assets", "fonts", "pretendard", filename),
    join(process.cwd(), "server", "assets", "fonts", "pretendard", filename),
  ];
}

function requireFontPath(filename: string): string {
  const candidates = fontPaths(filename);
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

function pdfCriterionCode(value: string): string {
  return cleanText(value)
    .replace(/^CONTENT-HEADINGS-001-(\d+)$/, "HEADINGS-$1")
    .replace(/^CONTENT-INITIAL-001-(\d+)$/, "INITIAL-TEXT-$1")
    .replace(/^CONTENT-ANSWERABILITY-001-(\d+)$/, "ANSWER-$1")
    .replace(/^STRUCT-LINKS-001-(\d+)$/, "LINKS-$1")
    .replace(/^RENDERED-ADDED-CONTENT-(\d+)$/, "JS-CONTENT-$1")
    .replace(
      /^RENDERED-INCONSISTENT-(?:INFORMATION|INFORM)-(\d+)$/,
      "JS-CONSISTENCY-$1",
    )
    .replace(/^INITIAL-HTML-MISSING-CORE-(\d+)$/, "INITIAL-HTML-$1");
}

function formatKST(value: string | null, isEnglish = false): string {
  if (!value) {
    return isEnglish ? "No record" : "기록 없음";
  }

  return new Intl.DateTimeFormat(isEnglish ? "en-US" : "ko-KR", {
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
  return document.font(FONT_REGULAR_NAME).fontSize(size).fillColor(color);
}

function setBold(
  document: PDFKit.PDFDocument,
  size = 9.5,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document.font(FONT_BOLD_NAME).fontSize(size).fillColor(color);
}

function writeSectionTitle(document: PDFKit.PDFDocument, title: string): void {
  ensureSpace(document, 30);
  const x = document.page.margins.left;

  document.x = x;
  setBold(document, 12, COLORS.text).text(cleanText(title), x, document.y, {
    width: contentWidth(document),
  });
  document
    .moveDown(0.35)
    .strokeColor(COLORS.border)
    .lineWidth(0.7)
    .moveTo(x, document.y)
    .lineTo(document.page.width - document.page.margins.right, document.y)
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
  setRegular(document, 9.2, COLORS.text).text(safeValue, x + labelWidth, rowY, {
    width: width - labelWidth,
    lineGap: 2,
  });

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
    document.roundedRect(x, y, 4, boxHeight, 2).fill(options.accent);
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
  writeSectionTitle(
    document,
    isEnglish ? "Completion criteria" : "완료 판정 기준",
  );

  for (const criterion of item.acceptanceCriteria) {
    const x = document.page.margins.left;
    const width = contentWidth(document);
    const codeWidth = 92;
    const requiredWidth = 40;
    const padding = 10;
    const labelWidth = width - codeWidth - requiredWidth - padding * 4;
    const label = cleanText(workOrderRenderedText(criterion.label, isEnglish));
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
      criterion.required
        ? isEnglish
          ? "Required"
          : "필수"
        : isEnglish
          ? "Recommended"
          : "권장",
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
    return isEnglish
      ? "No saved initial diagnostic evidence."
      : "저장된 최초 검사 증거가 없습니다.";
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
    : isEnglish
      ? "This item was automatically generated from the same diagnostic's initial HTML and JavaScript-rendered DOM comparison. Check the diagnostic report for the original comparison values."
      : "이 항목은 같은 검사의 초기 HTML과 JavaScript 렌더링 비교 결과에서 자동 생성되었습니다. 원본 비교 수치는 진단 보고서에서 확인하세요.";
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

  writeSectionTitle(
    document,
    isEnglish ? "Initial diagnostic evidence" : "최초 검사 증거",
  );

  const x = document.page.margins.left;
  document.x = x;
  setRegular(document, 7.4, COLORS.muted).text(text, x, document.y, {
    width,
    lineGap: 2,
  });
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

  document.roundedRect(x, top, width, 116, 12).fill(COLORS.primary);

  setBold(document, 10, COLORS.white).text("SITE AI SCORE", x + 22, top + 19, {
    width: width - 44,
    characterSpacing: 1.2,
  });

  setBold(document, 24, COLORS.white).text(
    isEnglish
      ? `${cleanText(workOrder.site.name)} Improvement Work Order`
      : `${cleanText(workOrder.site.name)} 수정 작업지시서`,
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
        : isEnglish
          ? STATUS_LABELS_EN[workOrder.status]
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
    .roundedRect(x + scoreWidth + gap, scoreY, scoreWidth, scoreHeight, 10)
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
    workOrder.scoreBefore === null ? "-" : String(workOrder.scoreBefore),
    x + 14,
    scoreY + 31,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );
  setRegular(document, 8.2, COLORS.muted).text(
    cleanText(
      workOrder.gradeBefore ?? (isEnglish ? "Not calculated" : "미계산"),
    ),
    x + 70,
    scoreY + 44,
    {
      width: scoreWidth - 84,
    },
  );

  const scoreGoal = workOrderScoreGoal(workOrder.scoreBefore);

  setBold(document, 8.4, COLORS.primaryDark).text(
    isEnglish ? "Improvement targets" : "개선 목표",
    x + scoreWidth + gap + 14,
    scoreY + 13,
    {
      width: scoreWidth - 28,
    },
  );
  setBold(document, 18, COLORS.primary).text(
    isEnglish
      ? pdfGoalRange(scoreGoal.finalMin, scoreGoal.finalMax, isEnglish)
      : pdfGoalRange(scoreGoal.finalMin, scoreGoal.finalMax, isEnglish),
    x + scoreWidth + gap + 14,
    scoreY + 33,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );

  document.y = scoreY + scoreHeight + 22;

  writeSectionTitle(
    document,
    isEnglish ? "Work order information" : "작업지시서 정보",
  );
  writeLabelValue(
    document,
    isEnglish ? "Customer" : "고객",
    workOrder.customerOrganization.name,
  );
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
  writeLabelValue(
    document,
    isEnglish ? "Rules version" : "규칙 버전",
    workOrder.rulesVersion,
  );
  writeLabelValue(
    document,
    isEnglish ? "Issued at (KST)" : "발급 시각(KST)",
    formatKST(workOrder.issuedAt, isEnglish),
  );
  writeLabelValue(
    document,
    isEnglish ? "PDF generated at (KST)" : "PDF 생성 시각(KST)",
    formatKST(new Date().toISOString(), isEnglish),
  );

  writeSectionTitle(
    document,
    isEnglish ? "Work item summary" : "작업 항목 요약",
  );

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
      `${cleanText(item.itemCode)} / ${cleanText(
        workOrderRenderedText(item.title, isEnglish),
      )}`,
      x + 34,
      y,
      {
        width: width - 112,
      },
    );
    setBold(document, 8.1, COLORS.primaryDark).text(
      item.weight > 0
        ? isEnglish
          ? `${item.weight} pts`
          : `${item.weight}점`
        : isEnglish
          ? "Non-score"
          : "점수 외",
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
    isEnglish
      ? "This work order is written to target the displayed score range and improve the remaining items. Actual scores may vary depending on deployment status, server responses, robots.txt, llms.txt, structured data, and AI bot accessibility."
      : "이 작업지시서는 표시된 목표 점수 범위와 남은 항목 개선을 기준으로 작성되었습니다. 실제 점수는 배포 상태, 서버 응답, robots.txt, llms.txt, 구조화 데이터 반영 여부, AI 봇 접근성에 따라 달라질 수 있습니다.",
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
      workOrderRenderedText(item.developerMessage, isEnglish),
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

  writeSectionTitle(
    document,
    isEnglish ? "Execution work bundles" : "실행용 작업 묶음",
  );

  setRegular(document, 8.6, COLORS.muted).text(
    isEnglish
      ? "Work items have been reorganized into Epic-level bundles that are easier for developers to implement."
      : "작업 항목을 개발자가 실제로 처리하기 좋은 Epic 단위로 재구성했습니다.",
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
        ? "The next diagnostic and scoring follow the detailed items later in this document. Developers should implement the P0 to P4 bundles in order, then review the detailed completion criteria for each linked item."
        : "다음 차수 진단과 점수 계산은 뒤쪽 상세 항목 기준으로 진행되며, 개발자는 P0~P4 묶음을 순서대로 구현한 뒤 각 연결 항목의 상세 완료 기준을 확인하면 됩니다.",
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
      title: isEnglish
        ? "Initial HTML/SSR/SSG technical recovery gate"
        : "초기 HTML/SSR/SSG 필수 복구 게이트",
      owner: isEnglish ? "Frontend / full-stack" : "프론트엔드 / 풀스택",
      body: [
        isEnglish
          ? "Linked items: STRUCT-H1, CONTENT-HEADINGS, CONTENT-INITIAL, CONTENT-ANSWERABILITY, STRUCT-LINKS, CONTENT-NAVIGATION, META-CANONICAL."
          : "연결 항목: H1, 제목 계층, 초기 HTML 본문, 초기 콘텐츠 답변 기반, 내부 링크, 관련 콘텐츠 탐색 단서, canonical.",
        isEnglish
          ? "Before P0 is complete, content and schema work in P1 to P4 may not be visible to AI collectors or reflected in the score."
          : "P0가 완료되지 않으면 P1~P4의 콘텐츠와 구조화 데이터 작업도 AI 수집과 점수에 충분히 반영되지 않을 수 있습니다.",
        isEnglish
          ? "Expose one H1, meaningful H2 sections, core body content, canonical, and standard internal links in the initial HTML."
          : "초기 HTML에서 대표 H1 1개, 의미 있는 H2 섹션, 핵심 본문, canonical, 표준 내부 링크가 확인되도록 합니다.",
        isEnglish
          ? "For React-based sites, use SSR, SSG, prerendering, or an equivalent approach that fits the current architecture."
          : "React 기반이면 SSR, SSG, 사전 렌더링 또는 현재 구조에 맞는 동등한 방식을 적용합니다.",
        isEnglish
          ? "Required gate: initial HTML body has at least 200 characters, internal target is 800 characters, initial body/link coverage reaches the reference threshold, and existing UI/features do not regress."
          : "필수 게이트: 초기 HTML 본문 200자 이상, 내부 목표 800자, 본문·링크 포함 비율 기준 충족, 기존 UI와 주요 기능 회귀 없음.",
      ],
    },
    {
      priority: "P1",
      title: isEnglish
        ? "Base JSON-LD structured data"
        : "기본 JSON-LD 구조화 데이터",
      owner: isEnglish ? "Frontend / SEO engineer" : "프론트엔드 / SEO 담당",
      body: [
        isEnglish
          ? "Linked items: STRUCT-JSONLD and STRUCT-JSONLD-TYPES."
          : "연결 항목: JSON-LD 구조화 데이터, JSON-LD 유형 식별.",
        isEnglish
          ? "Add valid Schema.org JSON-LD to the initial HTML, prioritizing WebSite, Organization, and WebApplication for SaaS/web services."
          : "초기 HTML에 유효한 Schema.org JSON-LD를 추가하고 SaaS·웹서비스는 WebSite, Organization, WebApplication 조합을 우선 검토합니다.",
        isEnglish
          ? "Keep the JSON-LD name, URL, description, and FAQ values consistent with the visible page and metadata."
          : "JSON-LD의 이름, URL, 설명, FAQ 값이 화면 본문과 메타데이터의 의미와 일치해야 합니다.",
      ],
    },
    {
      priority: "P2",
      title: isEnglish ? "AI answer-readiness content" : "AI 답변 준비 콘텐츠",
      owner: isEnglish
        ? "Content planning + frontend"
        : "콘텐츠 기획 + 프론트엔드",
      body: [
        isEnglish
          ? "Linked items: service definition, target users/use cases, usage flow/outcome, pricing/free-paid scope, and support/contact."
          : "연결 항목: 서비스 정의, 이용 대상·활용 사례, 이용 절차·결과물, 요금·무료/유료 범위, 고객지원·문의 채널.",
        isEnglish
          ? "Write official user-facing copy that lets AI answer what the service provides, who it is for, how it works, what it costs, and how to get support."
          : "AI가 무엇을 제공하는지, 누구에게 적합한지, 어떻게 이용하는지, 비용은 어떻게 되는지, 어디로 문의하는지 답할 수 있도록 공식 문구를 작성합니다.",
        isEnglish
          ? "The content must be visible to users and also present in the initial HTML after P0."
          : "이 콘텐츠는 사용자에게 보이는 화면에 있어야 하며 P0 이후 초기 HTML에서도 확인되어야 합니다.",
      ],
    },
    {
      priority: "P3",
      title: isEnglish ? "Trust schema expansion" : "신뢰 스키마 확장",
      owner: isEnglish ? "Frontend / SEO engineer" : "프론트엔드 / SEO 담당",
      body: [
        isEnglish
          ? "Linked items: sameAs, contactPoint, SearchAction, and entity trust structured signals."
          : "연결 항목: sameAs, contactPoint, SearchAction, 운영 주체·문의 구조화 신호.",
        isEnglish
          ? "Do not split these into unrelated edits. Extend the same Organization/WebSite/WebApplication JSON-LD graph consistently."
          : "이 항목들을 따로따로 흩어서 수정하지 말고 Organization/WebSite/WebApplication JSON-LD 그래프를 일관되게 확장합니다.",
        isEnglish
          ? "If the site has no internal search feature, SearchAction can be handled as a low-priority review item rather than inventing a fake search URL."
          : "사이트 내부 검색 기능이 없다면 SearchAction은 가짜 검색 URL을 만들지 말고 낮은 우선순위 검토 항목으로 처리합니다.",
      ],
    },
    {
      priority: "P4",
      title: isEnglish
        ? "Policy, proof, and conversion-policy content"
        : "정책·차별점·전환 기준 콘텐츠",
      owner: isEnglish
        ? "Planning/legal review + frontend"
        : "기획/정책 검토 + 프론트엔드",
      body: [
        isEnglish
          ? "Linked items: data policy, differentiation/proof, and transaction/contact policy."
          : "연결 항목: 개인정보·입력자료 처리, 차별점·신뢰 근거, 거래·예약·문의 정책.",
        isEnglish
          ? "Confirm the conversion intent: direct payment, reservation/inquiry conversion, or informational. The completion criteria differ by this type."
          : "전환 유형이 직접 결제형, 예약·문의 전환형, 정보 제공형 중 무엇인지 확인합니다. 유형에 따라 완료 기준이 달라집니다.",
        isEnglish
          ? "Add privacy/data handling, operator/contact policy, refund/cancellation or inquiry policy where relevant, and factual proof such as examples, testimonials, or results."
          : "개인정보·자료 처리, 운영 주체와 문의 정책, 필요 시 환불·취소·변경 기준, 사례·후기·실적 같은 사실 기반 신뢰 근거를 보강합니다.",
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
      isEnglish
        ? `Recommended owner: ${epic.owner}`
        : `권장 담당: ${epic.owner}`,
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
    isEnglish ? "Re-diagnostic principles" : "재진단 원칙",
    isEnglish
      ? "P0 is the technical gate. After deploying P0, start the next Site AI Score diagnostic against the same production URL before treating P1 to P4 as complete. If possible, also ask ChatGPT, Perplexity, and Claude real service-description questions to manually confirm that AI systems describe the service without distortion. The 800-character and 75% values are internal reference criteria and do not guarantee AI search visibility or recommendation results."
      : "P0는 기술 게이트입니다. P0 배포 후 같은 운영 URL로 다음 차수 Site AI Score 진단을 실행한 뒤 P1~P4 완료 여부를 판단해 주세요. 가능하면 ChatGPT·Perplexity·Claude 등에 실제 서비스 설명 질문을 던져 AI가 서비스를 왜곡 없이 설명하는지 수동 확인해 주세요. 800자와 75%는 내부 참고 기준이며 AI 검색 노출이나 추천 결과를 보장하지 않습니다.",
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
    isEnglish
      ? `Work item ${index + 1} / ${workOrder.items.length}`
      : `작업 항목 ${index + 1} / ${workOrder.items.length}`,
    {
      width,
      characterSpacing: 0.7,
    },
  );
  document.moveDown(0.45);

  setBold(document, 18, COLORS.text).text(
    cleanText(workOrderRenderedText(item.title, isEnglish)),
    {
      width,
      lineGap: 3,
    },
  );
  document.moveDown(0.35);

  setRegular(document, 8.3, COLORS.muted).text(
    `${cleanText(item.itemCode)} / ${
      item.finding
        ? item.isRequired
          ? isEnglish
            ? "Required item"
            : "필수 항목"
          : isEnglish
            ? "General item"
            : "일반 항목"
        : isEnglish
          ? "Recommended improvement"
          : "권장 개선"
    } / ${
      item.weight > 0
        ? isEnglish
          ? `Expected +${item.weight} pts`
          : `예상 ${item.weight}점`
        : isEnglish
          ? "Non-score improvement"
          : "점수 외 개선"
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

  setBold(document, 7.6, COLORS.muted).text(
    isEnglish ? "Target URL" : "대상 URL",
    x + 13,
    metaY,
    {
      width: 70,
    },
  );
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
    ? ((isEnglish ? FINDING_STATUS_LABELS_EN : FINDING_STATUS_LABELS)[
        item.finding.status
      ] ?? cleanText(item.finding.status))
    : isEnglish
      ? "Additional improvement recommended"
      : "추가 개선 권장";
  const findingSeverity = item.finding?.severity
    ? ((isEnglish ? SEVERITY_LABELS_EN : SEVERITY_LABELS)[
        item.finding.severity
      ] ?? cleanText(item.finding.severity))
    : isEnglish
      ? "AI collection stability"
      : "AI 수집 안정성";

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
      workOrderFindingDescription(item.finding.description, isEnglish),
      {
        background: "#FFF7ED",
        border: "#FED7AA",
        accent: "#F59E0B",
      },
    );
  }

  writeTextBox(
    document,
    isEnglish ? "Required change" : "수정 요구사항",
    workOrderRenderedText(item.requirement, isEnglish),
    {
      background: COLORS.white,
      border: COLORS.border,
      accent: COLORS.primary,
    },
  );

  writeTextBox(
    document,
    isEnglish ? "Developer instructions" : "개발자 전달용 문구",
    workOrderRenderedText(item.developerMessage, isEnglish),
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
    const y = document.page.height - document.page.margins.bottom - 12;

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
  const regularFontPath = requireFontPath("Pretendard-Regular.ttf");
  const boldFontPath = requireFontPath("Pretendard-SemiBold.ttf");

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
      Title: isEnglish
        ? `${cleanText(workOrder.site.name)} Improvement Work Order`
        : `${cleanText(workOrder.site.name)} 수정 작업지시서`,
      Author: "Site AI Score",
      Subject: `${cleanText(workOrder.orderNumber)} v${workOrder.version}`,
      Keywords: isEnglish
        ? "Site AI Score, AEO, work order"
        : "Site AI Score, AEO, 작업지시서",
      CreationDate: new Date(),
    },
  });

  document.registerFont(FONT_REGULAR_NAME, regularFontPath);
  document.registerFont(FONT_BOLD_NAME, boldFontPath);

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
  writeSectionTitle(
    document,
    isEnglish ? "Usage notes and disclaimer" : "이용 안내 및 면책",
  );
  setRegular(document, 9.2, COLORS.text).text(
    isEnglish
      ? "This work order is based on issues found for the specified diagnostic URL and rules version. The customer site source code does not need to be submitted; after changes are deployed, the completion criteria must be verifiable on the public URL."
      : "이 작업지시서는 명시된 진단 URL과 규칙 버전에서 발견된 문제를 기준으로 작성되었습니다. 고객 사이트의 소스코드를 제출할 필요는 없으며, 수정 후 배포된 공개 URL에서 완료 기준을 다음 차수 진단으로 확인할 수 있어야 합니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
  document.moveDown(0.9);
  setRegular(document, 9.2, COLORS.text).text(
    isEnglish
      ? "The improvement targets are planning targets for this work order, not guarantees of score increases, AI search visibility, recommendation results, overall site security, or the integrity of all features. Values such as 800 characters or 75% are internal Site AI Score reference criteria, not official standards of any search engine or AI service."
      : "개선 목표는 이 작업지시서의 수정 계획상 목표이며 실제 점수 상승, AI 검색 노출, 추천 결과, 사이트 전체 보안성과 모든 기능의 무결성을 보장하지 않습니다. 800자, 75% 같은 수치는 Site AI Score 내부 참고 기준이며 모든 검색엔진이나 AI 서비스의 공식 기준이 아닙니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
    document.moveDown(0.9);
    setBold(document, 9.2, COLORS.primaryDark).text(
      isEnglish
        ? "Preview and correct the full site before deployment"
        : "배포 전 전체 화면 미리보기 및 교정 필수",
      {
        width: contentWidth(document),
      },
    );
    document.moveDown(0.35);
    setRegular(document, 9.2, COLORS.text).text(
      isEnglish
        ? "Adding new cards or copy during implementation may change the overall layout and line wrapping. Before deployment, preview the mobile, tablet, and desktop views and correct spacing, alignment, overlap, and readability issues."
        : "사이트 수정 과정에서 새로운 카드나 문구가 추가되면 전체 배열과 줄바꿈이 달라질 수 있습니다. 배포 전에 모바일·태블릿·PC 화면을 반드시 미리 확인하고, 간격·정렬·겹침·가독성을 교정한 뒤 배포하세요.",
      {
        width: contentWidth(document),
        lineGap: 4,
      },
    );
  document.moveDown(1.2);
  setBold(document, 9, COLORS.primaryDark).text(
    isEnglish
      ? "Site AI Score - Diagnostics, work orders, and numbered re-diagnostics"
      : "Site AI Score - 진단, 작업지시서, 차수별 재진단",
    {
      width: contentWidth(document),
    },
  );

  addFooters(document, workOrder);
  document.end();

  return completed;
}
