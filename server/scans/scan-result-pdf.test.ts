import { describe, expect, it } from "vitest";
import {
  renderScanResultPdf,
  scanResultPdfFilename,
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
      expect(pageCount).toBeGreaterThanOrEqual(7);
    },
    45_000,
  );

  it("안전한 진단 보고서 파일명을 만든다", () => {
    expect(scanResultPdfFilename(sampleResult)).toBe(
      "site-ai-score-scan-1.pdf",
    );
  });
});
