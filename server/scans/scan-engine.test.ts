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
