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
