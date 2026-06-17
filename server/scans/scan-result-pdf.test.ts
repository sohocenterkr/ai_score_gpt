import { describe, expect, it } from "vitest";
import {
  buildRenderedDomImprovementPlans,
  renderScanResultPdf,
  sanitizeEvidenceValue,
  scanResultPdfFilename,
  scanResultPdfFontHash,
  scanResultRenderedDomComparison,
  SCAN_RESULT_PDF_RENDERER_VERSION,
} from "./scan-result-pdf";
import type { PublicScanResult } from "./scan-result-service";

const sampleResult: PublicScanResult = {
  site: {
    id: "site-1",
    name: "예제 사이트",
    baseUrl: "https://example.com/",
    finalUrl: "https://example.com/ko",
    siteType: "기업 홈페이지",
    country: "KR",
    region: "서울",
    primaryLocale: "ko",
  },
  scan: {
    id: "scan-1",
    type: "QUICK",
    status: "COMPLETED",
    rulesVersion: "2026.06-core-v2",
    score: 77,
    grade: "B",
    startedAt: "2026-06-15T00:00:00.000Z",
    completedAt: "2026-06-15T00:00:04.000Z",
    errorCode: null,
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  scoreSummary: {
    score: 77,
    rawScore: 77,
    grade: "B",
    cap: null,
    coverage: 100,
    lostPoints: 23,
    expectedImprovementMin: 12,
    expectedImprovementMax: 23,
    categories: [
      {
        category: "접근 및 수집 정책",
        score: 12,
        maxScore: 15,
        percentage: 80,
      },
      {
        category: "핵심정보 인식 정확도",
        score: 8,
        maxScore: 20,
        percentage: 40,
      },
    ],
  },
  contentReadiness: {
    status: "PARTIAL",
    label: "일부 보완 필요",
    summary: "예제 사이트의 콘텐츠 일부를 확인했습니다.",
    confirmedSignals: [
      "초기 HTML 본문: 1,200자",
      "문서 제목: 예제 사이트",
    ],
    topics: [
      {
        code: "CONTENT-TOPIC-SERVICE-DEFINITION",
        title: "서비스 정의와 핵심 가치",
        status: "PARTIAL",
        reason: "서비스 개요 일부를 확인했습니다.",
        questions: ["예제 사이트는 무엇인가요?"],
        suggestedSections: ["예제 사이트란?"],
        contentWriterInstruction:
          "실제 제공 사실만 사용해 작성하세요.",
        developerInstruction:
          "사용자 화면과 초기 HTML에 함께 제공하세요.",
        acceptanceCriteria: [
          "서비스 정의를 페이지 내용으로 설명할 수 있다.",
        ],
      },
    ],
    benchmarkNote:
      "800자는 Site AI Score 내부 참고 기준입니다.",
    disclaimer:
      "운영자가 사실관계를 확인해야 합니다.",
  },
  understandingSummary:
    '"예제 사이트" 페이지는 ko 문서로 확인되었고 초기 HTML에서 약 1,200자의 본문을 읽었습니다.',
  foundInformation: [
    {
      label: "문서 제목",
      value: "예제 사이트",
    },
    {
      label: "최종 URL",
      value: "https://example.com/ko",
    },
  ],
  missingInformation: [
    {
      ruleCode: "STRUCT-JSONLD-001",
      title: "JSON-LD 구조화 데이터",
    },
  ],
  primaryIssues: [
    {
      id: "finding-1",
      ruleCode: "STRUCT-JSONLD-001",
      category: "핵심정보 인식 정확도",
      severity: "MEDIUM",
      status: "FAIL",
      title: "JSON-LD 구조화 데이터",
      description:
        "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.",
      evidence: {
        validCount: 0,
        invalidCount: 0,
        headers: {
          "set-cookie": "sensitive-cookie",
        },
      },
      recommendation:
        "사이트에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.",
      scoreDelta: -12,
      weight: 12,
    },
  ],
  pages: [
    {
      id: "page-1",
      url: "https://example.com/",
      statusCode: 200,
      finalUrl: "https://example.com/ko",
      contentType: "text/html; charset=utf-8",
      rawHtmlHash: "abc123",
      initialTextLength: 1_200,
      iframeCount: 0,
    },
  ],
  findings: [
    {
      id: "finding-1",
      ruleCode: "STRUCT-JSONLD-001",
      category: "핵심정보 인식 정확도",
      severity: "MEDIUM",
      status: "FAIL",
      title: "JSON-LD 구조화 데이터",
      description:
        "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.",
      evidence: {
        validCount: 0,
        invalidCount: 0,
      },
      recommendation:
        "사이트에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.",
      scoreDelta: -12,
      weight: 12,
    },
    {
      id: "finding-2",
      ruleCode: "ACCESS-HTTP-001",
      category: "접근 및 수집 정책",
      severity: "INFO",
      status: "PASS",
      title: "HTTP 접근",
      description: "공개 URL이 정상 응답했습니다.",
      evidence: {
        statusCode: 200,
      },
      recommendation: null,
      scoreDelta: 0,
      weight: 6,
    },
    {
      id: "finding-3",
      ruleCode: "ENV-MEASUREMENT-001",
      category: "최신성 및 측정 환경",
      severity: "INFO",
      status: "PASS",
      title: "실제 공개 URL 측정 환경",
      description:
        "초기 HTML과 JavaScript 실행 후 DOM을 함께 비교했습니다.",
      evidence: {
        rulesScope:
          "QUICK_INITIAL_HTML_WITH_RENDERED_DOM_EVIDENCE",
        renderedDom: {
          status: "SUCCESS",
          browserVersion: "Chromium 92.0.4515.159",
          durationMs: 12_340,
          pageErrorCount: 2,
          initialHtml: {
            textLength: 1_200,
            links: {
              internal: 12,
            },
            headings: {
              h1: ["예제 사이트"],
              h2Count: 1,
            },
            jsonLd: {
              validCount: 0,
            },
          },
          renderedDom: {
            textLength: 2_400,
            links: {
              internal: 28,
            },
            headings: {
              h1: ["예제 사이트"],
              h2Count: 4,
            },
            jsonLd: {
              validCount: 1,
            },
          },
        },
      },
      recommendation: null,
      scoreDelta: 0,
      weight: 5,
    },
  ],
};

describe("scan result PDF", () => {
  it(
    "한글 진단 보고서를 유효한 PDF로 생성한다",
    async () => {
      const result = await renderScanResultPdf(sampleResult);
      const source = result.toString("latin1");
      const pageCount =
        source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;

      expect(result.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(result.length).toBeGreaterThan(10_000);
      expect(pageCount).toBeGreaterThanOrEqual(8);
    },
    45_000,
  );

  it("렌더링 DOM 비교 증거를 구조화한다", () => {
    const comparison =
      scanResultRenderedDomComparison(sampleResult);

    expect(comparison).toMatchObject({
      status: "SUCCESS",
      browserVersion: "Chromium 92.0.4515.159",
      durationMs: 12_340,
      metrics: {
        textLength: {
          initial: 1_200,
          rendered: 2_400,
        },
        internalLinks: {
          initial: 12,
          rendered: 28,
        },
        jsonLdValidCount: {
          initial: 0,
          rendered: 1,
        },
      },
    });
    const plans = buildRenderedDomImprovementPlans(comparison);

    expect(plans[0]).toMatchObject({
      code: "RENDERED-ADDED-CONTENT",
      title:
        "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
    });
    expect(plans[0]?.developerInstructions[0]).toContain(
      "초기 HTML",
    );
    expect(plans[0]?.acceptanceCriteria).toHaveLength(4);
    expect(SCAN_RESULT_PDF_RENDERER_VERSION).toBe(
      "2026.06-scan-report-v10",
    );
  });

  it("안전한 진단 보고서 파일명을 만든다", () => {
    expect(scanResultPdfFilename(sampleResult)).toBe(
      "site-ai-score-scan-1.pdf",
    );
  });

  it("객체 키와 문자열 안의 인증정보를 숨긴다", () => {
    const sanitized = sanitizeEvidenceValue({
      authorization: "Bearer key-secret-value",
      note: "Authorization: Bearer inline-secret-value",
      cookieLine: "Cookie: session=very-secret-cookie",
      url: "https://example.com/?token=query-secret-value",
      safe: "status=200",
    });
    const text = JSON.stringify(sanitized);

    expect(text).not.toContain("key-secret-value");
    expect(text).not.toContain("inline-secret-value");
    expect(text).not.toContain("very-secret-cookie");
    expect(text).not.toContain("query-secret-value");
    expect(text).toContain("[보안상 숨김]");
    expect(text).toContain("status=200");
  });

  it("사용 글꼴 SHA-256을 안정적으로 계산한다", () => {
    expect(scanResultPdfFontHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(scanResultPdfFontHash()).toBe(scanResultPdfFontHash());
  });
});
