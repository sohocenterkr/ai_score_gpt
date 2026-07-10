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
        label:
          "검사 대상 운영 URL에서 자동검수 가능하며 기존 정상 항목을 깨뜨리지 않는다.",
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
        label:
          "제목 계층을 추가하면서 기존 디자인과 주요 기능이 깨지지 않는다.",
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
        label:
          "초기 HTML 본문이 렌더링 DOM 본문의 75% 이상을 포함하거나 핵심 정보 격차가 허용 범위다.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-03",
        label:
          "서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약이 초기 HTML에서 확인된다.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-04",
        label:
          "검색 노출용 숨김 텍스트가 아니라 실제 사용자 화면과 같은 의미의 콘텐츠다.",
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
        label:
          "가입부터 생성, 배포, 제출 확인, 내보내기 등 3~5단계 이용 절차를 확인할 수 있다.",
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
        label:
          "초기 HTML 내부 링크 수가 렌더링 DOM 대비 75% 이상이거나 차이가 2개 이하이다.",
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

  "ACCESS-LLMS-TXT-001": {
    requirement:
      "사이트 루트에 /llms.txt 파일을 추가하여 AI가 핵심 페이지와 이용 범위를 빠르게 파악할 수 있게 합니다.",
    developerMessage:
      "/llms.txt가 인증 없이 2xx 응답으로 열리도록 배포하고, 사이트명·서비스 요약·핵심 페이지 링크·요금/정책/문의/도움말 경로를 간결한 Markdown 텍스트로 제공해 주세요. 점수만 올리기 위한 키워드 나열이 아니라 실제 사용자에게 공개해도 되는 최신 정보만 포함해야 합니다.",
    acceptanceCriteria: [
      {
        code: "LLMS-01",
        label: "사이트 루트 /llms.txt가 인증 없이 2xx 응답을 반환한다.",
        required: true,
      },
      {
        code: "LLMS-02",
        label:
          "파일 내용에 사이트명, 서비스 요약, 핵심 페이지 링크가 포함되어 있다.",
        required: true,
      },
      {
        code: "LLMS-03",
        label:
          "요금, 정책, 문의, 도움말 등 AI 답변에 필요한 주요 경로가 누락되지 않는다.",
        required: false,
      },
      {
        code: "LLMS-04",
        label:
          "공개하면 안 되는 내부 정보나 확인되지 않은 문구가 포함되지 않는다.",
        required: true,
      },
    ],
    isRequired: false,
  },
  "STRUCT-JSONLD-SAMEAS-001": {
    requirement:
      "Organization 또는 LocalBusiness JSON-LD에 공식 외부 채널을 sameAs로 연결합니다.",
    developerMessage:
      "초기 HTML의 JSON-LD에 sameAs 배열을 추가하고, 실제 운영자가 관리하는 공식 홈페이지·SNS·지도·앱스토어·지식패널 등 검증 가능한 외부 채널 URL만 넣어 주세요. 임의의 블로그 후기나 운영자가 관리하지 않는 페이지를 sameAs로 넣지 마세요.",
    acceptanceCriteria: [
      {
        code: "JSONLD-SAMEAS-01",
        label: "초기 HTML JSON-LD에서 sameAs 값을 확인할 수 있다.",
        required: true,
      },
      {
        code: "JSONLD-SAMEAS-02",
        label:
          "sameAs URL은 실제 공식 채널 또는 운영자가 관리하는 외부 프로필이다.",
        required: true,
      },
      {
        code: "JSONLD-SAMEAS-03",
        label: "sameAs 값이 화면의 운영 주체 정보와 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: false,
  },
  "STRUCT-JSONLD-CONTACTPOINT-001": {
    requirement:
      "Organization 또는 LocalBusiness JSON-LD에 고객 문의용 contactPoint를 추가합니다.",
    developerMessage:
      "초기 HTML의 JSON-LD에 contactPoint를 추가하고 문의 유형, 이메일·전화·문의 URL 중 실제 운영 중인 채널, 지원 언어 또는 응답 범위를 현재 정책과 맞게 작성해 주세요. 공개하지 않는 연락처나 운영하지 않는 채널을 구조화 데이터에 넣지 마세요.",
    acceptanceCriteria: [
      {
        code: "JSONLD-CONTACT-01",
        label: "초기 HTML JSON-LD에서 contactPoint를 확인할 수 있다.",
        required: true,
      },
      {
        code: "JSONLD-CONTACT-02",
        label:
          "contactPoint의 연락 경로가 실제 사용자 화면 또는 문의 페이지와 일치한다.",
        required: true,
      },
      {
        code: "JSONLD-CONTACT-03",
        label:
          "운영하지 않는 전화, 이메일, 상담 채널을 허위로 추가하지 않는다.",
        required: true,
      },
    ],
    isRequired: false,
  },
  "STRUCT-JSONLD-SEARCHACTION-001": {
    requirement:
      "사이트 내부 검색 기능이 실제로 확인되는 경우에만 WebSite JSON-LD에 SearchAction을 추가합니다.",
    developerMessage:
      "내부 검색 페이지가 실제로 존재하는 사이트에만 WebSite JSON-LD의 potentialAction으로 SearchAction을 선언해 주세요. 검색 URL 템플릿은 실제 검색 결과 페이지와 일치해야 합니다. 쇼핑몰·문서 사이트처럼 상품이나 문서를 사이트 안에서 검색하는 경우에는 AI 에이전트가 내부 검색 진입점을 이해하는 데 도움이 될 수 있지만, 내부 검색 기능이 없는 단순 랜딩 사이트나 허브 사이트라면 기능을 억지로 만들거나 허위 SearchAction을 추가하지 마세요.",
    acceptanceCriteria: [
      {
        code: "JSONLD-SEARCH-01",
        label:
          "내부 검색 기능이 있는 사이트인 경우 초기 HTML WebSite JSON-LD에서 SearchAction을 확인할 수 있다.",
        required: true,
      },
      {
        code: "JSONLD-SEARCH-02",
        label:
          "SearchAction target URL 템플릿이 실제 검색 결과 페이지와 일치한다.",
        required: true,
      },
      {
        code: "JSONLD-SEARCH-03",
        label:
          "내부 검색 기능이 없는 사이트는 SearchAction 대상이 아니며 허위 SearchAction을 추가하지 않는다.",
        required: true,
      },
    ],
    isRequired: false,
  },
  "STRUCT-JSONLD-ENTITY-TRUST-001": {
    requirement:
      "운영 주체를 식별할 수 있도록 Organization, LocalBusiness, WebSite 또는 WebApplication JSON-LD의 핵심 속성을 보강합니다.",
    developerMessage:
      "JSON-LD에 name, url, description과 함께 실제 사이트 성격에 맞는 운영 주체·서비스 정보를 넣어 주세요. 문의가 중요한 사이트는 email, telephone, address, contactPoint 중 실제 공개 가능한 값을 함께 선언하고, 화면의 회사소개·문의·약관·개인정보처리방침 정보와 충돌하지 않게 유지해 주세요.",
    acceptanceCriteria: [
      {
        code: "JSONLD-ENTITY-01",
        label:
          "JSON-LD에서 사이트 또는 운영 주체의 name과 url을 확인할 수 있다.",
        required: true,
      },
      {
        code: "JSONLD-ENTITY-02",
        label: "선택한 @type이 실제 사이트 성격과 일치한다.",
        required: true,
      },
      {
        code: "JSONLD-ENTITY-03",
        label: "공개 가능한 문의·주소·정책 정보가 화면 내용과 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: false,
  },
  "CONTENT-CORE-DEFINITION-001": {
    requirement:
      "서비스 정의, 해결하는 문제, 핵심 기능, 사용자가 얻는 결과를 사용자 화면과 초기 HTML에 함께 추가합니다.",
    developerMessage:
      "이 항목은 P2 AI 답변 준비 콘텐츠 작업에 해당하지만, P0 초기 HTML SSR/SSG가 먼저 충족되어야 점수와 AI 수집에 안정적으로 반영됩니다. 랜딩 페이지 본문에 이 서비스가 무엇을 제공하는지, 어떤 문제를 해결하는지, 사용자가 최종적으로 어떤 결과물을 얻는지 공식 문구로 작성해 주세요.",
    acceptanceCriteria: [
      {
        code: "CORE-DEFINITION-01",
        label: "초기 HTML과 사용자 화면에서 서비스 정의를 확인할 수 있다.",
        required: true,
      },
      {
        code: "CORE-DEFINITION-02",
        label:
          "해결하는 문제, 핵심 기능, 사용자가 얻는 결과가 1~2문단 이상으로 설명되어 있다.",
        required: true,
      },
      {
        code: "CORE-DEFINITION-03",
        label:
          "title, meta description, H1, JSON-LD의 서비스 설명과 의미가 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-AUDIENCE-USECASE-001": {
    requirement:
      "이용 대상과 대표 활용 사례를 초기 HTML과 사용자 화면에 명확히 추가합니다.",
    developerMessage:
      "AI가 누구에게 적합한 서비스인지 답할 수 있도록 '이런 분께 추천합니다', '대표 활용 사례', '사용 전후 변화' 같은 섹션을 작성해 주세요. 최소 2개 이상의 실제 활용 상황을 포함하고, 과장된 성과 표현보다 확인 가능한 사용 맥락을 우선합니다.",
    acceptanceCriteria: [
      {
        code: "AUDIENCE-USECASE-01",
        label: "주요 이용 대상이 초기 HTML과 사용자 화면에서 확인된다.",
        required: true,
      },
      {
        code: "AUDIENCE-USECASE-02",
        label: "대표 활용 사례가 최소 2개 이상 구체적으로 설명되어 있다.",
        required: true,
      },
      {
        code: "AUDIENCE-USECASE-03",
        label:
          "활용 사례가 실제 서비스 기능과 연결되어 있고 과장된 추천 문구만으로 구성되지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-WORKFLOW-OUTCOME-001": {
    requirement:
      "서비스 시작부터 결과 확인까지의 이용 절차와 최종 결과물을 3~5단계로 설명합니다.",
    developerMessage:
      "사용자가 어떤 순서로 서비스를 이용하고 어떤 산출물을 받는지 AI가 오독 없이 설명할 수 있어야 합니다. 가입, URL 입력, 진단 실행, 보고서/작업지시서 확인, 재검수 같은 실제 흐름을 3~5단계로 정리해 주세요.",
    acceptanceCriteria: [
      {
        code: "WORKFLOW-OUTCOME-01",
        label: "이용 절차가 3~5단계로 초기 HTML과 사용자 화면에 표시된다.",
        required: true,
      },
      {
        code: "WORKFLOW-OUTCOME-02",
        label: "사용자가 준비할 것과 최종 결과물이 무엇인지 확인할 수 있다.",
        required: true,
      },
      {
        code: "WORKFLOW-OUTCOME-03",
        label: "단계별 설명이 실제 화면의 기능 흐름과 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-PRICING-TERMS-001": {
    requirement:
      "무료 범위, 유료 범위, 요금제, 결제 주기, 추가 비용 여부를 사용자 화면과 초기 HTML에 명확히 안내합니다.",
    developerMessage:
      "AI는 요금 정보가 모호하면 잘못된 답변을 만들 수 있습니다. 무료 간편진단 범위, 유료 상세 보고서와 수정 작업지시서 제공 범위, 할인 또는 사례 활용 조건, 외부 결제·API 비용 여부를 표나 FAQ 형태로 정리해 주세요.",
    acceptanceCriteria: [
      {
        code: "PRICING-TERMS-01",
        label: "무료 제공 범위와 유료 제공 범위가 구분되어 있다.",
        required: true,
      },
      {
        code: "PRICING-TERMS-02",
        label:
          "요금제명, 가격 또는 가격 확인 방법, 결제 주기와 추가 비용 여부가 확인된다.",
        required: true,
      },
      {
        code: "PRICING-TERMS-03",
        label:
          "요금 관련 문구가 결제 화면, 약관, FAQ, JSON-LD와 의미상 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-SUPPORT-CONTACT-001": {
    requirement:
      "공식 문의 채널, 상담 가능 시간, 응답 기준, 지원 범위를 사용자 화면과 초기 HTML에 명확히 표시합니다.",
    developerMessage:
      "AI가 사용자에게 정확한 문의 방법을 안내할 수 있도록 이메일, 카카오톡, 채널톡, 전화 등 공식 채널과 운영시간, 예상 답변 소요 시간, 지원 가능한 문의 범위를 작성해 주세요. 구조화 데이터 contactPoint와도 같은 의미가 되게 유지합니다.",
    acceptanceCriteria: [
      {
        code: "SUPPORT-CONTACT-01",
        label: "공식 문의 채널이 초기 HTML과 사용자 화면에서 확인된다.",
        required: true,
      },
      {
        code: "SUPPORT-CONTACT-02",
        label: "상담 가능 시간, 예상 응답 기준, 지원 범위가 설명되어 있다.",
        required: true,
      },
      {
        code: "SUPPORT-CONTACT-03",
        label:
          "문의 정보가 footer, FAQ, JSON-LD contactPoint와 의미상 충돌하지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-DATA-POLICY-001": {
    requirement:
      "개인정보 처리, 입력자료 보관·삭제, 보안, 관련 정책 링크를 초기 HTML과 사용자 화면에 보강합니다.",
    developerMessage:
      "AI가 데이터 처리와 보안 질문에 답할 수 있도록 사용자가 입력한 URL·자료·진단 결과가 어떻게 처리되고 보관·삭제되는지 공식 문구로 설명해 주세요. 개인정보처리방침과 이용약관 링크는 JavaScript 클릭만이 아니라 href가 있는 표준 링크로 제공해야 합니다.",
    acceptanceCriteria: [
      {
        code: "DATA-POLICY-01",
        label:
          "개인정보와 입력자료 처리 방식이 초기 HTML과 사용자 화면에서 확인된다.",
        required: true,
      },
      {
        code: "DATA-POLICY-02",
        label: "보관·삭제 기준 또는 확인 가능한 정책 페이지 링크가 제공된다.",
        required: true,
      },
      {
        code: "DATA-POLICY-03",
        label: "개인정보처리방침·이용약관 링크가 표준 a 태그로 제공된다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-DIFFERENTIATION-PROOF-001": {
    requirement:
      "차별점, 대표 사례, 사용 예시, 후기 또는 실적 같은 신뢰 근거를 사실 기반으로 보강합니다.",
    developerMessage:
      "AI가 왜 이 사이트를 추천할 수 있는지 판단하려면 단순 홍보 문구보다 비교 가능한 차별점과 실제 사용 예시가 필요합니다. 경쟁 서비스와의 차이, 대표 적용 사례, 전후 비교, 고객 후기, 운영 실적 중 실제로 공개 가능한 근거를 사용자 화면과 초기 HTML에 작성해 주세요.",
    acceptanceCriteria: [
      {
        code: "DIFFERENTIATION-PROOF-01",
        label: "서비스 차별점이 초기 HTML과 사용자 화면에 설명되어 있다.",
        required: true,
      },
      {
        code: "DIFFERENTIATION-PROOF-02",
        label:
          "대표 사례, 사용 예시, 후기, 실적 중 하나 이상의 신뢰 근거가 확인된다.",
        required: true,
      },
      {
        code: "DIFFERENTIATION-PROOF-03",
        label:
          "검증할 수 없는 과장 표현이나 사실과 다른 추천 근거를 사용하지 않는다.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "CONTENT-TRANSACTION-POLICY-001": {
    requirement:
      "사이트 전환 구조에 맞는 결제·예약·문의 정책을 사용자 화면과 초기 HTML에 명확히 안내합니다.",
    developerMessage:
      "자동 추정된 전환 유형에 따라 완료 기준이 달라집니다. 직접 결제형은 환불·취소·해지 기준, 예약·문의 전환형은 예약 변경·취소와 상담 기준, 정보 제공형은 운영 주체와 공식 문의 정책을 명확히 작성해 주세요. 실제 비즈니스 모델이 자동 추정과 다르면 먼저 전환 유형을 확인해야 합니다.",
    acceptanceCriteria: [
      {
        code: "TRANSACTION-POLICY-01",
        label:
          "현재 사이트가 직접 결제형, 예약·문의 전환형, 정보 제공형 중 어느 구조인지 확인되어 있다.",
        required: true,
      },
      {
        code: "TRANSACTION-POLICY-02",
        label:
          "전환 구조에 맞는 환불·취소·변경·문의 또는 운영 주체 정책이 초기 HTML과 사용자 화면에서 확인된다.",
        required: true,
      },
      {
        code: "TRANSACTION-POLICY-03",
        label:
          "요금/결제 안내, 약관, FAQ, 문의 정보와 정책 문구가 의미상 충돌하지 않는다.",
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
        label:
          "The change is verifiable on the production URL and does not break existing passing items.",
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
        label:
          "The H2 sections match the main content sections shown to users.",
        required: true,
      },
      {
        code: "HEADINGS-03",
        label:
          "Adding the heading hierarchy does not break the existing design or key features.",
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
        label:
          "The initial HTML body includes at least 75% of the rendered DOM body or the key-information gap is within the allowed range.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-03",
        label:
          "The service definition, target customers, representative use cases, usage flow, and pricing/data handling summary are visible in the initial HTML.",
        required: true,
      },
      {
        code: "INITIAL-TEXT-04",
        label:
          "The content has the same meaning as the real user-facing page and is not hidden text for search exposure.",
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
        label:
          "The service definition and core value can be explained from the initial HTML alone.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-02",
        label:
          "Target users and at least two representative use cases are visible.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-03",
        label:
          "A 3–5 step usage flow, such as sign-up, creation, deployment, submission check, and export, is visible.",
        required: true,
      },
      {
        code: "CONTENT-ANSWERABILITY-001-04",
        label:
          "Pricing, data handling, operator information, or a contact path is visible.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "STRUCT-LINKS-001": {
    requirement:
      "Expose key internal pages in the initial HTML as standard anchor links instead of JavaScript-only clicks.",
    developerMessage:
      "Along with the P0 initial HTML improvement work, output key links such as pricing, features, terms, privacy policy, help, and contact pages as standard <a> tags with href attributes in the initial HTML. Use descriptive link text rather than generic text such as 'Learn more' so AI systems and crawlers can understand the destination.",
    acceptanceCriteria: [
      {
        code: "LINKS-01",
        label: "Key internal links are visible in the initial HTML.",
        required: true,
      },
      {
        code: "LINKS-02",
        label:
          "Key internal links use standard anchor tags with href attributes.",
        required: true,
      },
      {
        code: "LINKS-03",
        label:
          "The initial HTML contains at least 75% of the rendered DOM internal links or differs by no more than two links.",
        required: true,
      },
      {
        code: "LINKS-04",
        label: "Link text describes the destination content.",
        required: false,
      },
    ],
    isRequired: true,
  },
  "ACCESS-SITEMAP-001": {
    requirement:
      "Declare the actual sitemap URL in robots.txt and make sure it returns a public 2xx XML response without authentication.",
    developerMessage:
      "Align the Sitemap directive in robots.txt with the actual sitemap response. After any redirects, the sitemap URL should still return a publicly accessible XML sitemap or sitemap index document.",
    acceptanceCriteria: [
      {
        code: "SITEMAP-01",
        label: "A sitemap URL can be found in robots.txt.",
        required: true,
      },
      {
        code: "SITEMAP-02",
        label: "The declared sitemap URL returns a 2xx response.",
        required: true,
      },
      {
        code: "SITEMAP-03",
        label: "The response is an XML sitemap or sitemap index.",
        required: true,
      },
      {
        code: "SITEMAP-04",
        label: "The sitemap URLs stay within the registered site domain scope.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "META-CANONICAL-001": {
    requirement:
      "Add a canonical link in the initial HTML head that points to the final representative URL.",
    developerMessage:
      "Output a canonical link element in the initial HTML head, and make sure its href matches the actual final public URL. Avoid duplicate canonical declarations and make sure the canonical URL resolves to a normal 2xx representative page.",
    acceptanceCriteria: [
      {
        code: "CANONICAL-01",
        label: "A canonical link can be found in the initial HTML head.",
        required: true,
      },
      {
        code: "CANONICAL-02",
        label: "The canonical href is an absolute HTTPS URL.",
        required: true,
      },
      {
        code: "CANONICAL-03",
        label: "The canonical URL points to a normal 2xx representative page.",
        required: true,
      },
      {
        code: "CANONICAL-04",
        label: "There are no duplicate canonical declarations.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "META-OG-001": {
    requirement:
      "Add og:title and og:description to the initial HTML and keep their meaning consistent with the visible page title and description.",
    developerMessage:
      "Output og:title and og:description in the initial HTML head. They should not conflict with the regular title and meta description, and they should summarize the same service and value proposition shown on the page.",
    acceptanceCriteria: [
      {
        code: "OG-01",
        label: "og:title can be found in the initial HTML.",
        required: true,
      },
      {
        code: "OG-02",
        label: "og:description can be found in the initial HTML.",
        required: true,
      },
      {
        code: "OG-03",
        label: "The Open Graph title and description are not empty.",
        required: true,
      },
      {
        code: "OG-04",
        label:
          "The Open Graph values are semantically consistent with the visible representative title and description.",
        required: false,
      },
    ],
    isRequired: true,
  },
  "STRUCT-JSONLD-001": {
    requirement:
      "Add valid Schema.org JSON-LD to the initial HTML and keep it consistent with the visible page information.",
    developerMessage:
      'Output a <script type="application/ld+json"> block in the initial HTML. Check JSON syntax, required properties, and consistency with the visible page. For SaaS or web services, prioritize WebApplication or a WebSite/Organization combination. If the visible page includes FAQ content, also consider FAQPage JSON-LD.',
    acceptanceCriteria: [
      {
        code: "JSONLD-01",
        label: "A JSON-LD script can be found in the initial HTML.",
        required: true,
      },
      {
        code: "JSONLD-02",
        label: "The JSON-LD parses as valid JSON without errors.",
        required: true,
      },
      {
        code: "JSONLD-03",
        label: "Schema.org context and a site-appropriate type are present.",
        required: true,
      },
      {
        code: "JSONLD-04",
        label:
          "Structured data such as name, URL, and description matches the visible page information.",
        required: true,
      },
    ],
    isRequired: true,
  },
  "STRUCT-JSONLD-TYPES-001": {
    requirement:
      "Specify Schema.org @type values that match the site, such as WebSite, Organization, WebApplication, or LocalBusiness.",
    developerMessage:
      "Choose Schema.org @type values that match the actual operator and service type of the site. Do not use exaggerated or misleading types. Make sure the selected type has meaningful required or core properties.",
    acceptanceCriteria: [
      {
        code: "JSONLD-TYPE-01",
        label: "An identifiable @type exists in the JSON-LD.",
        required: true,
      },
      {
        code: "JSONLD-TYPE-02",
        label: "The @type matches the actual nature of the site.",
        required: true,
      },
      {
        code: "JSONLD-TYPE-03",
        label: "Core properties for the selected type are not empty.",
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
    acceptanceCriteria: plan.acceptanceCriteria.map((label, index) => ({
      code: `${prefix}-${String(index + 1).padStart(2, "0")}`,
      label,
      required: true,
    })),
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
