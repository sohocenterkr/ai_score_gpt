import { describe, expect, it } from "vitest";
import { evaluateVerification } from "./verification-evaluator";

function renderedEvidence(input: {
  initialText: number;
  renderedText: number;
  initialLinks: number;
  renderedLinks: number;
  initialH1?: string[];
  renderedH1?: string[];
}) {
  return {
    renderedDom: {
      status: "SUCCESS",
      initialHtml: {
        textLength: input.initialText,
        title: "예제",
        metaDescription: "예제 설명",
        links: { internal: input.initialLinks },
        headings: { h1: input.initialH1 ?? ["예제"] },
        jsonLd: { types: ["WebSite"] },
      },
      renderedDom: {
        textLength: input.renderedText,
        title: "예제",
        metaDescription: "예제 설명",
        links: { internal: input.renderedLinks },
        headings: { h1: input.renderedH1 ?? ["예제"] },
        jsonLd: { types: ["WebSite"] },
      },
    },
  };
}

describe("verification evaluator trust rules", () => {
  it("디자인과 사용자 기능은 자동 통과시키지 않고 수동 확인으로 표시한다", () => {
    const result = evaluateVerification({
      items: [
        {
          id: "required",
          itemCode: "CONTENT-INITIAL-001",
          isRequired: true,
          acceptanceCriteriaJson: [],
          finding: { ruleCode: "CONTENT-INITIAL-001" },
        },
        {
          id: "rendered",
          itemCode: "RENDERED-ADDED-CONTENT",
          isRequired: false,
          acceptanceCriteriaJson: [
            {
              code: "JS-CONTENT-01",
              label:
                "초기 HTML 본문이 200자 이상이며 렌더링 DOM 본문의 75% 이상을 포함합니다.",
              required: true,
            },
            {
              code: "JS-CONTENT-03",
              label:
                "기존 화면 디자인과 주요 사용자 기능은 브라우저 스모크 테스트 또는 수동 확인으로 검증합니다.",
              required: true,
            },
          ],
          finding: null,
        },
      ],
      initialFindings: [
        { ruleCode: "CONTENT-INITIAL-001", status: "FAIL" },
      ],
      verificationFindings: [
        { ruleCode: "CONTENT-INITIAL-001", status: "PASS" },
        {
          ruleCode: "ENV-MEASUREMENT-001",
          status: "PASS",
          evidence: renderedEvidence({
            initialText: 900,
            renderedText: 1_000,
            initialLinks: 8,
            renderedLinks: 10,
          }),
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.status).toBe("PASSED");
    expect(result.itemResults[1]?.status).toBe("BLOCKED");
    expect(result.itemResults[1]?.nextItemStatus).toBe(
      "REVIEW_REQUIRED",
    );
    expect(result.itemResults[1]?.criteriaResults[1]).toMatchObject({
      status: "BLOCKED",
      automated: false,
    });
  });

  it("본문 포함 비율과 링크 차이가 기준을 충족하면 통과한다", () => {
    const result = evaluateVerification({
      items: [
        {
          id: "rendered",
          itemCode: "RENDERED-ADDED-CONTENT",
          isRequired: false,
          acceptanceCriteriaJson: [],
          finding: null,
        },
      ],
      initialFindings: [],
      verificationFindings: [
        {
          ruleCode: "ENV-MEASUREMENT-001",
          status: "PASS",
          evidence: renderedEvidence({
            initialText: 900,
            renderedText: 1_000,
            initialLinks: 8,
            renderedLinks: 10,
          }),
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.itemResults[0]?.status).toBe("PASS");
    expect(result.itemResults[0]?.evidence).toMatchObject({
      initialTextCoveragePercent: 90,
      initialLinkCoveragePercent: 80,
    });
  });

  it("초기 HTML이 800자여도 렌더링 본문의 40%뿐이면 실패한다", () => {
    const result = evaluateVerification({
      items: [
        {
          id: "rendered",
          itemCode: "RENDERED-ADDED-CONTENT",
          isRequired: false,
          acceptanceCriteriaJson: [],
          finding: null,
        },
      ],
      initialFindings: [],
      verificationFindings: [
        {
          ruleCode: "ENV-MEASUREMENT-001",
          status: "PASS",
          evidence: renderedEvidence({
            initialText: 800,
            renderedText: 2_000,
            initialLinks: 4,
            renderedLinks: 10,
          }),
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.itemResults[0]?.status).toBe("FAIL");
  });

  it("렌더링 DOM의 H1이 두 개면 핵심정보 일치 항목을 실패시킨다", () => {
    const result = evaluateVerification({
      items: [
        {
          id: "consistency",
          itemCode: "RENDERED-INCONSISTENT-INFORMATION",
          isRequired: false,
          acceptanceCriteriaJson: [],
          finding: null,
        },
      ],
      initialFindings: [],
      verificationFindings: [
        {
          ruleCode: "ENV-MEASUREMENT-001",
          status: "PASS",
          evidence: renderedEvidence({
            initialText: 900,
            renderedText: 1_000,
            initialLinks: 8,
            renderedLinks: 8,
            initialH1: ["예제"],
            renderedH1: ["예제", "두 번째 제목"],
          }),
        },
      ],
      submittedUrl: "https://example.com/",
      scanTargetUrl: "https://example.com/",
    });

    expect(result.itemResults[0]?.status).toBe("FAIL");
    expect(result.itemResults[0]?.evidence).toMatchObject({
      matchingFields: { singleRenderedH1: false },
    });
  });
});
