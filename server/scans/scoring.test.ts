import { describe, expect, it } from "vitest";
import {
  RULE_DEFINITIONS,
  SCORE_CATEGORIES,
  calculateScore,
} from "./scoring";
import type { CollectedFindingStatus } from "./scan-engine";

function allFindings(
  status: CollectedFindingStatus = "PASS",
) {
  return RULE_DEFINITIONS.map((rule) => ({
    ruleCode: rule.ruleCode,
    status,
  }));
}

describe("scan scoring", () => {
  it("규칙 배점과 영역 배점 합계가 각각 100점이다", () => {
    expect(
      RULE_DEFINITIONS.reduce(
        (sum, definition) => sum + definition.weight,
        0,
      ),
    ).toBe(100);

    const summary = calculateScore(allFindings());
    expect(summary.categories).toHaveLength(
      SCORE_CATEGORIES.length,
    );
    expect(
      summary.categories.reduce(
        (sum, category) => sum + category.maxScore,
        0,
      ),
    ).toBe(100);
  });

  it("모든 규칙 통과 시 100점 A+를 반환한다", () => {
    const summary = calculateScore(allFindings());

    expect(summary).toMatchObject({
      score: 100,
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

    expect(summary.score).toBe(97);
    expect(summary.grade).toBe("A+");
  });

  it("전체 noindex는 30점 상한을 적용한다", () => {
    const findings = allFindings();
    const indexability = findings.find(
      (finding) =>
        finding.ruleCode === "ACCESS-INDEXABILITY-001",
    );

    if (!indexability) {
      throw new Error("indexability rule missing");
    }

    indexability.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(96);
    expect(summary.score).toBe(30);
    expect(summary.grade).toBe("E");
    expect(summary.cap).toBe(30);
  });

  it("OAI 검색봇 실제 요청 실패는 점수 상한을 적용하지 않는다", () => {
    const findings = allFindings();
    const searchBot = findings.find(
      (finding) =>
        finding.ruleCode === "ACCESS-OAI-SEARCHBOT-001",
    );

    if (!searchBot) {
      throw new Error("search bot rule missing");
    }

    searchBot.status = "FAIL";
    const summary = calculateScore(findings);

    expect(summary.rawScore).toBe(100);
    expect(summary.score).toBe(100);
    expect(summary.grade).toBe("A+");
    expect(summary.cap).toBe(null);
  });
});
