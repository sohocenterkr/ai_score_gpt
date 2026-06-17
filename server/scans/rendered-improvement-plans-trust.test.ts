import { describe, expect, it } from "vitest";
import {
  buildRenderedDomImprovementPlans,
  type ScanResultRenderedDomComparison,
} from "./scan-result-pdf";

function comparison(): ScanResultRenderedDomComparison {
  return {
    status: "SUCCESS",
    browserVersion: "Chromium",
    durationMs: 100,
    pageErrorCount: 0,
    errorCode: null,
    message: null,
    metrics: {
      textLength: { initial: 800, rendered: 2_000 },
      internalLinks: { initial: 4, rendered: 10 },
      h1Count: { initial: 1, rendered: 2 },
      h2Count: { initial: 2, rendered: 2 },
      jsonLdValidCount: { initial: 1, rendered: 1 },
    },
    initialTitle: "예제",
    renderedTitle: "예제",
    initialDescription: "예제 설명",
    renderedDescription: "예제 설명",
    initialH1: ["예제"],
    renderedH1: ["예제", "두 번째 제목"],
    initialJsonLdTypes: ["WebSite"],
    renderedJsonLdTypes: ["WebSite"],
  };
}

describe("rendered improvement plan trust guidance", () => {
  it("본문 포함 비율과 H1 중복을 구체적으로 설명한다", () => {
    const plans = buildRenderedDomImprovementPlans(comparison());
    const contentPlan = plans.find(
      (plan) => plan.code === "RENDERED-ADDED-CONTENT",
    );
    const consistencyPlan = plans.find(
      (plan) =>
        plan.code === "RENDERED-INCONSISTENT-INFORMATION",
    );

    expect(contentPlan?.currentState).toContain("40.0%");
    expect(contentPlan?.developerInstructions.join(" ")).toContain(
      "75%",
    );
    expect(consistencyPlan?.currentState).toContain("H1이 2개");
    expect(consistencyPlan?.acceptanceCriteria.join(" ")).toContain(
      "정확히 1개",
    );
  });
});
