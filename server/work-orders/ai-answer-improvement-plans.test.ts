import { describe, expect, it } from "vitest";
import { buildAiAnswerImprovementPlans } from "./ai-answer-improvement-plans";
import type {
  PublicDeepAnswerRun,
  PublicDeepAnswerSummary,
} from "../deep-diagnostics/deep-diagnostic-admin-service";

function summary(
  overrides: Partial<PublicDeepAnswerSummary> = {},
): PublicDeepAnswerSummary {
  return {
    provider: "OPENAI",
    model: "gpt-5.4-mini",
    methodologyVersion: "2026.06-ai-answer-v4",
    plannedQuestionCount: 1,
    completedQuestionCount: 1,
    totalRunCount: 1,
    completedRunCount: 1,
    partialRunCount: 0,
    failedRunCount: 0,
    answerCompletionRate: 100,
    brandMentionRate: 100,
    targetCitationRate: 100,
    factualAccuracy: 100,
    completeness: 100,
    consistency: 100,
    performanceScore: 100,
    scoreCoverage: 100,
    serviceIdentificationRate: 100,
    ...overrides,
  };
}

function run(overrides: Partial<PublicDeepAnswerRun> = {}): PublicDeepAnswerRun {
  return {
    id: "run-1",
    questionCode: "BRAND-01",
    questionKind: "BRAND",
    questionText: "테스트 서비스는 무엇인가요?",
    runNumber: 1,
    status: "COMPLETED",
    answerText: "테스트 서비스에 대한 답변입니다.",
    brandMentioned: true,
    targetDomainCited: true,
    citations: [],
    sources: [],
    factualEvaluation: null,
    expectedFactKeys: [],
    expectedFactCount: 0,
    serviceIdentified: true,
    inputTokens: 100,
    outputTokens: 100,
    errorCode: null,
    errorMessage: null,
    completedAt: "2026-06-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildAiAnswerImprovementPlans", () => {
  it("모든 지표가 좋으면 개선안을 만들지 않는다", () => {
    const plans = buildAiAnswerImprovementPlans(summary(), [run()]);
    expect(plans).toHaveLength(0);
  });

  it("서비스 식별률이 낮으면 AI-SERVICE-IDENTIFICATION 개선안을 만든다", () => {
    const plans = buildAiAnswerImprovementPlans(
      summary({ serviceIdentificationRate: 50 }),
      [run()],
    );
    const plan = plans.find((item) => item.code === "AI-SERVICE-IDENTIFICATION");

    expect(plan).toBeDefined();
    expect(plan?.currentState).toContain("50%");
  });

  it("공식 사이트 인용률이 낮으면 AI-DOMAIN-CITATION 개선안을 만든다", () => {
    const plans = buildAiAnswerImprovementPlans(
      summary({ targetCitationRate: 20 }),
      [run()],
    );
    const plan = plans.find((item) => item.code === "AI-DOMAIN-CITATION");

    expect(plan).toBeDefined();
    expect(plan?.currentState).toContain("20%");
  });

  it("사실 불일치가 있으면 AI-FACT-CORRECTION에 항목명을 포함한다", () => {
    const plans = buildAiAnswerImprovementPlans(summary(), [
      run({
        factualEvaluation: {
          summary: "일부 불일치",
          factualAccuracy: 50,
          completeness: 100,
          factResults: [
            {
              factKey: "pricing",
              label: "가격·요금·구매 조건",
              status: "CONTRADICTED",
              reason: "무료라고 잘못 설명함",
              expectedValue: "유료",
            },
          ],
        },
      }),
    ]);
    const plan = plans.find((item) => item.code === "AI-FACT-CORRECTION");

    expect(plan).toBeDefined();
    expect(plan?.currentState).toContain("가격·요금·구매 조건");
  });

  it("빠진 핵심 정보가 있으면 AI-MISSING-CORE-INFO에 항목명을 포함한다", () => {
    const plans = buildAiAnswerImprovementPlans(summary(), [
      run({
        factualEvaluation: {
          summary: "일부 누락",
          factualAccuracy: 100,
          completeness: 50,
          factResults: [
            {
              factKey: "contact",
              label: "문의 방법",
              status: "NOT_MENTIONED",
              reason: "문의 방법이 언급되지 않음",
              expectedValue: "support@example.com",
            },
          ],
        },
      }),
    ]);
    const plan = plans.find((item) => item.code === "AI-MISSING-CORE-INFO");

    expect(plan).toBeDefined();
    expect(plan?.currentState).toContain("문의 방법");
  });

  it("대상 서비스를 식별하지 못한 회차의 판정은 집계에서 제외한다", () => {
    const plans = buildAiAnswerImprovementPlans(summary(), [
      run({
        serviceIdentified: false,
        factualEvaluation: {
          summary: "다른 서비스로 오인",
          factualAccuracy: 0,
          completeness: 0,
          factResults: [
            {
              factKey: "pricing",
              label: "가격·요금·구매 조건",
              status: "CONTRADICTED",
              reason: "대상이 아닌 서비스 설명",
              expectedValue: "유료",
            },
          ],
        },
      }),
    ]);

    expect(plans.find((item) => item.code === "AI-FACT-CORRECTION")).toBeUndefined();
  });

  it("영어 로케일에서는 영어 문구를 만든다", () => {
    const plans = buildAiAnswerImprovementPlans(
      summary({ serviceIdentificationRate: 50 }),
      [run()],
      "en",
    );
    const plan = plans.find((item) => item.code === "AI-SERVICE-IDENTIFICATION");

    expect(plan?.title).toContain("brand");
    expect(plan?.currentState).toContain("ChatGPT");
  });
});
