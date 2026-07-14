import { describe, expect, it, vi } from "vitest";
import {
  collectSiteScan,
  type CollectedFinding,
} from "./scan-engine";
import {
  HttpFetchError,
  type SafeHttpFetcher,
  type SafeHttpResponse,
} from "./http-fetcher";
import type {
  RenderedDomCollector,
  RenderedDomResult,
} from "./rendered-dom";

function response(
  url: string,
  statusCode: number,
  contentType: string,
  body: string,
): SafeHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    statusCode,
    headers: {
      "content-type": contentType,
    },
    contentType,
    body: Buffer.from(body),
    redirects: [],
  };
}

function findingByCode(
  findings: CollectedFinding[],
  ruleCode: string,
): CollectedFinding {
  const value = findings.find(
    (finding) => finding.ruleCode === ruleCode,
  );

  if (!value) {
    throw new Error(`finding not found: ${ruleCode}`);
  }

  return value;
}

function renderedSuccess(
  finalUrl = "https://example.com/",
): RenderedDomResult {
  return {
    status: "SUCCESS",
    browserVersion: "test-browser",
    durationMs: 123,
    statusCode: 200,
    finalUrl,
    allowedRequests: 5,
    blockedRequests: 2,
    pageErrorCount: 0,
    pageErrorNames: [],
    analysis: {
      rawHtmlHash:
        "a".repeat(64),
      bodyBytes: 2_000,
      textLength: 1_500,
      title: "렌더링 제목",
      metaDescription: "렌더링 설명",
      canonicalUrl: finalUrl,
      robotsMeta: null,
      htmlLang: "ko",
      openGraph: {
        title: "렌더링 OG",
        description: "렌더링 OG 설명",
        image: null,
      },
      headings: {
        h1: ["렌더링 H1"],
        h2: ["렌더링 H2"],
        h3Count: 0,
      },
      links: {
        total: 10,
        internal: 8,
        external: 2,
        sample: [],
      },
      jsonLd: {
        scriptCount: 1,
        validCount: 1,
        invalidCount: 0,
        types: ["WebSite"],
        errors: [],
        sameAsCount: 0,
        contactPointCount: 0,
        hasSearchAction: false,
        hasEntityContact: false,
      },
      iframeCount: 0,
      hasPaymentModule: false,
      contentSignals: {
        conversionIntent: "INFORMATIONAL",
        detectedSignals: [],
        missingSignals: [],
        hasServiceDefinition: true,
        hasAudienceOrUseCase: true,
        hasWorkflowOrOutcome: true,
        hasPricingOrTerms: true,
        hasSupportOrContact: true,
        hasDataPolicy: true,
        hasDifferentiationOrProof: true,
        hasTransactionPolicy: false,
      },
    },
  };
}

describe("HTTP scan engine", () => {
  it("HTML 대표 페이지와 robots·sitemap 증거를 수집한다", async () => {
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url) => {
        if (url.endsWith("/robots.txt")) {
          return response(
            url,
            200,
            "text/plain",
            "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml",
          );
        }

        if (url.endsWith("/sitemap.xml")) {
          return response(
            url,
            200,
            "application/xml",
            "<urlset></urlset>",
          );
        }

        return response(
          url,
          200,
          "text/html; charset=utf-8",
          `
            <html lang="ko">
              <head>
                <title>예제 사이트</title>
                <meta name="description" content="예제 설명">
                <link rel="canonical" href="/">
                <script type="application/ld+json">
                  {"@context":"https://schema.org","@type":"WebSite"}
                </script>
              </head>
              <body>
                <h1>예제 사이트</h1>
                ${"본문 ".repeat(100)}
              </body>
            </html>
          `,
        );
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.page.statusCode).toBe(200);
    expect(result.page.rawHtmlHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      findingByCode(result.findings, "META-TITLE-001").status,
    ).toBe("PASS");
    expect(
      findingByCode(
        result.findings,
        "STRUCT-JSONLD-001",
      ).status,
    ).toBe("PASS");
    expect(
      findingByCode(
        result.findings,
        "ACCESS-ROBOTS-001",
      ).status,
    ).toBe("PASS");
  });

  it("누락된 메타데이터를 실패 finding으로 만든다", async () => {
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url) => {
        if (
          url.endsWith("/robots.txt") ||
          url.endsWith("/sitemap.xml")
        ) {
          return response(url, 404, "text/plain", "");
        }

        return response(
          url,
          200,
          "text/html",
          "<html><body>짧은 본문</body></html>",
        );
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
    );

    expect(
      findingByCode(result.findings, "META-TITLE-001").status,
    ).toBe("FAIL");
    expect(
      findingByCode(result.findings, "STRUCT-H1-001").status,
    ).toBe("FAIL");
    expect(
      findingByCode(
        result.findings,
        "ACCESS-SITEMAP-001",
      ).status,
    ).toBe("FAIL");
  });

  it("렌더링 DOM 비교 증거를 점수 항목 수 변경 없이 기록한다", async () => {
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url) => {
        if (
          url.endsWith("/robots.txt") ||
          url.endsWith("/sitemap.xml")
        ) {
          return response(url, 404, "text/plain", "");
        }

        return response(
          url,
          200,
          "text/html",
          `<html lang="ko"><head><title>초기 제목</title></head><body><h1>초기 H1</h1>${"본문 ".repeat(100)}</body></html>`,
        );
      }),
    };
    const renderedDomCollector: RenderedDomCollector = {
      collect: vi.fn().mockResolvedValue(renderedSuccess()),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
      { renderedDomCollector },
    );
    const environment = findingByCode(
      result.findings,
      "ENV-MEASUREMENT-001",
    );

    expect(result.findings).toHaveLength(38);
    expect(environment.status).toBe("PASS");
    expect(environment.evidence).toMatchObject({
      rulesScope:
        "QUICK_INITIAL_HTML_WITH_RENDERED_DOM_EVIDENCE",
      renderedDom: {
        status: "SUCCESS",
        comparison: {
          textLengthDelta: expect.any(Number),
          jsonLdValidCountDelta: 1,
        },
      },
    });
  });

  it("렌더링 실패가 QUICK 검사 완료를 막지 않는다", async () => {
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url) => {
        if (
          url.endsWith("/robots.txt") ||
          url.endsWith("/sitemap.xml")
        ) {
          return response(url, 404, "text/plain", "");
        }

        return response(
          url,
          200,
          "text/html",
          `<html><body><h1>예제</h1>${"본문 ".repeat(100)}</body></html>`,
        );
      }),
    };
    const renderedDomCollector: RenderedDomCollector = {
      collect: vi.fn().mockResolvedValue({
        status: "FAILED",
        errorCode: "RENDERED_DOM_TIMEOUT",
        message: "렌더링 제한 시간을 초과했습니다.",
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
      { renderedDomCollector },
    );
    const environment = findingByCode(
      result.findings,
      "ENV-MEASUREMENT-001",
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.findings).toHaveLength(38);
    expect(environment.evidence).toMatchObject({
      rulesScope: "QUICK_INITIAL_HTML",
      renderedDom: {
        status: "FAILED",
        errorCode: "RENDERED_DOM_TIMEOUT",
      },
    });
  });

  it("비HTML 대표 응답은 PARTIAL로 기록한다", async () => {
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url) => {
        if (
          url.endsWith("/robots.txt") ||
          url.endsWith("/sitemap.xml")
        ) {
          throw new HttpFetchError(
            "HTTP_REQUEST_FAILED",
            "연결 실패",
          );
        }

        return response(
          url,
          200,
          "application/json",
          '{"ok":true}',
        );
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/api",
      fetcher,
    );

    expect(result.status).toBe("PARTIAL");
    expect(result.page.rawHtmlHash).toBeNull();
    expect(
      findingByCode(result.findings, "CONTENT-HTML-001")
        .status,
    ).toBe("FAIL");
    expect(
      findingByCode(
        result.findings,
        "ACCESS-ROBOTS-001",
      ).status,
    ).toBe("BLOCKED");
  });
});
