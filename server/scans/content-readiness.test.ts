import { describe, expect, it } from "vitest";
import { buildContentReadinessAssessment } from "./content-readiness";

describe("content readiness assessment", () => {
  it("초기 본문이 거의 없는 사이트에 보완안을 만든다", () => {
    const result = buildContentReadinessAssessment({
      siteName: "PostDrafter",
      siteType: "AI 블로그 초안 서비스",
      findings: [
        {
          ruleCode: "META-TITLE-001",
          evidence: { title: "PostDrafter" },
        },
        {
          ruleCode: "META-DESCRIPTION-001",
          evidence: {
            metaDescription: "사진과 메모로 블로그 초안을 생성합니다.",
          },
        },
        {
          ruleCode: "CONTENT-INITIAL-001",
          evidence: { textLength: 7 },
        },
        {
          ruleCode: "STRUCT-H1-001",
          evidence: { h1: [] },
        },
        {
          ruleCode: "CONTENT-HEADINGS-001",
          evidence: { h2: [] },
        },
        {
          ruleCode: "STRUCT-LINKS-001",
          evidence: { internal: 0, sample: [] },
        },
      ],
    });

    expect(result.status).toBe("NEEDS_WORK");
    expect(result.topics).toHaveLength(6);
    expect(result.summary).toContain("7자");
    expect(result.benchmarkNote).toContain("내부 참고 기준");
  });

  it("기본 본문·제목·링크가 있으면 기초 구조로 표시한다", () => {
    const result = buildContentReadinessAssessment({
      siteName: "예제 사이트",
      siteType: "기업 홈페이지",
      findings: [
        {
          ruleCode: "META-TITLE-001",
          evidence: { title: "예제 사이트" },
        },
        {
          ruleCode: "META-DESCRIPTION-001",
          evidence: {
            metaDescription: "기업의 서비스와 이용 방법을 소개합니다.",
          },
        },
        {
          ruleCode: "CONTENT-INITIAL-001",
          evidence: { textLength: 1200 },
        },
        {
          ruleCode: "STRUCT-H1-001",
          evidence: { h1: ["예제 사이트"] },
        },
        {
          ruleCode: "CONTENT-HEADINGS-001",
          evidence: { h2: ["서비스 소개", "이용 방법"] },
        },
        {
          ruleCode: "STRUCT-LINKS-001",
          evidence: {
            internal: 5,
            sample: ["/about", "/contact", "/faq"],
          },
        },
        {
          ruleCode: "STRUCT-JSONLD-TYPES-001",
          evidence: { types: ["Organization"] },
        },
      ],
    });

    expect(result.status).toBe("BASIC_READY");
    expect(result.confirmedSignals.join(" ")).toContain("Organization");
  });
});

describe("ecommerce content readiness", () => {
  it("쇼핑몰 후반부 안내에서 SaaS 전용 문구를 제거한다", () => {
    const result = buildContentReadinessAssessment({
      siteName: "호미가",
      siteType: null,
      findings: [
        {
          ruleCode: "CONTENT-CORE-DEFINITION-001",
          evidence: {
            siteArchetype: "ECOMMERCE",
            classificationConfidence: "HIGH",
          },
        },
        { ruleCode: "CONTENT-INITIAL-001", evidence: { textLength: 8528 } },
      ],
    });

    const text = JSON.stringify(result);
    expect(text).toContain("전자상거래·상품판매형");
    expect(text).toContain("상품 탐색");
    expect(text).toContain("상품 가격");
    expect(text).toContain("A/S");
    expect(text).not.toContain("가입, 생성, 배포");
    expect(text).not.toContain("지원 기능·입력·출력·플랫폼");
    expect(text).not.toContain("무료·유료 범위");
    expect(text).not.toContain("추가 비용를");
    expect(text).not.toContain("맞춤 제작 순서을");
    expect(text).not.toContain("지원 범위과");
    expect(text).not.toContain("사용자 자료 처리");
    expect(text).toContain("개인정보·주문·결제·배송정보 처리");
    expect(text).not.toContain("고객은 어떤 제품군과 옵션");
  });
});
