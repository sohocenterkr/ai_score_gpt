import { describe, expect, it } from "vitest";
import { evaluateVerification } from "./verification-evaluator";

function item(
  overrides: Partial<{
    id: string;
    itemCode: string;
    isRequired: boolean;
    acceptanceCriteriaJson: unknown;
    finding: { ruleCode: string } | null;
  }> = {},
) {
  return {
    id: "item-1",
    itemCode: "CONTENT-INITIAL-001",
    isRequired: true,
    acceptanceCriteriaJson: [
      {
        code: "CONTENT-INITIAL-001-01",
        label: "연결된 규칙이 재검사에서 통과한다.",
        required: true,
      },
      {
        code: "CONTENT-INITIAL-001-02",
        label:
          "검사에서 사용한 대상 URL과 동일한 운영 URL에 반영되어 있다.",
        required: true,
      },
      {
        code: "CONTENT-INITIAL-001-03",
        label: "기존 정상 항목을 제거하거나 차단하는 회귀가 없다.",
        required: true,
      },
    ],
    finding: {
      ruleCode: "CONTENT-INITIAL-001",
    },
    ...overrides,
  };
}

describe("verification evaluator", () => {
  it("연결 규칙 통과와 회귀 없음이면 작업 항목을 통과시킨다", () => {
    const result = evaluateVerification({
      items: [item()],
      initialFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "FAIL",
          evidenceJson: { textLength: 7 },
        },
        {
          ruleCode: "ACCESS-HTTP-001",
          status: "PASS",
        },
      ],
      verificationFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "PASS",
          evidence: { textLength: 1_000 },
        },
        {
          ruleCode: "ACCESS-HTTP-001",
          status: "PASS",
        },
      ],
      submittedUrl: "https://example.com/ko",
      scanTargetUrl: "https://example.com/ko",
    });

    expect(result.status).toBe("PASSED");
    expect(result.itemResults[0]).toMatchObject({
      status: "PASS",
      nextItemStatus: "COMPLETED",
    });
    expect(result.itemResults[0]?.criteriaResults).toHaveLength(3);
  });

  it("연결 규칙이 계속 실패하면 재작업 필요로 판정한다", () => {
    const result = evaluateVerification({
      items: [item()],
      initialFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "FAIL",
        },
      ],
      verificationFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "FAIL",
        },
      ],
      submittedUrl: "https://example.com/ko",
      scanTargetUrl: "https://example.com/ko",
    });

    expect(result.status).toBe("REWORK_REQUIRED");
    expect(result.itemResults[0]?.status).toBe("FAIL");
    expect(result.itemResults[0]?.nextItemStatus).toBe(
      "REWORK_REQUIRED",
    );
  });

  it("초기 통과 가중 규칙의 회귀를 검출한다", () => {
    const result = evaluateVerification({
      items: [item()],
      initialFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "FAIL",
        },
        {
          ruleCode: "ACCESS-HTTP-001",
          status: "PASS",
        },
      ],
      verificationFindings: [
        {
          ruleCode: "CONTENT-INITIAL-001",
          status: "PASS",
        },
        {
          ruleCode: "ACCESS-HTTP-001",
          status: "FAIL",
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.status).toBe("REWORK_REQUIRED");
    expect(result.regressionRuleCodes).toContain(
      "ACCESS-HTTP-001",
    );
    expect(result.itemResults[0]?.status).toBe("FAIL");
  });

  it("렌더링 본문·링크 격차가 줄면 개선 항목을 통과시킨다", () => {
    const result = evaluateVerification({
      items: [
        item({
          itemCode: "RENDERED-ADDED-CONTENT",
          finding: null,
          isRequired: false,
          acceptanceCriteriaJson: [
            {
              code: "RENDERED-ADDED-CONTENT-01",
              label:
                "초기 HTML과 렌더링 DOM의 본문·링크 격차가 줄어든다.",
              required: true,
            },
          ],
        }),
      ],
      initialFindings: [],
      verificationFindings: [
        {
          ruleCode: "ENV-MEASUREMENT-001",
          status: "PASS",
          evidence: {
            renderedDom: {
              status: "SUCCESS",
              initialHtml: {
                textLength: 1_000,
                links: { internal: 8 },
              },
              renderedDom: {
                textLength: 1_100,
                links: { internal: 10 },
              },
            },
          },
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.status).toBe("PASSED");
    expect(result.itemResults[0]?.status).toBe("PASS");
  });
});
