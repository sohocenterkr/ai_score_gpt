import { describe, expect, it } from "vitest";
import { buildWorkOrderTemplate } from "./work-order-templates";

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
