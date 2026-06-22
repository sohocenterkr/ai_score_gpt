import { describe, expect, it } from "vitest";
import {
  ANSWER_PERFORMANCE_METHODOLOGY_VERSION,
  calculateAnswerPerformance,
  type AnswerPerformanceRun,
} from "./answer-performance";

describe("AI answer performance scoring", () => {
  it("브랜드·인용·정확성·완전성·반복 일관성을 분리 계산한다", () => {
    const runs: AnswerPerformanceRun[] = [
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: true,
        factualAccuracy: 90,
        completeness: 80,
        consistencySignature: "brand-a",
      },
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: true,
        factualAccuracy: 90,
        completeness: 80,
        consistencySignature: "brand-a",
      },
      {
        questionCode: "DISCOVERY-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: false,
        factualAccuracy: 85,
        completeness: 80,
        consistencySignature: "discovery-a",
      },
      {
        questionCode: "DISCOVERY-01",
        status: "COMPLETED",
        brandMentioned: false,
        serviceIdentified: true,
        targetDomainCited: false,
        factualAccuracy: 85,
        completeness: 80,
        consistencySignature: "discovery-b",
      },
    ];

    expect(calculateAnswerPerformance(runs)).toEqual({
      methodologyVersion: ANSWER_PERFORMANCE_METHODOLOGY_VERSION,
      plannedQuestionCount: 2,
      completedQuestionCount: 2,
      totalRunCount: 4,
      completedRunCount: 4,
      partialRunCount: 0,
      failedRunCount: 0,
      answerCompletionRate: 100,
      brandMentionRate: 75,
      targetCitationRate: 50,
      factualAccuracy: 87.5,
      completeness: 80,
      consistency: 75,
      serviceIdentificationRate: 100,
      performanceScore: 72,
      scoreCoverage: 100,
    });
  });

  it("대상 서비스 식별 실패 시 브랜드명 문자열 언급 점수를 인정하지 않는다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: false,
        targetDomainCited: false,
        factualAccuracy: 20,
        completeness: 5,
      },
    ]);

    expect(summary).toMatchObject({
      brandMentionRate: 100,
      serviceIdentificationRate: 0,
      targetCitationRate: 0,
      factualAccuracy: null,
      completeness: null,
      performanceScore: 0,
      scoreCoverage: 45,
    });
  });

  it("대상 서비스 식별 성공 시 브랜드명 문자열 언급 점수를 정상 반영한다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: true,
        factualAccuracy: 100,
        completeness: 100,
      },
    ]);

    expect(summary.performanceScore).toBe(100);
  });

  it("기준정보를 전혀 설명하지 않은 답변은 정확도 100%로 인정하지 않는다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: false,
        targetDomainCited: false,
        factualAccuracy: 100,
        completeness: 0,
        supportedFactCount: 0,
        contradictedFactCount: 0,
      },
    ]);

    expect(summary).toMatchObject({
      brandMentionRate: 100,
      serviceIdentificationRate: 0,
      targetCitationRate: 0,
      factualAccuracy: null,
      completeness: null,
      performanceScore: 0,
      scoreCoverage: 45,
    });
  });

  it("완전성 0%인 답변은 다른 지표가 높아도 성과점수를 20점으로 제한한다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "FEATURE-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: true,
        factualAccuracy: 100,
        completeness: 0,
        supportedFactCount: 1,
        contradictedFactCount: 0,
      },
    ]);

    expect(summary.performanceScore).toBe(20);
  });

  it("실패·일부 완료 실행은 성과율의 분모에서 제외하고 별도 집계한다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: true,
        factualAccuracy: 100,
        completeness: 100,
      },
      {
        questionCode: "FEATURE-01",
        status: "FAILED",
        brandMentioned: null,
        targetDomainCited: null,
        factualAccuracy: null,
        completeness: null,
      },
      {
        questionCode: "TRUST-01",
        status: "PARTIAL",
        brandMentioned: null,
        targetDomainCited: null,
        factualAccuracy: null,
        completeness: null,
      },
    ]);

    expect(summary).toMatchObject({
      plannedQuestionCount: 3,
      completedQuestionCount: 1,
      completedRunCount: 1,
      partialRunCount: 1,
      failedRunCount: 1,
      answerCompletionRate: 33.3,
      brandMentionRate: 100,
      targetCitationRate: 100,
      factualAccuracy: 100,
      completeness: 100,
      consistency: null,
      performanceScore: 100,
      scoreCoverage: 90,
    });
  });

  it("사실 정확도와 답변 완전성 평가 전에는 종합 성과점수를 만들지 않는다", () => {
    const summary = calculateAnswerPerformance([
      {
        questionCode: "BRAND-01",
        status: "COMPLETED",
        brandMentioned: true,
        serviceIdentified: true,
        targetDomainCited: false,
        factualAccuracy: null,
        completeness: null,
      },
    ]);

    expect(summary).toMatchObject({
      brandMentionRate: 100,
      targetCitationRate: 0,
      factualAccuracy: null,
      completeness: null,
      consistency: null,
      performanceScore: null,
      scoreCoverage: 45,
    });
  });

  it("실행 결과가 없으면 모든 비율을 미측정으로 유지한다", () => {
    expect(calculateAnswerPerformance([])).toMatchObject({
      plannedQuestionCount: 0,
      completedQuestionCount: 0,
      totalRunCount: 0,
      completedRunCount: 0,
      partialRunCount: 0,
      failedRunCount: 0,
      answerCompletionRate: null,
      brandMentionRate: null,
      targetCitationRate: null,
      factualAccuracy: null,
      completeness: null,
      consistency: null,
      performanceScore: null,
      scoreCoverage: 0,
    });
  });
});
