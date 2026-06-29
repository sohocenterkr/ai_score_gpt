export type ContentReadinessStatus =
  | "NEEDS_WORK"
  | "PARTIAL"
  | "BASIC_READY";

export interface ContentReadinessTopic {
  code: string;
  title: string;
  status: "PARTIAL" | "REVIEW_REQUIRED";
  reason: string;
  questions: string[];
  suggestedSections: string[];
  contentWriterInstruction: string;
  developerInstruction: string;
  acceptanceCriteria: string[];
}

export interface ContentReadinessAssessment {
  status: ContentReadinessStatus;
  label: string;
  summary: string;
  confirmedSignals: string[];
  topics: ContentReadinessTopic[];
  benchmarkNote: string;
  disclaimer: string;
}

interface EvidenceFinding {
  ruleCode: string;
  evidence?: unknown;
  evidenceJson?: unknown;
}

interface AssessmentInput {
  siteName: string;
  siteType: string | null;
  findings: readonly EvidenceFinding[];
}

type Evidence = Record<string, unknown>;

function object(value: unknown): Evidence {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Evidence)
    : {};
}

function evidence(
  findings: readonly EvidenceFinding[],
  ruleCode: string,
): Evidence {
  const finding = findings.find((item) => item.ruleCode === ruleCode);
  return object(finding?.evidenceJson ?? finding?.evidence);
}

function text(record: Evidence, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function number(record: Evidence, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

function texts(record: Evidence, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function has(values: readonly string[], pattern: RegExp): boolean {
  return values.some((value) => pattern.test(value));
}

export function buildContentReadinessAssessment(
  input: AssessmentInput,
): ContentReadinessAssessment {
  const title = text(
    evidence(input.findings, "META-TITLE-001"),
    "title",
  );
  const description = text(
    evidence(input.findings, "META-DESCRIPTION-001"),
    "metaDescription",
  );
  const h1 = texts(
    evidence(input.findings, "STRUCT-H1-001"),
    "h1",
  );
  const h2 = texts(
    evidence(input.findings, "CONTENT-HEADINGS-001"),
    "h2",
  );
  const textLength = number(
    evidence(input.findings, "CONTENT-INITIAL-001"),
    "textLength",
  );
  const linkEvidence = evidence(
    input.findings,
    "STRUCT-LINKS-001",
  );
  const internalLinks = number(linkEvidence, "internal");
  const linkSample = texts(linkEvidence, "sample");
  const jsonLdTypes = texts(
    evidence(input.findings, "STRUCT-JSONLD-TYPES-001"),
    "types",
  );

  const confirmedSignals = [
    `초기 HTML 본문: ${textLength.toLocaleString("ko-KR")}자`,
  ];
  if (title) confirmedSignals.push(`문서 제목: ${title}`);
  if (description) {
    confirmedSignals.push(`메타 설명: ${description}`);
  }
  if (h1[0]) confirmedSignals.push(`대표 H1: ${h1[0]}`);
  if (h2.length) {
    confirmedSignals.push(
      `H2 ${h2.length.toLocaleString("ko-KR")}개: ${h2
        .slice(0, 3)
        .join(", ")}`,
    );
  }
  confirmedSignals.push(
    `초기 HTML 내부 링크: ${internalLinks.toLocaleString("ko-KR")}개`,
  );
  if (jsonLdTypes.length) {
    confirmedSignals.push(
      `JSON-LD 유형: ${jsonLdTypes.join(", ")}`,
    );
  }

  let points = 0;
  if (textLength >= 800) points += 2;
  else if (textLength >= 200) points += 1;
  if (title && description) points += 1;
  if (h1.length && h2.length) points += 1;
  if (internalLinks > 0) points += 1;
  if (jsonLdTypes.length) points += 1;

  const status: ContentReadinessStatus =
    points >= 5
      ? "BASIC_READY"
      : points >= 3
        ? "PARTIAL"
        : "NEEDS_WORK";
  const label =
    status === "BASIC_READY"
      ? "기초 콘텐츠 구조 확인"
      : status === "PARTIAL"
        ? "일부 보완 필요"
        : "콘텐츠 보완 필요";
  const rawSiteType = input.siteType?.trim() ?? "";
  const hasUsefulSiteType =
    Boolean(rawSiteType) &&
    rawSiteType.length <= 40 &&
    !/[.!?。！？]$/.test(rawSiteType) &&
    !/(하세요|합니다|됩니다|입니다|드세요|주세요)$/.test(
      rawSiteType,
    );

  const typeText = hasUsefulSiteType
    ? `등록 사이트 유형은 "${rawSiteType}"입니다.`
    : "등록 사이트 유형은 구체적으로 확인되지 않았습니다.";
  const summary =
    status === "NEEDS_WORK"
      ? `${input.siteName}의 초기 HTML 본문은 ${textLength.toLocaleString(
          "ko-KR",
        )}자입니다. 현재 QUICK 증거만으로 주요 사용자 질문에 충분히 답할 콘텐츠가 있는지 확인하기 어렵습니다. ${typeText}`
      : status === "PARTIAL"
        ? `${input.siteName}에서 제목·설명·본문 구조 일부를 확인했지만, 주요 질문에 답할 정보가 충분하고 구체적인지는 추가 확인이 필요합니다. ${typeText}`
        : `${input.siteName}에서 기본 본문량과 제목·링크 구조를 확인했습니다. 사실 정확성·독창성·답변 품질은 운영자가 별도로 검토해야 합니다. ${typeText}`;

  const clues = [...h2, ...linkSample];
  const definitionPartial = Boolean(title && description);
  const workflowPartial = has(
    clues,
    /이용|사용|방법|절차|과정|가이드|how|guide/i,
  );
  const scopePartial = Boolean(
    description &&
      /지원|플랫폼|기능|언어|형식|서비스/i.test(description),
  );
  const trustPartial = has(
    clues,
    /privacy|policy|terms|contact|about|개인정보|약관|문의|회사|운영/i,
  );
  const faqPartial = has(
    clues,
    /faq|help|question|guide|질문|도움말|가이드|문의/i,
  );

  const make = (
    code: string,
    titleValue: string,
    partial: boolean,
    reason: string,
    questions: string[],
    sections: string[],
    writer: string,
    developer: string,
    criteria: string[],
  ): ContentReadinessTopic => ({
    code,
    title: titleValue,
    status: partial ? "PARTIAL" : "REVIEW_REQUIRED",
    reason,
    questions,
    suggestedSections: sections,
    contentWriterInstruction: writer,
    developerInstruction: developer,
    acceptanceCriteria: criteria,
  });

  const topics = [
    make(
      "CONTENT-TOPIC-SERVICE-DEFINITION",
      "서비스 정의와 핵심 가치",
      definitionPartial,
      definitionPartial
        ? "문서 제목과 메타 설명에서 개요 일부를 확인했지만 실제 화면 본문의 충분성은 확인이 필요합니다."
        : "사이트가 무엇을 제공하는지 설명하는 본문을 현재 증거에서 충분히 확인하지 못했습니다.",
      [
        `${input.siteName} 서비스는 무엇을 제공하나요?`,
        "사용자가 어떤 문제를 해결할 수 있나요?",
        "어떤 결과물을 얻나요?",
      ],
      [
        `${input.siteName} 서비스란?`,
        "핵심 기능과 제공 가치",
        "사용자가 얻는 결과",
      ],
      "실제로 제공하는 기능과 결과만 사용해 2~4문장으로 작성하고 확인되지 않은 기능은 넣지 마세요.",
      "초기 HTML에는 단순 소개 문구가 아니라 서비스 정의, 해결하는 문제, 핵심 기능, 사용자가 얻는 결과를 실제 사용자 화면과 같은 내용으로 포함해 주세요.",
      [
        "페이지 내용만으로 서비스 정의와 핵심 결과를 설명할 수 있다.",
        "실제 제공 사실만 작성되어 있다.",
        "사용자 화면과 초기 HTML에서 모두 확인된다.",
      ],
    ),
    make(
      "CONTENT-TOPIC-AUDIENCE",
      "이용 대상과 활용 사례",
      false,
      "누구에게 적합한 서비스인지와 실제 활용 상황은 현재 QUICK 증거로 확인하지 못했습니다.",
      [
        "어떤 사람이 사용하면 좋은가요?",
        "어떤 상황에서 도움이 되나요?",
        "대표 이용 사례는 무엇인가요?",
      ],
      ["이런 분께 추천합니다", "대표 활용 사례", "사용 전후 변화"],
      "실제 주요 고객군과 사용 상황을 구체적으로 작성하고 확인되지 않은 고객 유형은 추가하지 마세요.",
      "이용 대상과 활용 사례를 H2 독립 섹션으로 구성하고, 최소 2개 이상의 대표 사용 상황을 초기 HTML에서도 읽히게 하며 관련 상세 페이지를 일반 링크로 연결해 주세요.",
      [
        "주요 이용 대상이 구체적이다.",
        "최소 2개의 실제 활용 상황을 설명한다.",
        "확인되지 않은 사례를 사실처럼 쓰지 않는다.",
      ],
    ),
    make(
      "CONTENT-TOPIC-WORKFLOW",
      "이용 절차와 결과물",
      workflowPartial,
      workflowPartial
        ? "이용 방법 관련 단서 일부가 있으나 단계별 설명과 결과물 범위는 확인이 필요합니다."
        : "서비스 시작부터 결과 획득까지의 과정을 설명하는 단서를 충분히 확인하지 못했습니다.",
      [
        "어떤 순서로 이용하나요?",
        "사용자가 준비할 것은 무엇인가요?",
        "최종 결과물은 무엇인가요?",
      ],
      ["이용 방법", "단계별 사용 과정", "완성되는 결과물"],
      "실제 이용 흐름을 3~5단계로 작성하고 각 단계의 사용자 행동과 결과를 구분하세요.",
      "가입, 생성, 배포, 제출 확인, 내보내기처럼 실제 이용 흐름을 3~5단계 순서 목록으로 구현하고 핵심 단계는 초기 HTML에서도 읽히게 해 주세요.",
      [
        "이용 과정을 처음부터 끝까지 설명한다.",
        "준비 정보와 결과물을 확인할 수 있다.",
        "실제 서비스 동작과 일치한다.",
      ],
    ),
    make(
      "CONTENT-TOPIC-SCOPE",
      "지원 범위와 제한 사항",
      scopePartial,
      scopePartial
        ? "메타 설명에서 기능 또는 지원 범위 일부가 보이지만 상세 범위와 제한은 확인이 필요합니다."
        : "지원 기능·입력·출력·플랫폼과 제한을 현재 증거에서 확인하지 못했습니다.",
      [
        "어떤 기능과 입력 자료를 지원하나요?",
        "지원 플랫폼·언어·출력 형식은 무엇인가요?",
        "제한되는 경우는 무엇인가요?",
      ],
      ["지원 기능과 범위", "지원 플랫폼·형식", "제한 사항"],
      "현재 지원하는 범위와 지원하지 않는 범위를 구분하고 개발 예정 기능을 현재 기능처럼 쓰지 마세요.",
      "지원 범위는 표나 목록으로 표시하고 화면·메타데이터·구조화 정보가 충돌하지 않게 해 주세요.",
      [
        "지원 기능과 범위를 확인할 수 있다.",
        "제한 사항을 명시한다.",
        "화면과 메타데이터가 일치한다.",
      ],
    ),
    make(
      "CONTENT-TOPIC-TRUST",
      "요금·데이터 처리·운영 주체",
      trustPartial,
      trustPartial
        ? "관련 링크 단서는 있으나 실제 요금·자료 처리·운영 정보의 충분성은 확인이 필요합니다."
        : "요금, 사용자 자료 처리, 운영 주체와 문의 방법을 현재 증거에서 충분히 확인하지 못했습니다.",
      [
        "무료·유료 범위는 어떻게 되나요?",
        "입력 자료는 어떻게 처리되나요?",
        "누가 운영하고 어디로 문의하나요?",
      ],
      ["요금과 이용 범위", "개인정보·자료 처리", "운영 주체와 문의"],
      "요금과 자료 처리 방식은 실제 정책과 일치하게 작성하고 공개 전 운영자가 확인하세요.",
      "무료·유료 범위, 요금제, 개인정보·입력자료 처리 방식, 운영 주체와 문의 경로를 초기 HTML에 1~2문장으로 요약하고 정책·요금·문의 페이지를 일반 링크로 연결해 주세요.",
      [
        "요금 또는 이용 범위를 확인할 수 있다.",
        "자료 처리 방식과 정책 링크가 있다.",
        "운영 주체와 문의 경로가 있다.",
      ],
    ),
    make(
      "CONTENT-TOPIC-FAQ",
      "자주 묻는 질문과 추가 탐색 경로",
      faqPartial,
      faqPartial
        ? "FAQ·도움말 관련 단서는 있으나 주요 질문에 실제로 답하는지는 확인이 필요합니다."
        : "FAQ·가이드·문의 경로를 현재 증거에서 충분히 확인하지 못했습니다.",
      [
        "처음 사용하는 사람이 자주 묻는 질문은 무엇인가요?",
        "예외 상황은 어떻게 처리하나요?",
        "더 자세한 설명은 어디에 있나요?",
      ],
      ["자주 묻는 질문", "도움말과 이용 가이드", "문의 및 지원"],
      "실제 문의가 많은 질문부터 직접 답하고 검색어 반복용 인위적 문답은 만들지 마세요.",
      "FAQ를 사용자에게 보이는 콘텐츠로 제공하고, 실제 화면의 핵심 FAQ 3~4개는 FAQPage JSON-LD에도 같은 답변으로 선언하며 도움말·문의 페이지를 설명적 링크로 연결해 주세요.",
      [
        "핵심 질문과 답변이 화면에 있다.",
        "답변이 현재 정책과 일치한다.",
        "도움말·문의 링크가 있다.",
      ],
    ),
  ];

  return {
    status,
    label,
    summary,
    confirmedSignals,
    topics,
    benchmarkNote:
      "800자와 75% 포함 비율은 Site AI Score가 기본 설명량과 렌더링 의존도를 비교하기 위해 사용하는 내부 참고 기준입니다. 모든 검색엔진이나 AI 서비스의 공통 공식 기준은 아니며, 핵심 목표는 글자 수 자체가 아니라 AI가 서비스의 정의·대상·이용 절차·요금·데이터 처리·FAQ를 정확히 인식하고 인용할 수 있게 하는 것입니다.",
    disclaimer:
      "위 항목은 현재 QUICK 증거에서 확인하지 못했거나 추가 검토가 필요한 후보입니다. 실제로 없다고 단정하지 않으며, 운영자가 사실관계를 확인한 뒤 사용자에게도 보이는 내용으로 작성해야 합니다.",
  };
}
