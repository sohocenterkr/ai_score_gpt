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
