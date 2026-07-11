import { describe, expect, it } from "vitest";
import {
  RULE_DEFINITIONS,
  SCORE_CATEGORIES,
  SUMMARY_GROUPS,
  calculateScore,
  getRuleSummaryGroup,
} from "./scoring";
import type { CollectedFindingStatus } from "./scan-engine";

function allFindings(status: CollectedFindingStatus = "PASS") {
  return RULE_DEFINITIONS.map((rule) => ({
    ruleCode: rule.ruleCode,
    status,
  }));
}

describe("scan scoring", () => {
  it("규칙 배점과 영역 배점 합계가 각각 100점이다", () => {
    expect(
      RULE_DEFINITIONS.reduce((sum, definition) => sum + definition.weight, 0),
    ).toBe(100);

    const summary = calculateScore(allFindings());
    expect(SCORE_CATEGORIES).toContain("AI 답변 준비 콘텐츠");
    expect(summary.categories).toHaveLength(SCORE_CATEGORIES.length);
    expect(
      summary.categories.reduce((sum, category) => sum + category.maxScore, 0),
    ).toBe(100);
  });

  it("모든 규칙의 공식 요약 그룹과 대표 규칙 매핑을 고정한다", () => {
    expect(
      [
        ...new Set(
          RULE_DEFINITIONS.map((definition) => definition.summaryGroup),
        ),
      ].sort(),
    ).toEqual([...SUMMARY_GROUPS].sort());

    const weightByGroup = Object.fromEntries(
      SUMMARY_GROUPS.map((group) => [
        group,
        RULE_DEFINITIONS.filter(
          (definition) => definition.summaryGroup === group,
        ).reduce((sum, definition) => sum + definition.weight, 0),
      ]),
    );

    expect(weightByGroup).toEqual({
      TECHNICAL: 37,
      CONTENT: 50,
      TRUST: 13,
    });
    expect(getRuleSummaryGroup("STRUCT-H1-001")).toBe("TECHNICAL");
    expect(getRuleSummaryGroup("CONTENT-HEADINGS-001")).toBe("TECHNICAL");
    expect(getRuleSummaryGroup("STRUCT-JSONLD-SAMEAS-001")).toBe("TRUST");
    expect(getRuleSummaryGroup("CONTENT-PRICING-TERMS-001")).toBe("CONTENT");
    expect(() => getRuleSummaryGroup("UNKNOWN-RULE")).toThrow(
      "Summary group is not defined for rule: UNKNOWN-RULE",
    );
  });

  it("모든 규칙 통과 시 자동진단 최고점 99점 A+를 반환한다", () => {
    const summary = calculateScore(allFindings());

    expect(summary).toMatchObject({
      score: 99,
      rawScore: 100,
      grade: "A+",
      cap: null,
      coverage: 100,
      lostPoints: 0,
    });
  });

  it("실패한 규칙의 배점만큼 감점한다", () => {
    const findings = allFindings();
    const canonical = findings.find(
      (finding) => finding.ruleCode === "META-CANONICAL-001",
    );

    if (!canonical) {
      throw new Error("canonical rule missing");
    }

    canonical.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.score).toBe(98);
    expect(summary.lostPoints).toBe(1);
    expect(summary.grade).toBe("A+");
  });

  it("해당 없음 규칙은 감점하지 않는다", () => {
    const findings = allFindings();
    const searchAction = findings.find(
      (finding) => finding.ruleCode === "STRUCT-JSONLD-SEARCHACTION-001",
    );

    if (!searchAction) {
      throw new Error("SearchAction rule missing");
    }

    searchAction.status = "NA";
    const summary = calculateScore(findings);

    expect(summary.score).toBe(99);
    expect(summary.lostPoints).toBe(0);
    expect(summary.grade).toBe("A+");
  });

  it("배점이 2점 이상인 실제 실패는 원점수를 추가로 이중 감점하지 않는다", () => {
    const findings = allFindings();
    const jsonLd = findings.find(
      (finding) => finding.ruleCode === "STRUCT-JSONLD-001",
    );

    if (!jsonLd) {
      throw new Error("JSON-LD rule missing");
    }

    jsonLd.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(97);
    expect(summary.score).toBe(97);
    expect(summary.lostPoints).toBe(2);
  });

  it("전체 noindex는 30점 상한을 적용한다", () => {
    const findings = allFindings();
    const indexability = findings.find(
      (finding) => finding.ruleCode === "ACCESS-INDEXABILITY-001",
    );

    if (!indexability) {
      throw new Error("indexability rule missing");
    }

    indexability.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(97);
    expect(summary.score).toBe(30);
    expect(summary.grade).toBe("E");
    expect(summary.cap).toBe(30);
  });

  it("OAI 검색봇 실제 요청 실패는 점수 상한을 적용하지 않는다", () => {
    const findings = allFindings();
    const searchBot = findings.find(
      (finding) => finding.ruleCode === "ACCESS-OAI-SEARCHBOT-001",
    );

    if (!searchBot) {
      throw new Error("search bot rule missing");
    }

    searchBot.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(100);
    expect(summary.score).toBe(99);
    expect(summary.lostPoints).toBe(0);
    expect(summary.grade).toBe("A+");
    expect(summary.cap).toBe(null);
  });

  it("콘텐츠 근거 수준의 비율에 따라 부분 점수를 계산한다", () => {
    const findings = allFindings().map((finding) =>
      finding.ruleCode === "CONTENT-CORE-DEFINITION-001"
        ? {
            ...finding,
            status: "FAIL" as const,
            evidence: {
              scoreRatio: 0.7,
            },
          }
        : finding,
    );

    const summary = calculateScore(findings);
    const contentCategory = summary.categories.find(
      (category) => category.category === "AI 답변 준비 콘텐츠",
    );

    expect(summary.rawScore).toBe(97.6);
    expect(summary.score).toBe(98);
    expect(summary.pendingScore).toBe(0);
    expect(summary.scoreRangeMin).toBe(98);
    expect(summary.scoreRangeMax).toBe(98);
    expect(contentCategory?.score).toBe(47.6);
    expect(contentCategory?.pendingScore).toBe(0);
  });

  it("콘텐츠 확인 불가는 감점 대신 보류 점수와 가능 범위를 반환한다", () => {
    const findings = allFindings().map((finding) =>
      finding.ruleCode === "CONTENT-CORE-DEFINITION-001"
        ? {
            ...finding,
            status: "BLOCKED" as const,
            evidence: {
              contentEvidenceLevel: "UNAVAILABLE",
              scoreRatio: null,
            },
          }
        : finding,
    );

    const summary = calculateScore(findings);
    const contentCategory = summary.categories.find(
      (category) => category.category === "AI 답변 준비 콘텐츠",
    );

    expect(summary.rawScore).toBe(92);
    expect(summary.pendingScore).toBe(8);
    expect(summary.score).toBe(92);
    expect(summary.scoreRangeMin).toBe(92);
    expect(summary.scoreRangeMax).toBe(99);
    expect(summary.coverage).toBe(92);
    expect(summary.lostPoints).toBe(0);
    expect(contentCategory?.score).toBe(42);
    expect(contentCategory?.pendingScore).toBe(8);
  });

  it("기술 항목의 확인 불가는 기존처럼 실패 점수로 계산한다", () => {
    const findings = allFindings().map((finding) =>
      finding.ruleCode === "META-TITLE-001"
        ? {
            ...finding,
            status: "BLOCKED" as const,
          }
        : finding,
    );

    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(98);
    expect(summary.pendingScore).toBe(0);
    expect(summary.scoreRangeMin).toBe(98);
    expect(summary.scoreRangeMax).toBe(98);
    expect(summary.coverage).toBe(100);
  });
});
