import { describe, expect, it } from "vitest";
import {
  buildRenderedImprovementWorkOrderTemplate,
  buildWorkOrderTemplate,
} from "./work-order-templates";

describe("work order templates", () => {
  it("JSON-LD 문제에 구체적인 완료 기준을 만든다", () => {
    const template = buildWorkOrderTemplate({
      ruleCode: "STRUCT-JSONLD-001",
      title: "JSON-LD 구조화 데이터",
      description: "유효한 JSON-LD가 없습니다.",
      recommendation: "JSON-LD를 추가하세요.",
      severity: "MEDIUM",
    });

    expect(template.isRequired).toBe(true);
    expect(template.acceptanceCriteria).toHaveLength(4);
    expect(template.acceptanceCriteria[0]?.code).toBe("JSONLD-01");
    expect(template.requirement).toContain("Schema.org");
  });

  it("신규 구조화 데이터 규칙에 전용 작업지시서를 만든다", () => {
    const cases = [
      ["ACCESS-LLMS-TXT-001", "llms.txt", "LLMS-01"],
      ["STRUCT-JSONLD-SAMEAS-001", "sameAs", "JSONLD-SAMEAS-01"],
      ["STRUCT-JSONLD-CONTACTPOINT-001", "contactPoint", "JSONLD-CONTACT-01"],
      ["STRUCT-JSONLD-SEARCHACTION-001", "SearchAction", "JSONLD-SEARCH-01"],
      ["STRUCT-JSONLD-ENTITY-TRUST-001", "운영 주체", "JSONLD-ENTITY-01"],
    ] as const;

    for (const [ruleCode, expectedText, firstCriterion] of cases) {
      const template = buildWorkOrderTemplate({
        ruleCode,
        title: expectedText,
        description: "구조화 데이터 보완이 필요합니다.",
        recommendation: null,
        severity: "LOW",
      });

      expect(template.requirement).toContain(expectedText);
      expect(template.developerMessage).not.toContain(
        `${ruleCode} 진단의 현재 증거`,
      );
      expect(template.acceptanceCriteria[0]?.code).toBe(firstCriterion);
      expect(template.isRequired).toBe(false);
    }
  });

  it("AI 수집 개선안을 비개발자 설명과 개발자 지시로 만든다", () => {
    const template = buildRenderedImprovementWorkOrderTemplate({
      code: "RENDERED-ADDED-CONTENT",
      currentState: "본문과 링크가 화면 완성 후 증가했습니다.",
      meaning: "일부 AI 검색 봇은 나중에 추가된 정보를 놓칠 수 있습니다.",
      change: "핵심 정보와 링크를 처음 전달되는 페이지에도 포함합니다.",
      developerInstructions: [
        "핵심 본문을 초기 HTML에 출력해 주세요.",
        "기존 화면 기능을 유지해 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML에서 핵심 본문이 확인됩니다.",
        "기존 화면 기능이 정상 동작합니다.",
      ],
    });

    expect(template.isRequired).toBe(false);
    expect(template.requirement).toContain("현재 상태");
    expect(template.requirement).toContain("무엇을 바꾸나요");
    expect(template.developerMessage).toContain("초기 HTML");
    expect(template.acceptanceCriteria).toHaveLength(2);
    expect(template.acceptanceCriteria[0]?.code).toBe("JS-CONTENT-01");
  });

  it("알 수 없는 규칙에도 일반 완료 기준을 만든다", () => {
    const template = buildWorkOrderTemplate({
      ruleCode: "CUSTOM-RULE-001",
      title: "사용자 규칙",
      description: "사용자 규칙 설명",
      recommendation: "문제를 수정하세요.",
      severity: "LOW",
    });

    expect(template.isRequired).toBe(false);
    expect(template.acceptanceCriteria).toHaveLength(3);
    expect(template.requirement).toBe("문제를 수정하세요.");
  });
});


describe("commerce work order wording", () => {
  const commerceEvidence = {
    siteArchetype: "ECOMMERCE",
    conversionIntent: "DIRECT_PAYMENT",
  };

  it("쇼핑몰 콘텐츠 항목 전체에서 SaaS 전용 문구를 사용하지 않는다", () => {
    const ruleCodes = [
      "STRUCT-H1-001",
      "CONTENT-HEADINGS-001",
      "STRUCT-LINKS-001",
      "CONTENT-CORE-DEFINITION-001",
      "CONTENT-AUDIENCE-USECASE-001",
      "CONTENT-WORKFLOW-OUTCOME-001",
      "CONTENT-PRICING-TERMS-001",
      "CONTENT-DATA-POLICY-001",
      "CONTENT-DIFFERENTIATION-PROOF-001",
      "CONTENT-TRANSACTION-POLICY-001",
    ];
    const banned = [
      "P0 초기 HTML SSR/SSG",
      "이 서비스가 무엇을 제공",
      "누구에게 적합한 서비스",
      "사용 전후 변화",
      "실제 활용 상황",
      "맞춤 제작 순서을",
      "최종 결과물",
      "서비스 요금",
      "입력한 URL",
      "진단 결과",
      "경쟁 서비스",
      "대표 적용 사례",
      "서비스 차별점",
      "예약·문의 전환형",
      "정보 제공형",
      "사이트 전환 구조에 맞는 결제·예약·문의 정책",
    ];

    const templates = ruleCodes.map((ruleCode) =>
      buildWorkOrderTemplate({
        ruleCode,
        title: ruleCode,
        description: "전자상거래 사이트 개선 항목입니다.",
        recommendation: null,
        severity: "MEDIUM",
        evidenceJson: commerceEvidence,
      }),
    );
    const text = JSON.stringify(templates);

    for (const phrase of banned) expect(text).not.toContain(phrase);
    expect(text).toContain("브랜드 정체성");
    expect(text).toContain("주문·결제");
    expect(text).toContain("배송지 정보");
    expect(text).toContain("주문제작 취소 조건");
    expect(text).toContain("A/S");
  });

  it("렌더링 개선안도 쇼핑몰 문맥으로 변환한다", () => {
    const template = buildRenderedImprovementWorkOrderTemplate(
      {
        code: "RENDERED-ADDED-CONTENT",
        currentState: "초기 HTML 본문은 기준을 충족합니다.",
        meaning: "내부 링크 보완이 필요합니다.",
        change: "서비스 정의와 주요 내부 링크를 보완합니다.",
        developerInstructions: ["요금제 또는 무료·유료 이용 범위를 안내합니다."],
        acceptanceCriteria: ["서비스 정의와 대상 고객을 확인할 수 있습니다."],
      },
      "ko",
      { siteArchetype: "ECOMMERCE" },
    );
    const text = JSON.stringify(template);

    expect(text).toContain("브랜드·상품 정의");
    expect(text).toContain("상품 가격·재고·주문 가능 상태");
    expect(text).not.toContain("서비스 정의");
    expect(text).not.toContain("무료·유료 이용 범위");
  });

  it("uses English fallback text for unmapped rules", () => {
    const template = buildWorkOrderTemplate(
      {
        ruleCode: "CUSTOM-ENGLISH-RULE-001",
        title: "Stored Korean title",
        description: "저장된 한국어 설명",
        recommendation: "저장된 한국어 권고",
        severity: "MEDIUM",
      },
      "en",
    );
    const text = JSON.stringify(template);
    expect(text).toContain("Review the current evidence");
    expect(text).not.toMatch(/[가-힣]/);
  });

  it("uses complete English e-commerce templates without SaaS wording", () => {
    const ruleCodes = [
      "ACCESS-LLMS-TXT-001",
      "STRUCT-H1-001",
      "CONTENT-HEADINGS-001",
      "STRUCT-LINKS-001",
      "CONTENT-CORE-DEFINITION-001",
      "CONTENT-AUDIENCE-USECASE-001",
      "CONTENT-WORKFLOW-OUTCOME-001",
      "CONTENT-PRICING-TERMS-001",
      "CONTENT-DATA-POLICY-001",
      "CONTENT-DIFFERENTIATION-PROOF-001",
      "CONTENT-TRANSACTION-POLICY-001",
    ];
    const templates = ruleCodes.map((ruleCode) =>
      buildWorkOrderTemplate(
        {
          ruleCode,
          title: ruleCode,
          description: "E-commerce improvement item.",
          recommendation: null,
          severity: "MEDIUM",
          evidenceJson: commerceEvidence,
        },
        "en",
      ),
    );
    const text = JSON.stringify(templates);
    for (const phrase of [
      "SaaS",
      "service definition",
      "free and paid plans",
      "free/paid",
      "URL input",
      "WebApplication",
      "usage process and deliverables",
      "initial HTML SSR/SSG work",
      "service overview",
      "target users",
      "usage flow",
      "pricing/security",
    ]) {
      expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    expect(text.toLowerCase()).toContain("brand and product");
    expect(text).toContain("ordering and payment");
    expect(text).toContain("shipping data");
    expect(text).toContain("made-to-order cancellation");
    expect(text).toContain("after-sales service");
    expect(text).toContain("product-selection criteria");
    expect(text).toContain("Do not introduce SSR/SSG solely for this item");

    const lowSeverityCommerceHeading = buildWorkOrderTemplate(
      {
        ruleCode: "CONTENT-HEADINGS-001",
        title: "제목 계층 구조",
        description: "H1과 H2 제목 계층이 부족합니다.",
        recommendation: null,
        severity: "LOW",
        evidenceJson: commerceEvidence,
      },
      "ko",
    );
    expect(lowSeverityCommerceHeading.isRequired).toBe(true);

    const genericHeading = buildWorkOrderTemplate(
      {
        ruleCode: "CONTENT-HEADINGS-001",
        title: "Heading hierarchy",
        description: "The heading hierarchy needs improvement.",
        recommendation: null,
        severity: "MEDIUM",
      },
      "en",
    );
    const genericHeadingText = JSON.stringify(genericHeading);
    expect(genericHeadingText).toContain("initial HTML structure improvements");
    expect(genericHeadingText).toContain("product-selection criteria");
    expect(genericHeadingText).toContain(
      "does not require a new SSR/SSG migration",
    );
  });

});
