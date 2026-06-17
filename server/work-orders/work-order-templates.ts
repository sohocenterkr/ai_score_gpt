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

interface RenderedImprovementTemplateInput {
  code: string;
  currentState: string;
  meaning: string;
  change: string;
  developerInstructions: string[];
  acceptanceCriteria: string[];
}

const templates: Record<string, WorkOrderTemplate> = {
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
      "사이트의 성격과 핵심정보를 설명하는 유효한 Schema.org JSON-LD를 초기 HTML에 추가합니다.",
    developerMessage:
      '초기 HTML에 <script type="application/ld+json">을 출력하고 JSON 문법, 필수 속성, 화면 정보와의 일치를 확인해 주세요.',
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
        label: "이름·URL 등 구조화 데이터가 실제 화면 정보와 일치한다.",
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

function genericCriteria(ruleCode: string): AcceptanceCriterion[] {
  const prefix = ruleCode.replace(/[^A-Z0-9]+/g, "-");

  return [
    {
      code: `${prefix}-01`,
      label: "초기 HTML 또는 공개 응답에서 수정 결과를 확인할 수 있다.",
      required: true,
    },
    {
      code: `${prefix}-02`,
      label: "검사에서 사용한 대상 URL과 동일한 운영 URL에 반영되어 있다.",
      required: true,
    },
    {
      code: `${prefix}-03`,
      label: "기존 정상 항목을 제거하거나 차단하는 회귀가 없다.",
      required: true,
    },
  ];
}

export function buildRenderedImprovementWorkOrderTemplate(
  plan: RenderedImprovementTemplateInput,
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
      `현재 상태: ${plan.currentState}`,
      `무슨 뜻인가요: ${plan.meaning}`,
      `무엇을 바꾸나요: ${plan.change}`,
    ].join("\n\n"),
    developerMessage: plan.developerInstructions
      .map((instruction) => `- ${instruction}`)
      .join("\n"),
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
): WorkOrderTemplate {
  const defined = templates[finding.ruleCode];

  if (defined) {
    return defined;
  }

  const requirement =
    finding.recommendation?.trim() ||
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
