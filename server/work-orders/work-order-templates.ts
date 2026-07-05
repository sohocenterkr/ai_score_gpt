import type { FindingSeverity } from "@prisma/client";

export interface AcceptanceCriterion {
  code: string;
  label: string;
  required: boolean;
}

export interface WorkOrderTemplate {
  requirement: string;
  developerMessage: string;
  acceptanceCriteria: AcceptanceCriterion[];
  isRequired: boolean;
}

interface FindingTemplateInput {
  ruleCode: string;
  title: string;
  description: string;
  recommendation: string | null;
  severity: FindingSeverity;
}

type WorkOrderTemplateLocale = "ko" | "en";

interface RenderedImprovementTemplateInput {
  code: string;
  currentState: string;
  meaning: string;
  change: string;
  developerInstructions: string[];
  acceptanceCriteria: string[];
}

const templates: Record<string, WorkOrderTemplate> = {
  "STRUCT-H1-001": {
    requirement:
      "P0 초기 HTML SSR/SSG 작업 안에서 페이지 대표 H1을 정확히 1개 추가합니다.",
    developerMessage:
      "이 항목만 따로 고치지 말고 초기 HTML SSR/SSG·본문·링크 보강 작업과 같은 커밋에서 처리해 주세요. 서버가 처음 반환하는 HTML에 페이지 핵심 주제를 설명하는 H1을 정확히 1개 출력하고, JavaScript 렌더링 후에도 같은 핵심 주제가 유지되도록 확인해 주세요.",
    acceptanceCriteria: [
      {
        code: "H1-01",
        label: "초기 HTML에 H1이 정확히 1개 존재한다.",
        required: true,
      },
      {
        code: "H1-02",
        label: "H1이 페이지의 실제 서비스 주제와 일치한다.",
        required: true,
      },
      {
        code: "H1-03",
        label: "렌더링 후 DOM에서도 대표 H1이 중복되지 않는다.",
        required: true,
      },
      {
        code: "H1-04",
        label: "검사 대상 운영 URL에서 자동검수 가능하며 기존 정상 항목을 깨뜨리지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-HEADINGS-001": {
    requirement:
      "P0 초기 HTML SSR/SSG 작업 안에서 H1·H2 제목 계층을 함께 구성합니다.",
    developerMessage:
      "H1만 따로 추가하지 말고, 서비스 소개·이용 대상·이용 절차·요금/보안·FAQ 같은 주요 섹션을 H2로 나누어 초기 HTML에서 제목 계층이 드러나게 해 주세요. 제목 구조는 사용자 화면의 실제 섹션 구조와 일치해야 합니다.",
    acceptanceCriteria: [
      {
        code: "HEADINGS-01",
        label: "초기 HTML에서 H1과 H2 제목 계층을 확인할 수 있다.",
        required: true,
      },
      {
        code: "HEADINGS-02",
        label: "H2 섹션이 실제 사용자 화면의 주요 콘텐츠 섹션과 일치한다.",
        required: true,
      },
      {
        code: "HEADINGS-03",
        label: "제목 계층을 추가하면서 기존 디자인과 주요 기능이 깨지지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-INITIAL-001": {
    requirement:
      "랜딩 페이지를 SSR, SSG 또는 사전 렌더링 방식으로 보강하여 초기 HTML 본문을 제공합니다.",
    developerMessage:
      "현재 문제의 핵심은 CSR로 인해 초기 HTML 본문이 비어 있는 것입니다. React 기반이면 Next.js SSR/SSG, react-snap류 사전 렌더링, Prerender.io 또는 자체 사전 렌더링 미들웨어 등 현재 구조에 맞는 방식을 검토해 랜딩 페이지의 최초 HTML에 실제 본문을 포함해 주세요. 단순 글자 수 채우기가 아니라 서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약을 실제 화면 콘텐츠로 제공해야 합니다.",
    acceptanceCriteria: [
      {
        code: "INITIAL-TEXT-01",
        label: "초기 HTML 본문이 최소 200자 이상이다.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-02",
        label: "초기 HTML 본문이 렌더링 DOM 본문의 75% 이상을 포함하거나 핵심 정보 격차가 허용 범위다.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-03",
        label: "서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약이 초기 HTML에서 확인된다.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-04",
        label: "검색 노출용 숨김 텍스트가 아니라 실제 사용자 화면과 같은 의미의 콘텐츠다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-ANSWERABILITY-001": {
    requirement:
      "AI가 Form Assign의 목적·대상·이용 절차·요금·데이터 처리 질문에 답할 수 있도록 초기 HTML 콘텐츠를 보강합니다.",
    developerMessage:
      "이 항목은 CONTENT-INITIAL-001과 같은 P0 작업 묶음에서 처리해 주세요. 초기 HTML에 최소 800자 수준을 내부 목표로 삼되, 글자 수 자체보다 AI가 '무엇을 제공하나', '누가 쓰나', '어떻게 시작하나', '무료/유료 범위는 무엇인가', '입력 자료는 어떻게 처리하나'에 답할 수 있는 실제 정보를 넣는 것이 중요합니다.",
    acceptanceCriteria: [
      {
        code: "CONTENT-ANSWERABILITY-001-01",
        label: "초기 HTML만으로 서비스 정의와 핵심 가치를 설명할 수 있다.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-02",
        label: "이용 대상과 최소 2개의 대표 활용 사례가 확인된다.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-03",
        label: "가입부터 생성, 배포, 제출 확인, 내보내기 등 3~5단계 이용 절차를 확인할 수 있다.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-04",
        label: "요금·데이터 처리·운영 주체 또는 문의 경로가 확인된다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "STRUCT-LINKS-001": {
    requirement:
      "주요 내부 페이지를 JavaScript 클릭이 아닌 표준 a 링크로 초기 HTML에 제공합니다.",
    developerMessage:
      "P0 초기 HTML 보강 작업과 함께 요금제, 기능 소개, 이용약관, 개인정보처리방침, 도움말/문의 등 주요 페이지 링크를 href 속성이 있는 표준 a 태그로 초기 HTML에 출력해 주세요. 링크 텍스트는 '자세히 보기'보다 목적지를 설명하는 문구를 사용해 AI와 크롤러가 이동 경로를 이해할 수 있게 해 주세요.",
    acceptanceCriteria: [
      {
        code: "LINKS-01",
        label: "초기 HTML에서 주요 내부 링크를 확인할 수 있다.",
        required: true,
      },
      {
        code: "LINKS-02",
        label: "주요 내부 링크가 href 속성이 있는 표준 a 태그다.",
        required: true,
      },
      {
        code: "LINKS-03",
        label: "초기 HTML 내부 링크 수가 렌더링 DOM 대비 75% 이상이거나 차이가 2개 이하이다.",
        required: true,
      },
      {
        code: "LINKS-04",
        label: "링크 텍스트가 목적지 내용을 설명한다.",
        required: false,
      },
    ],
    isRequired: true,
  },
  "ACCESS-SITEMAP-001": {
    requirement:
      "robots.txt에 실제 sitemap URL을 선언하고, 해당 주소가 인증 없이 2xx XML 응답을 반환하도록 수정합니다.",
    developerMessage:
      "robots.txt의 Sitemap 지시문과 실제 sitemap 응답을 일치시키고, 리디렉션 이후에도 공개적으로 접근 가능한 XML 문서가 반환되도록 구현해 주세요.",
    acceptanceCriteria: [
      {
        code: "SITEMAP-01",
        label: "robots.txt에서 sitemap URL을 발견할 수 있다.",
        required: true,
      },
      {
        code: "SITEMAP-02",
        label: "선언된 sitemap URL이 2xx 응답을 반환한다.",
        required: true,
      },
      {
        code: "SITEMAP-03",
        label: "응답이 XML sitemap 또는 sitemap index 형식이다.",
        required: true,
      },
      {
        code: "SITEMAP-04",
        label: "sitemap의 URL이 등록 사이트 도메인 범위와 일치한다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "META-CANONICAL-001": {
    requirement:
      "대표 페이지의 초기 HTML head에 최종 대표 URL을 가리키는 canonical 링크를 추가합니다.",
    developerMessage:
      '초기 HTML의 <head>에 <link rel="canonical" href="...">를 출력하고, href가 실제 최종 공개 URL과 일치하도록 구현해 주세요.',
    acceptanceCriteria: [
      {
        code: "CANONICAL-01",
        label: "초기 HTML head에서 canonical 링크를 발견할 수 있다.",
        required: true,
      },
      {
        code: "CANONICAL-02",
        label: "canonical href가 절대 HTTPS URL이다.",
        required: true,
      },
      {
        code: "CANONICAL-03",
        label: "canonical URL이 정상적인 2xx 대표 페이지를 가리킨다.",
        required: true,
      },
      {
        code: "CANONICAL-04",
        label: "중복된 canonical 선언이 없다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "META-OG-001": {
    requirement:
      "대표 페이지의 초기 HTML에 og:title과 og:description을 추가하고 화면의 제목·설명과 의미가 일치하도록 합니다.",
    developerMessage:
      "서버가 반환하는 초기 HTML head에 og:title과 og:description을 출력하고, 일반 title 및 meta description과 상충하지 않도록 구현해 주세요.",
    acceptanceCriteria: [
      {
        code: "OG-01",
        label: "초기 HTML에서 og:title을 발견할 수 있다.",
        required: true,
      },
      {
        code: "OG-02",
        label: "초기 HTML에서 og:description을 발견할 수 있다.",
        required: true,
      },
      {
        code: "OG-03",
        label: "Open Graph 제목과 설명이 비어 있지 않다.",
        required: true,
      },
      {
        code: "OG-04",
        label: "화면의 대표 제목·설명과 Open Graph 값이 의미상 일치한다.",
        required: false,
      },
    ],
    isRequired: true,
  },
  "STRUCT-JSONLD-001": {
    requirement:
      "사이트의 성격과 핵심정보를 설명하는 유효한 Schema.org JSON-LD를 초기 HTML에 추가하고, 실제 화면 정보와 일치하도록 유지합니다.",
    developerMessage:
      '초기 HTML에 <script type="application/ld+json">을 출력하고 JSON 문법, 필수 속성, 화면 정보와의 일치를 확인해 주세요. SaaS·웹서비스는 WebApplication 또는 WebSite/Organization 조합을 우선 검토하고, 실제 화면에 FAQ가 있다면 FAQPage JSON-LD도 함께 선언해 주세요.',
    acceptanceCriteria: [
      {
        code: "JSONLD-01",
        label: "초기 HTML에서 JSON-LD script를 발견할 수 있다.",
        required: true,
      },
      {
        code: "JSONLD-02",
        label: "JSON-LD가 오류 없이 파싱되는 유효한 JSON이다.",
        required: true,
      },
      {
        code: "JSONLD-03",
        label: "Schema.org context와 사이트에 맞는 type이 존재한다.",
        required: true,
      },
      {
        code: "JSONLD-04",
        label: "이름·URL·설명 등 구조화 데이터가 실제 화면 정보와 일치한다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "STRUCT-JSONLD-TYPES-001": {
    requirement:
      "JSON-LD에 WebSite, Organization, LocalBusiness 등 사이트에 적합한 @type을 명시합니다.",
    developerMessage:
      "사이트의 실제 운영 주체와 서비스 성격에 맞는 Schema.org @type을 선택하고, 임의로 과장된 유형을 사용하지 마세요.",
    acceptanceCriteria: [
      {
        code: "JSONLD-TYPE-01",
        label: "JSON-LD에서 식별 가능한 @type이 존재한다.",
        required: true,
      },
      {
        code: "JSONLD-TYPE-02",
        label: "@type이 사이트의 실제 성격과 일치한다.",
        required: true,
      },
      {
        code: "JSONLD-TYPE-03",
        label: "선택한 유형의 핵심 속성이 비어 있지 않다.",
        required: true,
      },
    ],
    isRequired: true,
  },
};

const templatesEn: Partial<Record<string, WorkOrderTemplate>> = {
  "STRUCT-H1-001": {
    requirement:
      "Add exactly one representative H1 to the initial HTML as part of the P0 SSR/SSG work.",
    developerMessage:
      "Do not fix this item in isolation. Handle it together with the initial HTML SSR/SSG, body content, and internal link improvements. The server-rendered initial HTML should include exactly one H1 that describes the core topic of the page, and the same core topic should remain after JavaScript rendering.",
    acceptanceCriteria: [
      {
        code: "H1-01",
        label: "The initial HTML contains exactly one H1.",
        required: true,
      },
      {
        code: "H1-02",
        label: "The H1 matches the actual service topic of the page.",
        required: true,
      },
      {
        code: "H1-03",
        label: "The representative H1 is not duplicated after rendering.",
        required: true,
      },
      {
        code: "H1-04",
        label: "The change is verifiable on the production URL and does not break existing passing items.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-HEADINGS-001": {
    requirement:
      "Build the H1/H2 heading hierarchy together with the P0 initial HTML SSR/SSG work.",
    developerMessage:
      "Do not only add an H1. Divide the main sections, such as service overview, target users, usage flow, pricing/security, and FAQ, into H2 sections so the heading hierarchy is visible in the initial HTML. The heading structure should match the actual user-facing page sections.",
    acceptanceCriteria: [
      {
        code: "HEADINGS-01",
        label: "The initial HTML exposes a clear H1 and H2 heading hierarchy.",
        required: true,
      },
      {
        code: "HEADINGS-02",
        label: "The H2 sections match the main content sections shown to users.",
        required: true,
      },
      {
        code: "HEADINGS-03",
        label: "Adding the heading hierarchy does not break the existing design or key features.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-INITIAL-001": {
    requirement:
      "Provide meaningful body content in the initial HTML by using SSR, SSG, or prerendering for the landing page.",
    developerMessage:
      "The core issue is that the initial HTML body is empty because of CSR. For React-based sites, review Next.js SSR/SSG, react-snap-style prerendering, Prerender.io, or a custom prerendering middleware that fits the current architecture. Do not merely add filler text; provide real user-facing content such as the service definition, target customers, representative use cases, usage flow, and pricing/data handling summary.",
    acceptanceCriteria: [
      {
        code: "INITIAL-TEXT-01",
        label: "The initial HTML body contains at least 200 characters.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-02",
        label: "The initial HTML body includes at least 75% of the rendered DOM body or the key-information gap is within the allowed range.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-03",
        label: "The service definition, target customers, representative use cases, usage flow, and pricing/data handling summary are visible in the initial HTML.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-04",
        label: "The content has the same meaning as the real user-facing page and is not hidden text for search exposure.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-ANSWERABILITY-001": {
    requirement:
      "Add initial HTML content that lets AI answer questions about the service purpose, target users, usage flow, pricing, and data handling.",
    developerMessage:
      "Handle this item together with the CONTENT-INITIAL-001 P0 work bundle. Use 800 characters as an internal target for the initial HTML, but prioritize real information over character count. AI should be able to answer what the service provides, who uses it, how to start, what the free/paid scope is, and how submitted data is handled.",
    acceptanceCriteria: [
      {
        code: "CONTENT-ANSWERABILITY-001-01",
        label: "The service definition and core value can be explained from the initial HTML alone.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-02",
        label: "Target users and at least two representative use cases are visible.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-03",
        label: "A 3–5 step usage flow, such as sign-up, creation, deployment, submission check, and export, is visible.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-04",
        label: "Pricing, data handling, operator information, or a contact path is visible.",
        required: true,
      },
    ],
    isRequired: true,
  },
};

function genericCriteria(
  ruleCode: string,
  locale: WorkOrderTemplateLocale = "ko",
): AcceptanceCriterion[] {
  const prefix = ruleCode.replace(/[^A-Z0-9]+/g, "-");

  return [
    {
      code: `${prefix}-01`,
      label:
        locale === "en"
          ? "The change can be verified in the initial HTML or public response."
          : "초기 HTML 또는 공개 응답에서 수정 결과를 확인할 수 있다.",
      required: true,
    },
    {
      code: `${prefix}-02`,
      label:
        locale === "en"
          ? "The change is deployed to the same production URL used in the diagnostic."
          : "검사에서 사용한 대상 URL과 동일한 운영 URL에 반영되어 있다.",
      required: true,
    },
    {
      code: `${prefix}-03`,
      label:
        locale === "en"
          ? "There is no regression that removes or blocks previously passing items."
          : "기존 정상 항목을 제거하거나 차단하는 회귀가 없다.",
      required: true,
    },
  ];
}

export function buildRenderedImprovementWorkOrderTemplate(
  plan: RenderedImprovementTemplateInput,
  locale: WorkOrderTemplateLocale = "ko",
): WorkOrderTemplate {
  const prefixByCode: Record<string, string> = {
    "RENDERED-ADDED-CONTENT": "JS-CONTENT",
    "RENDERED-INCONSISTENT-INFORMATION": "JS-CONSISTENCY",
    "INITIAL-HTML-MISSING-CORE": "INITIAL-HTML",
  };
  const prefix =
    prefixByCode[plan.code] ??
    plan.code.replace(/[^A-Z0-9]+/g, "-").slice(0, 16);

  return {
    requirement: [
      locale === "en"
        ? `Current state: ${plan.currentState}`
        : `현재 상태: ${plan.currentState}`,
      locale === "en"
        ? `What it means: ${plan.meaning}`
        : `무슨 뜻인가요: ${plan.meaning}`,
      locale === "en"
        ? `What to change: ${plan.change}`
        : `무엇을 바꾸나요: ${plan.change}`,
    ].join("\n\n"),
    developerMessage: [
      locale === "en"
        ? "- Do not add hidden text just to raise the score. Reflect content with the same meaning as the real user-facing page in the initial HTML and structured data."
        : "- 점수만 올리기 위한 숨김 텍스트가 아니라, 실제 사용자 화면과 같은 의미의 콘텐츠를 초기 HTML과 구조화 데이터에 반영해 주세요.",
      locale === "en"
        ? "- Treat this as work that helps AI systems understand and cite the service more accurately, not as a guarantee of AI search visibility."
        : "- AI 검색 노출 보장이 아니라 AI가 서비스를 정확히 인식·인용할 가능성을 높이는 작업으로 이해해 주세요.",
      ...plan.developerInstructions.map((instruction) => `- ${instruction}`),
    ].join("\n"),
    acceptanceCriteria: plan.acceptanceCriteria.map(
      (label, index) => ({
        code: `${prefix}-${String(index + 1).padStart(2, "0")}`,
        label,
        required: true,
      }),
    ),
    isRequired: false,
  };
}

export function buildWorkOrderTemplate(
  finding: FindingTemplateInput,
  locale: WorkOrderTemplateLocale = "ko",
): WorkOrderTemplate {
  const defined =
    locale === "en"
      ? templatesEn[finding.ruleCode]
      : templates[finding.ruleCode];

  if (defined) {
    return defined;
  }

  const requirement =
    locale === "en"
      ? `Fix the ${finding.ruleCode} issue so that the same rule can pass when the production URL is rechecked.`
      : finding.recommendation?.trim() ||
        `${finding.title} 문제를 해결하여 같은 규칙으로 재검사했을 때 통과할 수 있도록 수정합니다.`;

  return {
    requirement,
    developerMessage:
      `${finding.ruleCode} 진단의 현재 증거와 설명을 확인한 뒤 운영 URL에 수정사항을 반영해 주세요. ` +
      "소스코드 제출은 필요하지 않으며 배포된 공개 URL에서 자동검수할 수 있어야 합니다.",
    acceptanceCriteria: genericCriteria(finding.ruleCode),
    isRequired:
      finding.severity === "CRITICAL" ||
      finding.severity === "HIGH" ||
      finding.severity === "MEDIUM",
  };
}
