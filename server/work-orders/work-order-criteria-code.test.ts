import { describe, expect, it } from "vitest";
import { buildWorkOrderTemplate } from "./work-order-templates";

describe("work order generic criterion codes", () => {
  it("긴 규칙 코드도 중간에서 자르지 않는다", () => {
    const template = buildWorkOrderTemplate({
      ruleCode: "CONTENT-ANSWERABILITY-001",
      title: "초기 콘텐츠 답변 기반",
      description: "본문이 부족합니다.",
      recommendation: "본문을 보강하세요.",
      severity: "MEDIUM",
    });

    expect(template.acceptanceCriteria[0]?.code).toBe(
      "CONTENT-ANSWERABILITY-001-01",
    );
    expect(template.acceptanceCriteria[1]?.code).toBe(
      "CONTENT-ANSWERABILITY-001-02",
    );
  });
});
