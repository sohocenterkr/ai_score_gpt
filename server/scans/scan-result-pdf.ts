import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type {
  PublicScanResult,
  PublicScanResultFinding,
} from "./scan-result-service";

const FONT_REGULAR_NAME = "SiteAiScoreReportRegular";
const FONT_BOLD_NAME = "SiteAiScoreReportSemiBold";
export const SCAN_RESULT_PDF_RENDERER_VERSION = "2026.07-scan-locale-v5";

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

const STATUS_LABELS_KO: Record<PublicScanResultFinding["status"], string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const STATUS_LABELS_EN: Record<PublicScanResultFinding["status"], string> = {
  PASS: "Pass",
  FAIL: "Fail",
  BLOCKED: "Unable to verify",
  NA: "Not scored",
};

const SEVERITY_LABELS_KO: Record<PublicScanResultFinding["severity"], string> =
  {
    INFO: "참고",
    LOW: "낮음",
    MEDIUM: "주의",
    HIGH: "높음",
    CRITICAL: "매우 높음",
  };

const SEVERITY_LABELS_EN: Record<PublicScanResultFinding["severity"], string> =
  {
    INFO: "Info",
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };

function statusLabel(
  status: PublicScanResultFinding["status"],
  locale: "ko" | "en" = "ko",
): string {
  return locale === "en" ? STATUS_LABELS_EN[status] : STATUS_LABELS_KO[status];
}

function severityLabel(
  severity: PublicScanResultFinding["severity"],
  locale: "ko" | "en" = "ko",
): string {
  return locale === "en"
    ? SEVERITY_LABELS_EN[severity]
    : SEVERITY_LABELS_KO[severity];
}

const PDF_CATEGORY_LABELS_EN: Record<string, string> = {
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
  "AI 에이전트 사용 가능성": "AI agent usability",
  "신뢰성 및 추적 환경": "Trust and tracking environment",
  "최신성 및 추적 환경": "Freshness and tracking environment",
  "최신성 및 측정 환경": "Freshness and measurement environment",
};

const PDF_FOUND_LABELS_EN: Record<string, string> = {
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
  "대표 H1": "Primary H1",
  "최상위 제목(H1)": "Top-level heading (H1)",
  "제목 계층 구조": "Heading hierarchy",
  "제공 계층 구조": "Heading hierarchy",
  "페이지 링크 구조": "Page link structure",
  "관련 콘텐츠 탐색 단서": "Related content discovery signals",
};

const PDF_FINDING_TITLES_EN: Record<string, string> = {
  "HTTP 접근": "HTTP access",
  "대표 페이지 HTTP 응답": "Main page HTTP response",
  "HTTPS 사용": "HTTPS usage",
  "robots.txt": "robots.txt",
  "robots.txt 접근": "robots.txt access",
  "robots.txt 기초 증거": "robots.txt baseline evidence",
  "robots.txt 검색 봇 정책": "robots.txt search bot policy",
  "OAI-SearchBot 검색 접근": "OAI-SearchBot search access",
  "ChatGPT-User 사용자 요청 접근": "ChatGPT-User request access",
  "GPTBot 학습 접근 정책": "GPTBot training access policy",
  sitemap: "Sitemap",
  사이트맵: "Sitemap",
  "HTML 콘텐츠": "HTML content",
  "문서 제목(title)": "Document title",
  "페이지 제목": "Page title",
  "메타 설명": "Meta description",
  "페이지 설명": "Page description",
  "대표 URL(canonical)": "Canonical URL",
  "Open Graph 핵심 메타데이터": "Core Open Graph metadata",
  "대표 제목(H1)": "Main heading (H1)",
  "최상위 제목(H1)": "Top-level heading (H1)",
  "제목 계층 구조": "Heading hierarchy",
  "문서 기본 언어": "Document language",
  "문서 언어": "Document language",
  "JSON-LD 구조화 데이터": "JSON-LD structured data",
  "JSON-LD 유형 식별": "JSON-LD type identification",
  "초기 HTML 텍스트": "Initial HTML text",
  "초기 콘텐츠 답변 기반": "Initial content answer basis",
  "초기 HTML 내부 링크": "Initial HTML internal links",
  "페이지 링크 구조": "Page link structure",
  "관련 콘텐츠 탐색 단서": "Related content discovery signals",
  "초기 HTML의 iframe 비의존성": "Initial HTML iframe independence",
  "색인 허용 상태": "Indexability status",
  "메타 로봇 정책": "Meta robots policy",
  "HTTPS 리디렉션": "HTTPS redirect",
  "실제 공개 URL 측정 환경": "Live public URL measurement environment",
};

const PDF_TEXT_EN: Record<string, string> = {
  "공개 URL이 정상 응답했습니다.": "The public URL responded successfully.",
  "대표 페이지가 정상 HTTP 상태로 응답했습니다.":
    "The main page responded with a successful HTTP status.",
  "대표 페이지 HTTP 응답 상태를 확인해야 합니다.":
    "The main page HTTP response status should be reviewed.",
  "대표 페이지가 안정적으로 2xx 상태를 반환하도록 서버·리디렉션·WAF 설정을 확인하세요.":
    "Review server, redirect, and WAF settings so the main page reliably returns a 2xx status.",
  "최종 URL이 HTTPS를 사용합니다.": "The final URL uses HTTPS.",
  "최종 URL이 HTTPS를 사용하지 않습니다.": "The final URL does not use HTTPS.",
  "대표 URL과 모든 리디렉션을 HTTPS로 통일하세요.":
    "Use HTTPS consistently for the canonical URL and all redirects.",
  "사이트 루트에 접근 가능한 robots.txt를 제공하고 검색용 AI 봇 정책을 명시하세요.":
    "Provide an accessible robots.txt at the site root and specify policies for AI search bots.",
  "robots.txt의 sitemap 선언과 봇별 정책 분석을 위한 기초 증거를 수집했습니다.":
    "Baseline evidence was collected for sitemap declarations and bot-specific policy analysis in robots.txt.",
  "robots.txt 선언 또는 사이트 루트에서 유효한 sitemap을 확인했습니다.":
    "A valid sitemap was found from robots.txt declarations or the site root.",
  "확인한 sitemap 후보에서 유효한 XML sitemap을 찾지 못했습니다.":
    "No valid XML sitemap was found among the checked sitemap candidates.",
  "robots.txt에 실제 sitemap URL을 선언하고 해당 주소가 2xx XML 응답을 반환하도록 설정하세요.":
    "Declare the actual sitemap URL in robots.txt and make sure it returns a 2xx XML response.",
  "대표 페이지에서 HTML 문서를 확인했습니다.":
    "An HTML document was found on the main page.",
  "대표 페이지 응답을 HTML 문서로 확인하지 못했습니다.":
    "The main page response could not be confirmed as an HTML document.",
  "대표 URL이 사람이 읽을 수 있는 HTML 문서를 반환하는지 확인하세요.":
    "Make sure the main URL returns a human-readable HTML document.",
  "초기 HTML에서 문서 제목을 확인했습니다.":
    "The document title was found in the initial HTML.",
  "초기 HTML에서 문서 제목을 찾지 못했습니다.":
    "The document title was not found in the initial HTML.",
  "각 페이지의 주제를 분명히 설명하는 고유한 title 요소를 초기 HTML에 추가하세요.":
    "Add a unique title element to the initial HTML that clearly describes each page topic.",
  "초기 HTML에서 메타 설명을 확인했습니다.":
    "The meta description was found in the initial HTML.",
  "초기 HTML에서 메타 설명을 찾지 못했습니다.":
    "The meta description was not found in the initial HTML.",
  "페이지의 핵심 내용을 요약하는 meta description을 초기 HTML에 추가하세요.":
    "Add a meta description to the initial HTML that summarizes the page's core content.",
  "canonical URL을 확인했습니다.": "The canonical URL was found.",
  "canonical URL을 찾지 못했습니다.": "The canonical URL was not found.",
  "중복 URL 판단을 돕도록 대표 URL을 가리키는 canonical 링크를 추가하세요.":
    "Add a canonical link pointing to the representative URL to help identify duplicate URLs.",
  "og:title과 og:description을 확인했습니다.":
    "og:title and og:description were found.",
  "og:title 또는 og:description이 누락되었습니다.":
    "og:title or og:description is missing.",
  "공유·요약 문맥을 돕도록 og:title과 og:description을 초기 HTML에 추가하세요.":
    "Add og:title and og:description to the initial HTML to support sharing and summary context.",
  "초기 HTML에서 H1 제목을 확인했습니다.":
    "An H1 heading was found in the initial HTML.",
  "초기 HTML에서 H1 제목을 찾지 못했습니다.":
    "No H1 heading was found in the initial HTML.",
  "페이지의 핵심 주제를 나타내는 H1 제목을 초기 HTML에 추가하세요.":
    "Add an H1 heading to the initial HTML that represents the page's core topic.",
  "H1과 H2를 사용한 기본 제목 계층을 확인했습니다.":
    "A basic heading hierarchy using H1 and H2 was found.",
  "H1과 H2를 함께 사용한 기본 제목 계층이 부족합니다.":
    "The page lacks a basic heading hierarchy using both H1 and H2.",
  "페이지 주제와 하위 내용을 H1·H2 계층으로 명확히 구분하세요.":
    "Clearly separate the page topic and subtopics using an H1/H2 hierarchy.",
  "HTML lang 속성을 확인했습니다.": "The HTML lang attribute was found.",
  "HTML lang 속성을 찾지 못했습니다.": "The HTML lang attribute was not found.",
  "html 요소에 페이지의 기본 언어를 나타내는 lang 속성을 추가하세요.":
    "Add a lang attribute to the html element to indicate the page's primary language.",
  "유효한 JSON-LD 구조화 데이터를 확인했습니다.":
    "Valid JSON-LD structured data was found.",
  "유효한 JSON-LD 구조화 데이터를 확인하지 못했습니다.":
    "Valid JSON-LD structured data was not found.",
  "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.":
    "No valid JSON-LD structured data was found in the initial HTML.",
  "사이트의 업종과 핵심정보에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.":
    "Add Schema.org JSON-LD to the initial HTML that matches the site's type and key information.",
  "사이트에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.":
    "Add Schema.org JSON-LD that fits the site to the initial HTML.",
  "JSON-LD에서 Schema.org 유형을 식별했습니다.":
    "A Schema.org type was identified in the JSON-LD.",
  "식별 가능한 JSON-LD @type이 없습니다.":
    "No identifiable JSON-LD @type was found.",
  "WebSite, Organization, LocalBusiness 등 사이트에 맞는 @type을 명시하세요.":
    "Specify an @type that fits the site, such as WebSite, Organization, or LocalBusiness.",
  "초기 HTML에서 읽을 수 있는 본문 텍스트를 확인했습니다.":
    "Readable body text was found in the initial HTML.",
  "초기 HTML의 읽을 수 있는 본문 텍스트가 매우 적습니다.":
    "The initial HTML contains very little readable body text.",
  "핵심 설명과 주요 정보를 JavaScript 실행 전 초기 HTML에서도 읽을 수 있게 제공하세요.":
    "Make core descriptions and key information readable in the initial HTML before JavaScript runs.",
  "초기 HTML에 기초 질문 답변에 사용할 수 있는 본문량이 있습니다.":
    "The initial HTML contains enough body text to support basic question answering.",
  "초기 HTML 본문량이 적어 사이트 기반 답변 생성이 제한될 수 있습니다.":
    "The initial HTML has too little body text, which may limit site-based answer generation.",
  "서비스·장소·이용방법 등 주요 질문에 답할 수 있는 설명을 초기 HTML에 보강하세요.":
    "Add explanations to the initial HTML that can answer key questions about the service, location, and usage process.",
  "초기 HTML에서 탐색 가능한 내부 링크를 확인했습니다.":
    "Navigable internal links were found in the initial HTML.",
  "초기 HTML에서 탐색 가능한 내부 링크를 찾지 못했습니다.":
    "Navigable internal links were not found in the initial HTML.",
  "주요 페이지로 이동할 수 있는 표준 a 링크를 초기 HTML에 제공하세요.":
    "Provide standard anchor links in the initial HTML so important pages can be reached.",
  "초기 HTML의 내부 링크가 관련 콘텐츠 탐색 단서를 제공합니다.":
    "Internal links in the initial HTML provide signals for discovering related content.",
  "관련 콘텐츠로 이어지는 내부 링크 단서가 부족합니다.":
    "There are not enough internal-link signals leading to related content.",
  "핵심 주제와 관련 페이지를 설명적인 링크 텍스트로 연결하세요.":
    "Connect the core topic and related pages using descriptive link text.",
  "초기 HTML만으로도 충분한 본문을 읽을 수 있습니다.":
    "Enough body text can be read from the initial HTML alone.",
  "iframe이 존재하고 초기 HTML 본문이 적어 핵심정보 의존 가능성이 있습니다.":
    "The page uses iframes and has little initial HTML body text, so key information may depend on iframe content.",
  "iframe 내부에만 있는 핵심정보를 상위 페이지 초기 HTML에도 제공하세요.":
    "Also provide key information from inside iframes in the parent page's initial HTML.",
  "robots meta와 X-Robots-Tag에서 noindex를 확인하지 못했습니다.":
    "No noindex directive was found in robots meta or X-Robots-Tag.",
  "robots meta 또는 X-Robots-Tag에 noindex가 있습니다.":
    "A noindex directive exists in robots meta or X-Robots-Tag.",
  "검사 시점의 공개 URL에서 초기 HTML과 JavaScript 실행 후 DOM을 함께 비교했습니다.":
    "The initial HTML and JavaScript-rendered DOM were compared on the public URL at scan time.",
  "검사 시점의 공개 URL에서 DNS·리디렉션·HTTP 응답과 초기 HTML을 새로 수집했습니다.":
    "DNS, redirects, HTTP response, and initial HTML were freshly collected from the public URL at scan time.",
  "초기 HTML과 JavaScript 실행 후 DOM을 함께 비교했습니다.":
    "The initial HTML and JavaScript-rendered DOM were compared.",
};

function translatePdfCategory(value: string, locale: "ko" | "en"): string {
  return locale === "en" ? (PDF_CATEGORY_LABELS_EN[value] ?? value) : value;
}

function translatePdfFoundLabel(value: string, locale: "ko" | "en"): string {
  return locale === "en" ? (PDF_FOUND_LABELS_EN[value] ?? value) : value;
}

function translatePdfFindingTitle(value: string, locale: "ko" | "en"): string {
  return locale === "en" ? (PDF_FINDING_TITLES_EN[value] ?? value) : value;
}

function translatePdfDiagnosticText(
  value: string | null | undefined,
  locale: "ko" | "en",
): string {
  if (!value) {
    return "";
  }

  if (locale !== "en") {
    return value;
  }

  return PDF_TEXT_EN[value] ?? value;
}

function translatePdfUnderstandingText(
  value: string,
  locale: "ko" | "en",
): string {
  if (locale !== "en") {
    return value;
  }

  return value
    .replace(
      /"([^"]+)" 페이지는 ([a-zA-Z-]+) 문서로 확인되었고 초기 HTML에서 약 ([0-9,]+)자의 본문을 읽었습니다\./g,
      (_match, title: string, language: string, characters: string) =>
        `The page "${title}" was identified as a ${language} document, and about ${characters} characters of body text were read from the initial HTML.`,
    )
    .replace(
      /사이트 설명은 "([^"]+)"로 확인됩니다\./g,
      'The site description was identified as "$1".',
    )
    .replace(
      /구조화 데이터 유형은 ([^.]+)입니다\./g,
      "Structured data types found: $1.",
    )
    .replace(
      /식별 가능한 JSON-LD 유형은 확인되지 않았습니다\./g,
      "No identifiable JSON-LD type was found.",
    )
    .replace(/언어 미확인/g, "language not confirmed");
}

const PDF_CONTENT_READINESS_TEXT_EN: Record<string, string> = {
  "800자와 75% 포함 비율은 Site AI Score가 기본 설명량과 렌더링 의존도를 비교하기 위해 사용하는 내부 참고 기준입니다. 모든 검색엔진이나 AI 서비스의 공통 공식 기준은 아니며, 핵심 목표는 글자 수 자체가 아니라 AI가 서비스의 정의·대상·이용 절차·요금·데이터 처리·FAQ를 정확히 인식하고 인용할 수 있게 하는 것입니다.":
    "The 800-character and 75% coverage values are internal Site AI Score reference criteria used to compare basic explanation volume and rendering dependency. They are not official universal standards for all search engines or AI services. The main goal is not the character count itself, but helping AI accurately recognize and cite the service definition, target users, usage process, pricing, data handling, and FAQs.",
  "위 항목은 현재 QUICK 증거에서 확인하지 못했거나 추가 검토가 필요한 후보입니다. 실제로 없다고 단정하지 않으며, 운영자가 사실관계를 확인한 뒤 사용자에게도 보이는 내용으로 작성해야 합니다.":
    "The items above are candidates that were not confirmed in the current QUICK evidence or need additional review. They do not mean the information is definitely absent. The site operator should verify the facts and publish the content in a form visible to users.",
  "서비스 정의와 핵심 가치": "Service definition and core value",
  "이용 대상과 활용 사례": "Target users and use cases",
  "이용 절차와 결과물": "Usage process and deliverables",
  "지원 범위와 제한 사항": "Supported scope and limitations",
  "요금·데이터 처리·운영 주체":
    "Pricing, data handling, and operator information",
  "자주 묻는 질문과 추가 탐색 경로": "FAQs and additional discovery paths",
  "문서 제목과 메타 설명에서 개요 일부를 확인했지만 실제 화면 본문의 충분성은 확인이 필요합니다.":
    "Some overview information was found in the document title and meta description, but the visible page body still needs to be reviewed for sufficiency.",
  "사이트가 무엇을 제공하는지 설명하는 본문을 현재 증거에서 충분히 확인하지 못했습니다.":
    "The current evidence did not sufficiently confirm body content explaining what the site provides.",
  "누구에게 적합한 서비스인지와 실제 활용 상황은 현재 QUICK 증거로 확인하지 못했습니다.":
    "The current QUICK evidence did not confirm who the service is for or how it is used in real situations.",
  "이용 방법 관련 단서 일부가 있으나 단계별 설명과 결과물 범위는 확인이 필요합니다.":
    "Some signals related to usage instructions were found, but the step-by-step process and deliverable scope need review.",
  "서비스 시작부터 결과 획득까지의 과정을 설명하는 단서를 충분히 확인하지 못했습니다.":
    "The evidence did not sufficiently confirm the process from starting the service to receiving the result.",
  "메타 설명에서 기능 또는 지원 범위 일부가 보이지만 상세 범위와 제한은 확인이 필요합니다.":
    "Some functions or support scope appear in the meta description, but the detailed scope and limitations need review.",
  "지원 기능·입력·출력·플랫폼과 제한을 현재 증거에서 확인하지 못했습니다.":
    "The current evidence did not confirm supported features, inputs, outputs, platforms, or limitations.",
  "관련 링크 단서는 있으나 실제 요금·자료 처리·운영 정보의 충분성은 확인이 필요합니다.":
    "Related link signals were found, but pricing, data handling, and operator information need to be reviewed for sufficiency.",
  "요금, 사용자 자료 처리, 운영 주체와 문의 방법을 현재 증거에서 충분히 확인하지 못했습니다.":
    "The current evidence did not sufficiently confirm pricing, user data handling, operator information, or contact methods.",
  "FAQ·도움말 관련 단서는 있으나 주요 질문에 실제로 답하는지는 확인이 필요합니다.":
    "FAQ or help-related signals were found, but it still needs to be checked whether they answer key questions.",
  "FAQ·가이드·문의 경로를 현재 증거에서 충분히 확인하지 못했습니다.":
    "The current evidence did not sufficiently confirm FAQ, guide, or contact paths.",
  "사용자가 어떤 문제를 해결할 수 있나요?": "What problem can users solve?",
  "어떤 결과물을 얻나요?": "What deliverables or outcomes do users receive?",
  "어떤 사람이 사용하면 좋은가요?": "Who is this service best for?",
  "어떤 상황에서 도움이 되나요?": "In what situations is it useful?",
  "대표 이용 사례는 무엇인가요?": "What are representative use cases?",
  "어떤 순서로 이용하나요?": "What is the usage flow?",
  "사용자가 준비할 것은 무엇인가요?": "What should users prepare?",
  "최종 결과물은 무엇인가요?": "What is the final deliverable?",
  "어떤 기능과 입력 자료를 지원하나요?":
    "What features and input materials are supported?",
  "지원 플랫폼·언어·출력 형식은 무엇인가요?":
    "Which platforms, languages, and output formats are supported?",
  "제한되는 경우는 무엇인가요?": "What are the limitations?",
  "무료·유료 범위는 어떻게 되나요?":
    "What is included in the free and paid plans?",
  "입력 자료는 어떻게 처리되나요?": "How is submitted data handled?",
  "누가 운영하고 어디로 문의하나요?":
    "Who operates the service and where can users ask questions?",
  "처음 사용하는 사람이 자주 묻는 질문은 무엇인가요?":
    "What questions do first-time users commonly ask?",
  "예외 상황은 어떻게 처리하나요?": "How are exceptions handled?",
  "더 자세한 설명은 어디에 있나요?":
    "Where can users find more detailed information?",
  "핵심 기능과 제공 가치": "Core features and value",
  "사용자가 얻는 결과": "User outcomes",
  "이런 분께 추천합니다": "Recommended for",
  "대표 활용 사례": "Representative use cases",
  "사용 전후 변화": "Before-and-after outcomes",
  "이용 방법": "How to use",
  "단계별 사용 과정": "Step-by-step usage process",
  "완성되는 결과물": "Final deliverables",
  "지원 기능과 범위": "Supported features and scope",
  "지원 플랫폼·형식": "Supported platforms and formats",
  "제한 사항": "Limitations",
  "요금과 이용 범위": "Pricing and usage scope",
  "개인정보·자료 처리": "Privacy and data handling",
  "운영 주체와 문의": "Operator and contact information",
  "자주 묻는 질문": "Frequently asked questions",
  "도움말과 이용 가이드": "Help and usage guide",
  "문의 및 지원": "Contact and support",
};

function translatePdfContentReadinessText(
  value: string,
  locale: "ko" | "en",
): string {
  if (locale !== "en") {
    return value;
  }

  const exact = PDF_CONTENT_READINESS_TEXT_EN[value];
  if (exact) {
    return exact;
  }

  return value
    .replace(/초기 HTML 본문: ([0-9,]+)자/g, "Initial HTML body: $1 chars")
    .replace(/문서 제목: /g, "Document title: ")
    .replace(/메타 설명: /g, "Meta description: ")
    .replace(/대표 H1: /g, "Primary H1: ")
    .replace(/H2 ([0-9,]+)개: /g, "H2 headings: $1 items: ")
    .replace(
      /초기 HTML 내부 링크: ([0-9,]+)개/g,
      "Initial HTML internal links: $1 items",
    )
    .replace(/JSON-LD 유형: /g, "JSON-LD types: ")
    .replace(
      /^(.+) 서비스는 무엇을 제공하나요\?$/g,
      "What does the $1 service provide?",
    )
    .replace(/^(.+) 서비스란\?$/g, "What is the $1 service?");
}

function translatePdfContentReadinessList(
  values: readonly string[],
  locale: "ko" | "en",
): string[] {
  return values.map((value) => translatePdfContentReadinessText(value, locale));
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

function formatKST(value: string | null, locale: "ko" | "en" = "ko"): string {
  if (!value) {
    return locale === "en" ? "Not recorded" : "기록 없음";
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
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
  return document.font(FONT_REGULAR_NAME).fontSize(size).fillColor(color);
}

function setBold(
  document: PDFKit.PDFDocument,
  size = 9.2,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document.font(FONT_BOLD_NAME).fontSize(size).fillColor(color);
}

function writeSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
): void {
  ensureSpace(document, subtitle ? 48 : 34);
  setBold(document, 14, COLORS.text).text(cleanText(title), {
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
    .lineTo(document.page.width - document.page.margins.right, document.y)
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
  setText(document, 9, COLORS.text).text(safeValue, x + labelWidth, y, {
    width: width - labelWidth,
    lineGap: 2,
  });

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
      ? `${original.slice(0, maxCharacters)}\n\n…`
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

function statusColors(status: PublicScanResultFinding["status"]): {
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

function pointImpact(
  finding: PublicScanResultFinding,
  locale: "ko" | "en" = "ko",
): string {
  const isEnglish = locale === "en";

  if (finding.weight <= 0 || finding.status === "NA") {
    return isEnglish ? "No score impact" : "점수 영향 없음";
  }

  return finding.status === "PASS"
    ? isEnglish
      ? `Earned ${finding.weight} pts`
      : `배점 ${finding.weight}점 획득`
    : isEnglish
      ? `${finding.weight} pts not earned`
      : `배점 ${finding.weight}점 미반영`;
}

function sanitizeSensitiveString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [보안상 숨김]")
    .replace(
      /(\b(?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n,;]+/gi,
      "$1[보안상 숨김]",
    )
    .replace(/(\b(?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi, "$1[보안상 숨김]")
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
      if (/authorization|cookie|set-cookie|password|secret|token/i.test(key)) {
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

function evidenceText(value: unknown, locale: "ko" | "en" = "ko"): string {
  if (value === null || value === undefined) {
    return locale === "en"
      ? "No stored diagnostic evidence."
      : "저장된 검사 증거가 없습니다.";
  }

  try {
    return cleanText(JSON.stringify(sanitizeEvidenceValue(value), null, 2));
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EvidenceObject)
    : null;
}

function objectNumber(
  record: EvidenceObject | null,
  key: string,
): number | null {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function objectString(
  record: EvidenceObject | null,
  key: string,
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

export function scanResultRenderedDomComparison(result: {
  findings: readonly {
    ruleCode: string;
    evidence: unknown;
  }[];
}): ScanResultRenderedDomComparison | null {
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
    browserVersion: objectString(renderedEvidence, "browserVersion"),
    durationMs: objectNumber(renderedEvidence, "durationMs"),
    pageErrorCount: objectNumber(renderedEvidence, "pageErrorCount"),
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
    initialDescription: objectString(initial, "metaDescription"),
    renderedDescription: objectString(rendered, "metaDescription"),
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
  locale: "ko" | "en" = "ko",
): string {
  const isEnglish = locale === "en";

  return value === null
    ? isEnglish
      ? "Not confirmed"
      : "미확인"
    : `${value.toLocaleString(isEnglish ? "en-US" : "ko-KR")}${suffix}`;
}

export function buildRenderedDomImprovementPlans(
  comparison: ScanResultRenderedDomComparison | null,
  locale: "ko" | "en" = "ko",
): RenderedDomImprovementPlan[] {
  const isEnglish = locale === "en";

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
  const textCoverage =
    textRendered > 0
      ? Math.min(textInitial / textRendered, 1)
      : textInitial > 0
        ? 1
        : 0;
  const linkCoverage =
    linkRendered > 0 ? Math.min(linkInitial / linkRendered, 1) : 1;
  const textGapNeedsWork = textInitial < 200 || textCoverage < 0.75;
  const linkGapNeedsWork =
    linkRendered > 0 &&
    (linkInitial < 1 || (linkCoverage < 0.75 && Math.abs(linkDelta) > 2));

  if (textGapNeedsWork || linkGapNeedsWork) {
    const stateParts = [
      comparison.metrics.textLength.initial !== null &&
      comparison.metrics.textLength.rendered !== null
        ? isEnglish
          ? `Body text length increased from ${displayMetric(
              comparison.metrics.textLength.initial,
              " chars",
              locale,
            )} to ${displayMetric(
              comparison.metrics.textLength.rendered,
              " chars",
              locale,
            )}.`
          : `본문 글자 수가 ${displayMetric(
              comparison.metrics.textLength.initial,
              "자",
            )}에서 ${displayMetric(
              comparison.metrics.textLength.rendered,
              "자",
            )}로 늘었습니다.`
        : null,
      comparison.metrics.internalLinks.initial !== null &&
      comparison.metrics.internalLinks.rendered !== null
        ? isEnglish
          ? `Internal links increased from ${displayMetric(
              comparison.metrics.internalLinks.initial,
              " items",
              locale,
            )} to ${displayMetric(
              comparison.metrics.internalLinks.rendered,
              " items",
              locale,
            )}.`
          : `내부 링크가 ${displayMetric(
              comparison.metrics.internalLinks.initial,
              "개",
            )}에서 ${displayMetric(
              comparison.metrics.internalLinks.rendered,
              "개",
            )}로 늘었습니다.`
        : null,
      textRendered > 0
        ? isEnglish
          ? `Initial HTML body coverage is ${(textCoverage * 100).toFixed(1)}%.`
          : `초기 HTML 본문 포함 비율은 ${(textCoverage * 100).toFixed(1)}%입니다.`
        : null,
      linkRendered > 0
        ? isEnglish
          ? `Initial HTML internal link coverage is ${(linkCoverage * 100).toFixed(1)}%.`
          : `초기 HTML 내부 링크 포함 비율은 ${(linkCoverage * 100).toFixed(1)}%입니다.`
        : null,
    ].filter((value): value is string => Boolean(value));

    plans.push({
      code: "RENDERED-ADDED-CONTENT",
      title: isEnglish
        ? "Some information is visible on screen but may be missed by AI"
        : "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
      currentState:
        stateParts.join(" ") ||
        (isEnglish
          ? "Body content or navigation links are added after the page opens."
          : "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다."),
      meaning: isEnglish
        ? "The page may look normal to users, but some AI search crawlers that do not fully process JavaScript can miss information and links added later."
        : "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.",
      change: isEnglish
        ? "You do not need to change every screen feature. Use SSR, SSG, or prerendering so the initial HTML also includes the service definition, target users, usage process, pricing and security information, FAQs, and important navigation links with the same meaning as the actual user screen."
        : "모든 화면 기능을 바꿀 필요는 없습니다. SSR, SSG 또는 사전 렌더링을 통해 AI가 처음 받는 HTML에도 서비스 정의, 대상 고객, 이용 절차, 요금·보안 정보, FAQ와 중요한 이동 링크가 실제 사용자 화면과 같은 의미로 포함되도록 수정합니다.",
      developerInstructions: [
        "이 항목은 8개의 독립 작업으로 나누기보다 SSR/SSG/사전 렌더링 도입 또는 랜딩 페이지 정적화를 중심 작업으로 묶어 처리해 주세요.",
        "초기 HTML에는 단순 글자 채우기가 아니라 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차를 자연스러운 본문 섹션으로 포함해 주세요.",
        "요금제 또는 무료·유료 이용 범위, 개인정보·입력자료 처리 방식, 운영 주체와 문의 경로를 초기 HTML에 1~2문장 이상 요약하고 관련 정책 페이지로 표준 a 링크를 제공해 주세요.",
        "실제 화면에 보이는 핵심 FAQ 3~4개를 만들고, 같은 질문·답변을 FAQPage JSON-LD로도 선언해 주세요.",
        "주요 내부 링크는 JavaScript 클릭 핸들러만 쓰지 말고 href가 있는 표준 a 링크로 초기 HTML에 제공해 주세요.",
        "초기 HTML 본문이 렌더링 DOM 본문의 75% 이상을 포함하도록 핵심 설명을 앞단에 제공해 주세요.",
        "초기 HTML 본문은 최소 200자 이상이어야 하며, 별도 답변 기반 규칙은 800자를 내부 참고 기준으로 사용합니다.",
        "주요 내부 링크는 렌더링 DOM 링크의 75% 이상을 포함하거나 차이가 2개 이하가 되도록 제공해 주세요.",
        "og:image, favicon, lang, hreflang 등 공유·언어 메타데이터가 실제 응답하고 현재 페이지 언어와 충돌하지 않는지도 함께 점검해 주세요.",
        "기존 디자인과 사용자 기능을 제거하거나 비활성화하지 마세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML 본문이 200자 이상이며 렌더링 DOM 본문의 75% 이상을 포함합니다.",
        "초기 HTML만 확인해도 서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약을 이해할 수 있습니다.",
        "중요한 내부 링크가 초기 HTML에 존재하고 렌더링 DOM과의 차이가 허용 범위입니다.",
        "실제 화면 FAQ와 FAQPage JSON-LD의 질문·답변이 일치합니다.",
        "기존 화면 디자인과 주요 사용자 기능은 브라우저 스모크 테스트 또는 수동 확인으로 검증합니다.",
        "배포 파이프라인 또는 수동 점검에 초기 HTML H1과 본문 200자 이상 확인 스모크 테스트를 추가합니다.",
        "재검사에서 초기 HTML 본문·링크 포함 비율이 기준을 충족합니다.",
        "수정 후 ChatGPT, Perplexity, Claude 등 실제 AI 도구에 사이트 설명 질문을 해 보고 서비스 설명이 왜곡되지 않는지 확인합니다.",
      ],
    });
  }

  const mismatchedFields: string[] = [];
  const renderedH1Duplicate = comparison.renderedH1.length > 1;

  if (
    normalizedComparisonText(comparison.initialTitle) !==
    normalizedComparisonText(comparison.renderedTitle)
  ) {
    mismatchedFields.push(isEnglish ? "page title" : "페이지 제목");
  }

  if (
    normalizedComparisonText(comparison.initialDescription) !==
    normalizedComparisonText(comparison.renderedDescription)
  ) {
    mismatchedFields.push(isEnglish ? "page description" : "페이지 설명");
  }

  if (
    normalizedComparisonList(comparison.initialH1) !==
    normalizedComparisonList(comparison.renderedH1)
  ) {
    mismatchedFields.push(isEnglish ? "primary heading (H1)" : "대표 제목(H1)");
  }

  if (
    normalizedComparisonList(comparison.initialJsonLdTypes) !==
    normalizedComparisonList(comparison.renderedJsonLdTypes)
  ) {
    mismatchedFields.push(
      isEnglish ? "structured data (JSON-LD)" : "구조화 정보(JSON-LD)",
    );
  }

  if (mismatchedFields.length > 0) {
    plans.push({
      code: "RENDERED-INCONSISTENT-INFORMATION",
      title: isEnglish
        ? "Initial information and rendered screen information differ"
        : "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다",
      currentState: `${mismatchedFields.join(
        ", ",
      )}${isEnglish ? " differ between the initial response and the fully rendered page." : " 항목이 페이지가 처음 전달될 때와 화면이 완성된 뒤 서로 다릅니다."}${
        renderedH1Duplicate
          ? isEnglish
            ? ` The rendered DOM has ${comparison.renderedH1.length} H1 elements (${comparison.renderedH1.join(
                " / ",
              )}), so the page should keep one primary H1.`
            : ` 렌더링 DOM에는 H1이 ${comparison.renderedH1.length}개(${comparison.renderedH1.join(
                " / ",
              )}) 있어 대표 H1 하나로 정리가 필요합니다.`
          : ""
      }`,
      meaning: isEnglish
        ? "Some AI search systems use the initially received information, while others may use the fully rendered screen. If these values differ, the same page can be understood differently, increasing the risk that AI explains the service name, features, pricing, or data handling incorrectly."
        : "AI 검색 시스템에 따라 처음 받은 정보를 사용하기도 하고 화면 완성 후의 정보를 사용하기도 합니다. 값이 다르면 같은 페이지를 서로 다르게 이해할 수 있으며, B2B 서비스에서는 AI가 서비스명·기능·요금·데이터 처리 방식을 잘못 설명할 위험이 커집니다.",
      change: isEnglish
        ? "Exact character-by-character equality is not required, but important facts and meanings such as page topic, service name, core features, pricing, data handling, and operator information should match before and after rendering."
        : "글자 하나까지 완전히 같을 필요는 없지만 페이지 주제, 서비스명, 핵심 기능, 가격·요금, 개인정보·자료 처리 방식, 운영 주체처럼 중요한 사실과 의미는 처음과 나중이 일치하도록 맞춥니다.",
      developerInstructions: [
        "초기 HTML과 렌더링 DOM의 title, meta description, H1, JSON-LD 값을 비교해 주세요.",
        "클라이언트 실행 후 올바른 초기 값을 오래되거나 다른 값으로 덮어쓰는 코드를 수정해 주세요.",
        "WebApplication, Organization, WebSite, FAQPage 등 JSON-LD의 이름·URL·설명·FAQ 답변이 실제 화면 정보와 일치하도록 유지해 주세요.",
        "중복되거나 충돌하는 메타데이터 선언은 하나의 정확한 값으로 정리해 주세요.",
        "렌더링 DOM에 H1이 2개 이상이면 페이지 대표 제목 하나만 H1으로 유지하고 나머지는 일반 텍스트나 H2로 변경해 주세요.",
        "요금, 보안, 개인정보, 지원 범위처럼 구매 검토에 영향을 주는 정보는 화면 본문·메타데이터·JSON-LD가 서로 다른 의미로 말하지 않게 점검해 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML과 화면 완성 후의 페이지 제목과 설명이 같은 주제와 의미를 전달합니다.",
        "대표 제목(H1)은 렌더링 DOM에 정확히 1개이며 초기 HTML과 같은 핵심 주제를 전달합니다.",
        "대표 제목과 구조화 정보의 핵심 사실이 실제 화면 내용과 일치합니다.",
        "FAQPage JSON-LD를 추가한 경우 실제 화면 FAQ와 질문·답변이 일치합니다.",
        "서로 충돌하거나 오래된 메타데이터가 남아 있지 않습니다.",
        "재검사에서 렌더링 전후 핵심정보 불일치가 사라집니다.",
      ],
    });
  }

  const missingInitial: string[] = [];

  if (!comparison.initialTitle) {
    missingInitial.push(isEnglish ? "page title" : "페이지 제목");
  }

  if (!comparison.initialDescription) {
    missingInitial.push(isEnglish ? "page description" : "페이지 설명");
  }

  if (comparison.metrics.h1Count.initial === 0) {
    missingInitial.push(isEnglish ? "primary heading (H1)" : "대표 제목(H1)");
  }

  if ((comparison.metrics.textLength.initial ?? 0) < 300) {
    missingInitial.push(isEnglish ? "core body content" : "핵심 본문");
  }

  if (missingInitial.length > 0) {
    plans.push({
      code: "INITIAL-HTML-MISSING-CORE",
      title: isEnglish
        ? "The initial HTML lacks core information"
        : "AI가 처음 받는 페이지에 핵심 정보가 부족합니다",
      currentState: isEnglish
        ? `${missingInitial.join(", ")} was not sufficiently confirmed in the initial HTML.`
        : `${missingInitial.join(
            ", ",
          )} 항목을 초기 HTML에서 충분히 확인하지 못했습니다.`,
      meaning: isEnglish
        ? "Users can understand the page by looking through the rendered screen, but some AI search crawlers judge the topic mainly from the title, description, and body text delivered in the initial response."
        : "사람은 화면을 둘러보며 내용을 이해할 수 있지만, 일부 AI 검색 봇은 처음 전달된 제목·설명·본문을 중심으로 사이트의 주제를 판단합니다.",
      change: isEnglish
        ? "Add core introduction and key information so the initial page response explains who the site is for, what it provides, how it is used, and where pricing, data handling, and FAQ information can be found."
        : "페이지를 처음 불러왔을 때도 사이트가 누구를 위한 곳이며 무엇을 제공하는지, 어떤 절차로 이용하는지, 요금·데이터 처리·FAQ는 어디서 확인할 수 있는지 알 수 있도록 핵심 소개와 주요 정보를 보완합니다.",
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

function publicRenderedPlanChange(
  code: string,
  fallback: string,
  locale: "ko" | "en" = "ko",
): string {
  const isEnglish = locale === "en";

  switch (code) {
    case "RENDERED-ADDED-CONTENT":
      return isEnglish
        ? "Reduce rendering dependency so the initial HTML includes enough core body text and important navigation paths."
        : "초기 HTML에 핵심 본문과 주요 이동 경로가 충분히 포함되도록 렌더링 의존도를 줄이는 개선이 필요합니다.";
    case "RENDERED-INCONSISTENT-INFORMATION":
      return isEnglish
        ? "Check consistency so the initial HTML and the JavaScript-rendered page communicate the same core title, description, and structured data."
        : "초기 HTML과 JavaScript 렌더링 후 화면의 핵심 제목·설명·구조화 정보가 같은 의미를 전달하도록 정합성 점검이 필요합니다.";
    case "INITIAL-HTML-MISSING-CORE":
      return isEnglish
        ? "Add core information so AI can understand the page topic and main service from the first response."
        : "AI가 첫 응답만 보더라도 페이지 주제와 주요 서비스를 이해할 수 있도록 핵심 정보 보강이 필요합니다.";
    default:
      return fallback;
  }
}

function comparisonMetricText(
  label: string,
  metric: {
    initial: number | null;
    rendered: number | null;
  },
  suffix: string,
): string {
  const isEnglish = suffix === "chars" || suffix === "items";
  const locale = isEnglish ? "en-US" : "ko-KR";

  const display = (value: number | null) =>
    value === null
      ? isEnglish
        ? "Not confirmed"
        : "미확인"
      : `${value.toLocaleString(locale)}${suffix}`;

  const delta =
    metric.initial === null || metric.rendered === null
      ? isEnglish
        ? "change unknown"
        : "변화 미확인"
      : `${isEnglish ? "change" : "변화"} ${
          metric.rendered - metric.initial > 0 ? "+" : ""
        }${(metric.rendered - metric.initial).toLocaleString(locale)}${suffix}`;

  return `${label}: ${display(metric.initial)} → ${display(
    metric.rendered,
  )} (${delta})`;
}

function scanResultReportTitle(result: PublicScanResult): string {
  const siteName = cleanText(result.site.name);
  const diagnosticNumber = result.scan.diagnosticNumber;

  return result.scan.locale === "en"
    ? `${siteName} Diagnostic ${diagnosticNumber} Report`
    : `${siteName} ${diagnosticNumber}차 사이트 진단 보고서`;
}

function writeCover(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const top = document.page.margins.top;

  document.roundedRect(x, top, width, 128, 12).fill(COLORS.primary);

  setText(document, 10, COLORS.white).text("SITE AI SCORE", x + 22, top + 18, {
    width: width - 44,
    characterSpacing: 1.2,
  });

  setText(document, 24, COLORS.white).text(
    scanResultReportTitle(result),
    x + 22,
    top + 43,
    {
      width: width - 44,
      lineGap: 3,
    },
  );

  setText(document, 8.6, "#DDE5FF").text(
    `${cleanText(result.scan.id)} / ${cleanText(result.scan.rulesVersion)}`,
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
    .roundedRect(x + cardWidth + gap, cardY, cardWidth, cardHeight, 10)
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
    result.scan.score === null ? "-" : String(Math.round(result.scan.score)),
    x + 14,
    cardY + 35,
    {
      width: cardWidth - 86,
      lineBreak: false,
    },
  );

  setText(document, 12, COLORS.primaryDark).text(
    cleanText(
      result.scan.grade ??
        (result.scan.locale === "en" ? "Not calculated" : "미계산"),
    ),
    x + cardWidth - 65,
    cardY + 47,
    {
      width: 50,
      align: "right",
      lineBreak: false,
    },
  );

  setText(document, 8.3, COLORS.primaryDark).text(
    result.scan.locale === "en" ? "Diagnostic coverage" : "진단 측정 범위",
    x + cardWidth + gap + 14,
    cardY + 14,
    {
      width: cardWidth - 28,
    },
  );

  const coverage = result.scoreSummary?.coverage;

  setText(document, 15, COLORS.primary).text(
    coverage === undefined
      ? result.scan.locale === "en"
        ? "No current rule score"
        : "현재 규칙 점수 없음"
      : result.scan.locale === "en"
        ? `Measured ${coverage}%`
        : `측정 ${coverage}%`,
    x + cardWidth + gap + 14,
    cardY + 42,
    {
      width: cardWidth - 28,
      lineGap: 3,
    },
  );

  document.y = cardY + cardHeight + 22;

  writeSectionTitle(
    document,
    result.scan.locale === "en" ? "Diagnostic basics" : "검사 기본정보",
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Site" : "사이트",
    result.site.name,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Registered URL" : "등록 URL",
    result.site.baseUrl,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Final URL" : "최종 URL",
    result.site.finalUrl ?? result.site.baseUrl,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Site type" : "사이트 유형",
    result.site.siteType ??
      (result.scan.locale === "en" ? "Not provided" : "미입력"),
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Region / language" : "지역·언어",
    `${result.site.region ?? result.site.country} / ${
      result.site.primaryLocale
    }`,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Diagnostic type" : "검사 유형",
    result.scan.type,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Status" : "검사 상태",
    result.scan.status,
  );
  writeLabelValue(
    document,
    result.scan.locale === "en" ? "Completed at (KST)" : "완료 시각(KST)",
    formatKST(result.scan.completedAt, result.scan.locale),
  );
  writeLabelValue(
    document,
    result.scan.locale === "en"
      ? "Report generated at (KST)"
      : "보고서 생성 시각(KST)",
    formatKST(new Date().toISOString(), result.scan.locale),
  );

  document.moveDown(0.5);
  setText(document, 7.9, COLORS.muted).text(
    result.scan.locale === "en"
      ? "The current QUICK score is calculated from the public URL HTTP response and initial HTML. JavaScript-rendered DOM comparison is used for rendering notes and improvement suggestions. Mobile/desktop comparison, industry benchmarks, and AI answer accuracy are added in the detailed diagnostic stage."
      : "현재 QUICK 점수는 기술 준비 50점과 AI 답변 준비 콘텐츠 50점을 합산해 계산합니다. 기술적으로 읽을 수 있는 사이트라도 요금, 환불, 고객지원, 차별점, 사례, 데이터 처리 같은 핵심 콘텐츠가 부족하면 실제 AI 답변·추천 가능성은 낮아질 수 있습니다.",
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
    result.scan.locale === "en" ? "Category scores" : "영역별 점수",
    result.scan.locale === "en"
      ? "Calculated from the current rule version across 7 categories and 100 total points."
      : "현재 규칙 버전의 기술 준비 50점과 AI 답변 준비 콘텐츠 50점, 총 100점 배점을 기준으로 계산했습니다.",
  );

  if (!result.scoreSummary) {
    writeTextBox(
      document,
      result.scan.locale === "en" ? "Score note" : "점수 안내",
      result.scan.locale === "en"
        ? "This result uses a different rule version, so category scores were not recalculated."
        : "이 결과는 현재 규칙 버전과 달라 영역별 점수를 다시 계산하지 않았습니다.",
    );
    return;
  }

  const x = document.page.margins.left;
  const width = contentWidth(document);

  for (const category of result.scoreSummary.categories) {
    ensureSpace(document, 58);
    const y = document.y;
    const percentage = Math.max(0, Math.min(100, category.percentage));

    setText(document, 9.2, COLORS.text).text(
      cleanText(translatePdfCategory(category.category, result.scan.locale)),
      x,
      y,
      {
        width: width - 105,
      },
    );

    setText(document, 9.2, COLORS.primaryDark).text(
      result.scan.locale === "en"
        ? `${category.score}/${category.maxScore} pts`
        : `${category.score}/${category.maxScore}점`,
      x + width - 100,
      y,
      {
        width: 100,
        align: "right",
      },
    );

    const barY = y + 25;
    document.roundedRect(x, barY, width, 10, 5).fill("#E2E8F0");

    if (percentage > 0) {
      document
        .roundedRect(x, barY, Math.max(4, (width * percentage) / 100), 10, 5)
        .fill(COLORS.primary);
    }

    setText(document, 7.4, COLORS.muted).text(`${percentage}%`, x, barY + 16, {
      width,
      align: "right",
    });

    document.y = barY + 34;
  }

  if (result.scoreSummary.cap !== null) {
    writeTextBox(
      document,
      result.scan.locale === "en" ? "Score cap applied" : "점수 상한 적용",
      result.scan.locale === "en"
        ? `A critical condition limited the final score to ${result.scoreSummary.cap} points or lower.`
        : `치명적 조건으로 최종 점수가 ${result.scoreSummary.cap}점 이하로 제한되었습니다.`,
      {
        background: COLORS.neutralSoft,
        border: COLORS.border,
        accent: COLORS.neutral,
      },
    );
  }

  writeTextBox(
    document,
    result.scan.locale === "en"
      ? "Improvement goals are provided in the work order"
      : "개선 목표는 수정 작업지시서에서 확인",
    result.scan.locale === "en"
      ? "This diagnostic report shows the current measured state of the public URL. Detailed improvement goals, execution items, and verification criteria are provided in the improvement work order."
      : "이 진단 보고서는 공개 URL의 현재 측정 상태를 보여줍니다. 구체적인 개선 목표, 실행 항목, 완료 기준은 수정 작업지시서에서 확인할 수 있습니다.",
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
    result.scan.locale === "en" ? "How AI reads the site" : "AI가 읽은 사이트",
    result.scan.locale === "en"
      ? scanResultRenderedDomComparison(result)
        ? "Stored initial HTML diagnostic evidence is summarized here. JavaScript rendering comparison is shown separately in the later technical note."
        : "This summarizes stored initial HTML diagnostic evidence, not LLM guesses."
      : scanResultRenderedDomComparison(result)
        ? "저장된 초기 HTML 검사 증거를 요약했습니다. JavaScript 렌더링 비교는 뒤쪽의 추가 기술 참고에 별도로 표시합니다."
        : "LLM의 추측이 아니라 저장된 초기 HTML 검사 증거를 요약했습니다.",
  );

  writeTextBox(
    document,
    result.scan.locale === "en"
      ? "Site understanding summary"
      : "사이트 이해 요약",
    translatePdfUnderstandingText(
      result.understandingSummary,
      result.scan.locale,
    ),
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );

  writeSectionTitle(
    document,
    result.scan.locale === "en" ? "Key information found" : "찾은 핵심정보",
  );

  if (result.foundInformation.length === 0) {
    setText(document, 9, COLORS.muted).text(
      result.scan.locale === "en"
        ? "No key information to display."
        : "표시할 핵심정보가 없습니다.",
    );
  } else {
    for (const item of result.foundInformation) {
      writeLabelValue(
        document,
        translatePdfFoundLabel(item.label, result.scan.locale),
        item.value,
      );
    }
  }

  document.moveDown(0.6);
  writeSectionTitle(
    document,
    result.scan.locale === "en"
      ? "Missing or unconfirmed information"
      : "찾지 못했거나 확인하지 못한 정보",
  );

  if (result.missingInformation.length === 0) {
    setText(document, 9, COLORS.pass).text(
      result.scan.locale === "en"
        ? "No missing items were found in the current weighted rules."
        : "현재 가중 규칙에서 누락된 항목이 없습니다.",
    );
  } else {
    for (const item of result.missingInformation) {
      ensureSpace(document, 25);
      setText(document, 8.8, COLORS.fail).text(
        `${cleanText(item.ruleCode)} / ${cleanText(
          translatePdfFindingTitle(item.title, result.scan.locale),
        )}`,
        {
          width: contentWidth(document),
          lineGap: 2,
        },
      );
      document.moveDown(0.35);
    }
  }
}

function writeContentReadiness(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const assessment = result.contentReadiness;

  if (!assessment) {
    return;
  }

  document.addPage();
  writeSectionTitle(
    document,
    result.scan.locale === "en"
      ? "Additional content suggestions for AI answers"
      : "AI 답변·추천 가능성을 낮추는 핵심 콘텐츠 부족 항목",
    result.scan.locale === "en"
      ? "Separate from the current QUICK score, this section suggests content that can help AI answer more specific questions. These suggestions are not score deductions or failure judgments."
      : "기술 점수가 높더라도 요금·환불·고객지원·차별점·사례·데이터 처리 같은 핵심 정보가 부족하면 AI가 실제 고객 질문에 답하거나 사이트를 추천할 가능성이 낮아질 수 있습니다.",
  );

  writeTextBox(
    document,
    result.scan.locale === "en"
      ? "Additional content note · score-independent"
      : `AI 답변 준비도 핵심 점검`,
    result.scan.locale === "en"
      ? "This score-independent guide suggests optional content that may help AI answer more specific questions about the site, such as target users, use cases, process, support scope, pricing, data handling, operator information, and FAQs."
      : "이 영역은 단순 선택 사항이 아니라 AI가 고객 질문에 답하고 추천 근거로 활용할 수 있는 핵심 콘텐츠를 점검합니다. 자동검사만으로 사실 여부를 확정하기 어려운 이용 대상, 활용 사례, 이용 절차, 지원 범위, 요금·환불·취소·자료 처리·운영 주체, 자주 묻는 질문 등을 보완해야 합니다. 이 정보가 부족하면 기술 점수가 높아도 AI 답변이 불완전해지고 추천 가능성이 낮아질 수 있습니다.",
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );

  writeTextBox(
    document,
    result.scan.locale === "en"
      ? "How to use these suggestions"
      : "이 제안의 활용 방법",
    [
      translatePdfContentReadinessText(
        assessment.benchmarkNote,
        result.scan.locale,
      ),
      translatePdfContentReadinessText(
        assessment.disclaimer,
        result.scan.locale,
      ),
    ].join("\n\n"),
    {
      background: "#FFFBEB",
      border: "#FDE68A",
      accent: COLORS.blocked,
    },
  );

  writeSectionTitle(
    document,
    result.scan.locale === "en"
      ? "Reference signals found by the automated check"
      : "자동검사에서 확인한 참고 단서",
  );
  setText(document, 8.8, COLORS.text).text(
    assessment.confirmedSignals
      .map(
        (signal) =>
          `- ${cleanText(
            translatePdfContentReadinessText(signal, result.scan.locale),
          )}`,
      )
      .join("\n"),
    {
      width: contentWidth(document),
      lineGap: 3,
    },
  );

  document.moveDown(0.8);
  writeSectionTitle(
    document,
    result.scan.locale === "en"
      ? "Optional content to add"
      : "AI 답변·추천 가능성을 높이기 위해 보완해야 할 콘텐츠",
  );

  assessment.topics.forEach((topic, index) => {
    const statusLabel =
      topic.status === "PARTIAL"
        ? result.scan.locale === "en"
          ? "Partial signal found"
          : "관련 단서 일부 확인"
        : result.scan.locale === "en"
          ? "Additional information suggested"
          : "추가 정보 제안";

    writeTextBox(
      document,
      `${index + 1}. ${translatePdfContentReadinessText(
        topic.title,
        result.scan.locale,
      )} · ${statusLabel}`,
      [
        result.scan.locale === "en"
          ? `Current signal: ${translatePdfContentReadinessText(
              topic.reason,
              result.scan.locale,
            )}`
          : `현재 확인 단서: ${topic.reason}`,
        result.scan.locale === "en"
          ? `Questions AI may struggle to answer: ${translatePdfContentReadinessList(
              topic.questions,
              result.scan.locale,
            ).join(" / ")}`
          : `AI가 답하기 어려울 수 있는 질문: ${topic.questions.join(" / ")}`,
        result.scan.locale === "en"
          ? `Suggested direction: ${translatePdfContentReadinessList(
              topic.suggestedSections,
              result.scan.locale,
            ).join(" · ")} content may need to be added.`
          : `개선 방향: ${topic.suggestedSections.join(" · ")} 같은 콘텐츠 보강이 필요합니다.`,
        "",
      ].join("\n\n"),
      {
        background: COLORS.white,
        border: COLORS.border,
        accent: topic.status === "PARTIAL" ? COLORS.primary : COLORS.blocked,
        fontSize: 8.4,
      },
    );
  });
}

function writeRenderedDomComparison(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const isEnglish = result.scan.locale === "en";
  const comparison = scanResultRenderedDomComparison(result);
  const improvementPlans = buildRenderedDomImprovementPlans(
    comparison,
    result.scan.locale,
  );

  if (!comparison) {
    return;
  }

  document.addPage();
  writeSectionTitle(
    document,
    result.scan.locale === "en"
      ? "Technical note: JavaScript rendering comparison"
      : "추가 기술 참고: JavaScript 렌더링 비교",
    result.scan.locale === "en"
      ? "Changes after JavaScript execution are provided as supporting reference, not as required scoring items. Use this for content improvement and technical review when needed."
      : "JavaScript 실행 후 화면 변화는 점수 산정 필수 항목이 아니라 보조 참고 자료로 제공합니다. 필요한 경우 추가 콘텐츠 보완과 기술 검토에 활용합니다.",
  );

  if (comparison.status !== "SUCCESS") {
    writeTextBox(
      document,
      result.scan.locale === "en"
        ? "Rendering comparison status"
        : "렌더링 비교 상태",
      [
        result.scan.locale === "en"
          ? `Status: ${comparison.status}`
          : `상태: ${comparison.status}`,
        result.scan.locale === "en"
          ? `Error code: ${comparison.errorCode ?? "Not recorded"}`
          : `오류 코드: ${comparison.errorCode ?? "미기록"}`,
        result.scan.locale === "en"
          ? `Note: ${comparison.message ?? "Changes after JavaScript execution were not compared in this simple diagnostic. This is supporting reference, not a required scoring item."}`
          : `안내: ${comparison.message ?? "JavaScript 실행 후 화면 변화는 이번 간편진단에서 비교하지 않았습니다. 이 항목은 점수 산정 필수 항목이 아니라 보조 참고 자료입니다."}`,
      ].join("\n"),
      {
        background: COLORS.neutralSoft,
        border: COLORS.border,
        accent: COLORS.neutral,
      },
    );
  } else {
    writeTextBox(
      document,
      result.scan.locale === "en" ? "Comparison summary" : "비교 요약",
      [
        comparisonMetricText(
          result.scan.locale === "en" ? "Body text length" : "본문 글자 수",
          comparison.metrics.textLength,
          result.scan.locale === "en" ? "chars" : "자",
        ),
        comparisonMetricText(
          result.scan.locale === "en" ? "Internal links" : "내부 링크",
          comparison.metrics.internalLinks,
          result.scan.locale === "en" ? "items" : "개",
        ),
        comparisonMetricText(
          "H1",
          comparison.metrics.h1Count,
          result.scan.locale === "en" ? "items" : "개",
        ),
        comparisonMetricText(
          "H2",
          comparison.metrics.h2Count,
          result.scan.locale === "en" ? "items" : "개",
        ),
        comparisonMetricText(
          result.scan.locale === "en" ? "Valid JSON-LD" : "유효 JSON-LD",
          comparison.metrics.jsonLdValidCount,
          result.scan.locale === "en" ? "items" : "개",
        ),
      ].join("\n"),
      {
        background: COLORS.primarySoft,
        border: "#C7D2FE",
        accent: COLORS.primary,
      },
    );

    writeSectionTitle(
      document,
      result.scan.locale === "en"
        ? "Rendering execution details"
        : "렌더링 실행 정보",
    );
    writeLabelValue(
      document,
      result.scan.locale === "en" ? "Browser" : "브라우저",
      comparison.browserVersion ??
        (result.scan.locale === "en" ? "Not confirmed" : "미확인"),
    );
    writeLabelValue(
      document,
      result.scan.locale === "en" ? "Rendering time" : "렌더링 시간",
      comparison.durationMs === null
        ? result.scan.locale === "en"
          ? "Not confirmed"
          : "미확인"
        : result.scan.locale === "en"
          ? `${(comparison.durationMs / 1_000).toFixed(1)} sec`
          : isEnglish
            ? `${(comparison.durationMs / 1_000).toFixed(1)} sec`
            : `${(comparison.durationMs / 1_000).toFixed(1)}초`,
    );
    writeLabelValue(
      document,
      result.scan.locale === "en"
        ? "Page JavaScript errors"
        : "페이지 JavaScript 오류",
      comparison.pageErrorCount === null
        ? result.scan.locale === "en"
          ? "Not confirmed"
          : "미확인"
        : result.scan.locale === "en"
          ? `${comparison.pageErrorCount.toLocaleString("en-US")} errors`
          : isEnglish
            ? `${comparison.pageErrorCount.toLocaleString("en-US")} errors`
            : `${comparison.pageErrorCount.toLocaleString("ko-KR")}건`,
    );

    writeSectionTitle(
      document,
      result.scan.locale === "en"
        ? "JavaScript rendering comparison notes"
        : "JavaScript 렌더링 비교 참고 의견",
      result.scan.locale === "en"
        ? "Explains what the comparison metrics mean and, when needed, suggests improvement directions."
        : "위 비교 수치가 뜻하는 바와 필요한 경우의 개선 방향을 함께 설명합니다.",
    );

    if (improvementPlans.length === 0) {
      writeTextBox(
        document,
        result.scan.locale === "en" ? "Current assessment" : "현재 판단",
        result.scan.locale === "en"
          ? "The initial HTML and the fully rendered page structure are relatively similar. No separate improvement plan was generated from this comparison."
          : "초기 HTML과 화면 완성 후의 핵심 구조가 비교적 비슷합니다. 현재 비교 결과에서 별도 개선안이 생성되지 않았습니다.",
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
          result.scan.locale === "en"
            ? `Improvement ${index + 1} · ${plan.title}`
            : `개선안 ${index + 1} · ${plan.title}`,
          [
            result.scan.locale === "en"
              ? `Current state\n${plan.currentState}`
              : `현재 어떤 상태인가요?\n${plan.currentState}`,
            result.scan.locale === "en"
              ? `What this means\n${plan.meaning}`
              : `무슨 뜻인가요?\n${plan.meaning}`,
            result.scan.locale === "en"
              ? `Improvement summary\n${publicRenderedPlanChange(
                  plan.code,
                  plan.change,
                  result.scan.locale,
                )}`
              : `개선 방향 요약\n${publicRenderedPlanChange(
                  plan.code,
                  plan.change,
                  result.scan.locale,
                )}`,
            result.scan.locale === "en"
              ? "Detailed developer instructions and completion criteria are provided in the separate work order."
              : "상세 개발자 작업 지시와 완료 확인 기준은 별도 수정 작업지시서에서 제공합니다.",
          ].join("\n\n"),
          {
            background: COLORS.primarySoft,
            border: "#C7D2FE",
            accent: COLORS.primary,
            fontSize: 8.5,
            maxCharacters: 2_400,
          },
        );
      }
    }
  }
}

function writeFindingDetail(
  document: PDFKit.PDFDocument,
  finding: PublicScanResultFinding,
  index: number,
  total: number,
  locale: "ko" | "en",
): void {
  document.addPage();
  const colors = statusColors(finding.status);
  const x = document.page.margins.left;
  const width = contentWidth(document);

  setText(document, 8.1, COLORS.primary).text(
    locale === "en"
      ? `Primary issue ${index + 1} / ${total}`
      : `주요 문제 ${index + 1} / ${total}`,
    {
      width,
      characterSpacing: 0.6,
    },
  );
  document.moveDown(0.4);

  setText(document, 18, COLORS.text).text(
    cleanText(translatePdfFindingTitle(finding.title, locale)),
    {
      width,
      lineGap: 3,
    },
  );
  document.moveDown(0.3);

  setText(document, 8.2, COLORS.muted).text(
    `${cleanText(finding.ruleCode)} / ${cleanText(
      translatePdfCategory(finding.category, locale),
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
    locale === "en"
      ? `Status · ${statusLabel(finding.status, locale)}`
      : `판정 · ${statusLabel(finding.status, locale)}`,
    x + 13,
    metaY,
    {
      width: width * 0.32,
    },
  );

  setText(document, 8.4, colors.text).text(
    locale === "en"
      ? `Severity · ${severityLabel(finding.severity, locale)}`
      : `중요도 · ${severityLabel(finding.severity, locale)}`,
    x + width * 0.34,
    metaY,
    {
      width: width * 0.3,
    },
  );

  setText(document, 8.4, colors.text).text(
    pointImpact(finding, locale),
    x + width * 0.66,
    metaY,
    {
      width: width * 0.31 - 13,
      align: "right",
    },
  );

  document.y = metaY + 58;

  writeTextBox(
    document,
    locale === "en" ? "Diagnostic details" : "진단 내용",
    translatePdfDiagnosticText(finding.description, locale),
    {
      background: COLORS.white,
      border: COLORS.border,
      accent: colors.text,
    },
  );

  if (finding.recommendation) {
    writeTextBox(
      document,
      locale === "en" ? "Recommended fix" : "수정 권장사항",
      translatePdfDiagnosticText(finding.recommendation, locale),
      {
        background: COLORS.primarySoft,
        border: "#C7D2FE",
        accent: COLORS.primary,
      },
    );
  }

  writeTextBox(
    document,
    locale === "en" ? "Evidence" : "검사 증거",
    evidenceText(finding.evidence, locale),
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
    return;
  }

  result.primaryIssues.forEach((finding, index) => {
    writeFindingDetail(
      document,
      finding,
      index,
      result.primaryIssues.length,
      result.scan.locale,
    );
  });
}

function writeCompactFinding(
  document: PDFKit.PDFDocument,
  finding: PublicScanResultFinding,
  locale: "ko" | "en",
): void {
  const colors = statusColors(finding.status);
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const padding = 12;
  const evidence = evidenceText(finding.evidence, locale).trim();
  const evidenceLabel =
    finding.status === "PASS"
      ? locale === "en"
        ? "Evidence"
        : "검사 근거"
      : locale === "en"
        ? "Evidence summary"
        : "증거 요약";
  const evidenceLimit = finding.status === "PASS" ? 260 : 600;
  const evidenceSummary =
    evidence.length > evidenceLimit
      ? `${evidence.slice(0, evidenceLimit)}…`
      : evidence;

  setText(document, 9);
  const title = `${cleanText(finding.ruleCode)} / ${cleanText(
    translatePdfFindingTitle(finding.title, locale),
  )}`;
  const titleHeight = document.heightOfString(title, {
    width: width - padding * 2,
    lineGap: 2,
  });
  const descriptionHeight = document.heightOfString(
    cleanText(translatePdfDiagnosticText(finding.description, locale)),
    {
      width: width - padding * 2,
      lineGap: 2,
    },
  );
  const recommendationHeight = finding.recommendation
    ? document.heightOfString(
        locale === "en"
          ? `Recommended: ${cleanText(
              translatePdfDiagnosticText(finding.recommendation, locale),
            )}`
          : `권장: ${cleanText(finding.recommendation)}`,
        {
          width: width - padding * 2,
          lineGap: 2,
        },
      )
    : 0;
  const evidenceHeight = evidenceSummary
    ? document.heightOfString(`${evidenceLabel}: ${evidenceSummary}`, {
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

  setText(document, 8.7, COLORS.text).text(title, x + padding, y + padding, {
    width: width - padding * 2,
    lineGap: 2,
  });

  let currentY = y + padding + titleHeight + 5;

  setText(document, 7.6, colors.text).text(
    `${statusLabel(finding.status, locale)} / ${severityLabel(
      finding.severity,
      locale,
    )} / ${pointImpact(finding, locale)}`,
    x + padding,
    currentY,
    {
      width: width - padding * 2,
    },
  );

  currentY += 18;

  setText(document, 8.3, COLORS.text).text(
    cleanText(translatePdfDiagnosticText(finding.description, locale)),
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
      locale === "en"
        ? `Recommended: ${cleanText(
            translatePdfDiagnosticText(finding.recommendation, locale),
          )}`
        : `권장: ${cleanText(finding.recommendation)}`,
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
      `${evidenceLabel}: ${evidenceSummary}`,
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
    result.scan.locale === "en" ? "All diagnostic checks" : "전체 진단 항목",
    result.scan.locale === "en"
      ? `Includes ${result.findings.length} checks, including pass, fail, blocked, and not-applicable items. Evidence is shown with each item.`
      : `통과·실패·확인 불가·감점 제외를 포함한 ${result.findings.length}개 항목이며, 각 항목에 검사 근거를 함께 표시합니다.`,
  );

  const groups = new Map<string, PublicScanResultFinding[]>();

  for (const finding of result.findings) {
    const category = translatePdfCategory(finding.category, result.scan.locale);
    const values = groups.get(category) ?? [];
    values.push(finding);
    groups.set(category, values);
  }

  for (const [category, findings] of groups) {
    ensureSpace(document, 42);
    setText(document, 11.5, COLORS.primaryDark).text(cleanText(category), {
      width: contentWidth(document),
    });
    document.moveDown(0.5);

    for (const finding of findings) {
      writeCompactFinding(document, finding, result.scan.locale);
    }

    document.moveDown(0.5);
  }
}

function writeCollectedPages(
  document: PDFKit.PDFDocument,
  result: PublicScanResult,
): void {
  const isEnglish = result.scan.locale === "en";
  const notConfirmed = isEnglish ? "Not confirmed" : "미확인";

  document.addPage();
  writeSectionTitle(
    document,
    isEnglish ? "Collected pages" : "수집 페이지",
    isEnglish
      ? "Raw HTML is not stored. Only hashes and measured values are retained."
      : "원본 HTML은 저장하지 않고 해시와 측정값만 보관합니다.",
  );

  if (result.pages.length === 0) {
    setText(document, 9, COLORS.muted).text(
      isEnglish
        ? "No collected pages are stored."
        : "저장된 수집 페이지가 없습니다.",
    );
    return;
  }

  for (const [index, page] of result.pages.entries()) {
    ensureSpace(document, 190);
    writeTextBox(
      document,
      isEnglish ? `Collected page ${index + 1}` : `수집 페이지 ${index + 1}`,
      [
        isEnglish ? `Scan URL: ${page.url}` : `검사 URL: ${page.url}`,
        isEnglish
          ? `Final URL: ${page.finalUrl ?? notConfirmed}`
          : `최종 URL: ${page.finalUrl ?? notConfirmed}`,
        isEnglish
          ? `HTTP status: ${page.statusCode ?? notConfirmed}`
          : `HTTP 상태: ${page.statusCode ?? notConfirmed}`,
        `Content-Type: ${page.contentType ?? notConfirmed}`,
        isEnglish
          ? `Initial text: ${page.initialTextLength?.toLocaleString("en-US") ?? notConfirmed} chars`
          : `초기 텍스트: ${page.initialTextLength?.toLocaleString("ko-KR") ?? notConfirmed}자`,
        isEnglish
          ? `iframe: ${page.iframeCount ?? notConfirmed} items`
          : `iframe: ${page.iframeCount ?? notConfirmed}개`,
        isEnglish
          ? `HTML SHA-256: ${page.rawHtmlHash ?? "Not stored"}`
          : `HTML SHA-256: ${page.rawHtmlHash ?? (isEnglish ? "Not stored" : "미저장")}`,
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
  const isEnglish = result.scan.locale === "en";

  document.addPage();
  writeSectionTitle(
    document,
    isEnglish
      ? "Scope, usage notes, and disclaimer"
      : "검사 범위·이용 안내·면책",
  );

  const notes = isEnglish
    ? [
        "1. This report is based on the specified public URL and the actual HTTP response and initial HTML evidence observed at scan time. JavaScript-rendered DOM comparison evidence is included when available.",
        "2. The total score and judgment are calculated from the scoring rules and completion criteria defined in the rule version. They are not arbitrarily decided by an LLM.",
        "3. OAI-SearchBot is marked as search access, ChatGPT-User as user-requested access, and GPTBot as training-related access.",
        "4. Raw HTML is not stored. SHA-256 hashes and structured diagnostic evidence are retained.",
        "5. The current QUICK score is calculated from 25 rules based on initial HTML. JavaScript-rendered DOM comparison is not directly reflected in the score; it is used for rendering notes and improvement suggestions. Mobile/desktop comparison, industry benchmarks, and AI answer accuracy are not included.",
        "6. Values such as 800 characters and 75% coverage are Site AI Score internal reference criteria. They are not official standards of every search engine or AI service. Accuracy of service definition, target users, process, pricing, data handling, and FAQs matters more than character count alone.",
        "7. This report does not guarantee AI search exposure, recommendation results, overall site security, or the integrity of every site function.",
        "8. Before-and-after comparison should be performed under the same rule version and scan conditions. When possible, manual AI question-and-answer checks should also be performed.",
      ]
    : [
        "1. 이 보고서는 명시된 공개 URL과 검사 시점에 관찰된 실제 HTTP 응답·초기 HTML 증거를 기준으로 작성되며, 사용 가능한 경우 JavaScript 실행 후 DOM 비교 증거를 함께 제공합니다.",
        "2. 종합점수와 판정은 규칙 버전에 정의된 배점과 완료 조건으로 계산하며 LLM이 임의로 결정하지 않습니다.",
        "3. OAI-SearchBot은 검색용, ChatGPT-User는 사용자 요청용, GPTBot은 학습용 접근으로 구분하여 표시합니다.",
        "4. 원본 HTML은 저장하지 않고 SHA-256 해시와 구조화된 검사 증거를 보관합니다.",
        "5. 현재 QUICK 점수는 기술 준비 50점과 AI 답변 준비 콘텐츠 50점을 합산해 계산합니다. 실제 AI 답변·추천 가능성은 요금, 환불, 고객지원, 차별점, 사례, 데이터 처리 같은 핵심 콘텐츠의 충분성에도 영향을 받으므로 콘텐츠 부족 항목을 함께 확인해야 합니다.",
        "6. 800자, 75% 포함 비율 등은 Site AI Score 내부 참고 기준입니다. 모든 검색엔진이나 AI 서비스의 공식 기준이 아니며, 글자 수보다 서비스 정의·대상·절차·요금·환불·고객지원·데이터 처리·FAQ의 정확성과 충분성이 중요합니다.",
        "7. 이 보고서는 AI 검색 노출, 추천 결과, 사이트 전체 보안성, 모든 기능의 무결성을 보증하지 않습니다.",
        "8. 수정 전후 비교는 동일 규칙 버전과 같은 조건으로 재검사해야 하며, 가능하면 실제 AI 질의응답 수동 확인도 함께 진행해야 합니다.",
      ];

  setText(document, 9.1, COLORS.text).text(notes.join("\n\n"), {
    width: contentWidth(document),
    lineGap: 4,
  });

  document.moveDown(1.2);
  writeLabelValue(
    document,
    isEnglish ? "Rule version" : "규칙 버전",
    result.scan.rulesVersion,
  );
  writeLabelValue(document, isEnglish ? "Scan ID" : "검사 ID", result.scan.id);
  writeLabelValue(
    document,
    isEnglish ? "Completed at (KST)" : "검사 완료(KST)",
    formatKST(result.scan.completedAt, result.scan.locale),
  );

  document.moveDown(1.1);
  setText(document, 9, COLORS.primaryDark).text(
    isEnglish
      ? "Site AI Score - Public URL diagnostics, work orders, and independent automated verification"
      : "Site AI Score - 공개 URL 진단, 수정 작업지시서, 독립 자동검수",
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
    const y = document.page.height - document.page.margins.bottom - 12;

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
    .update(readFileSync(requireFontPath("Pretendard-Regular.ttf")))
    .update(readFileSync(requireFontPath("Pretendard-SemiBold.ttf")))
    .digest("hex");
  return cachedFontHash;
}

export function scanResultPdfFilename(
  result: Pick<PublicScanResult, "scan">,
): string {
  return `site-ai-score-diagnostic-${result.scan.diagnosticNumber}-${result.scan.id}.pdf`.replace(
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
      Title: scanResultReportTitle(safeResult),
      Author: "Site AI Score",
      Subject: `${cleanText(safeResult.scan.id)} / ${cleanText(
        safeResult.scan.rulesVersion,
      )}`,
      Keywords:
        safeResult.scan.locale === "en"
          ? "Site AI Score, AEO, Diagnostic Report"
          : "Site AI Score, AEO, 진단 보고서",
      CreationDate: creationDate,
    },
  });

  document.registerFont(
    FONT_REGULAR_NAME,
    requireFontPath("Pretendard-Regular.ttf"),
  );
  document.registerFont(
    FONT_BOLD_NAME,
    requireFontPath("Pretendard-SemiBold.ttf"),
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

  writeCover(document, safeResult);
  writeCategoryScores(document, safeResult);
  writeUnderstanding(document, safeResult);
  writeRenderedDomComparison(document, safeResult);
  writePrimaryIssues(document, safeResult);
  writeAllFindings(document, safeResult);
  writeCollectedPages(document, safeResult);
  writeContentReadiness(document, safeResult);
  writeMethodology(document, safeResult);
  addFooters(document, safeResult);

  document.end();
  return completed;
}
