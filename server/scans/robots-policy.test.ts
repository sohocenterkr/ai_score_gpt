import { describe, expect, it, vi } from "vitest";
import { collectSiteScan } from "./scan-engine";
import type {
  SafeHttpFetcher,
  SafeHttpResponse,
} from "./http-fetcher";
import {
  evaluateRobotsPolicy,
  parseRobotsPolicy,
} from "./robots-policy";


function response(
  url: string,
  body: string,
  contentType = "text/html; charset=utf-8",
): SafeHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    statusCode: 200,
    headers: { "content-type": contentType },
    contentType,
    body: Buffer.from(body),
    redirects: [],
  };
}

function findingStatus(
  result: Awaited<ReturnType<typeof collectSiteScan>>,
  ruleCode: string,
) {
  return result.findings.find(
    (finding) => finding.ruleCode === ruleCode,
  )?.status;
}

describe("robots policy", () => {
  it("sitemap 선언과 여러 user-agent 그룹을 분리한다", () => {
    const policy = parseRobotsPolicy(`
      Sitemap: https://example.com/sitemap-index.xml
      User-agent: OAI-SearchBot
      Allow: /
      User-agent: GPTBot
      Disallow: /
    `);

    expect(policy.sitemaps).toEqual([
      "https://example.com/sitemap-index.xml",
    ]);
    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/page"),
    ).toBe("ALLOWED");
    expect(evaluateRobotsPolicy(policy, "GPTBot", "/page")).toBe(
      "BLOCKED",
    );
  });

  it("구체적인 user-agent 규칙을 와일드카드보다 우선한다", () => {
    const policy = parseRobotsPolicy(`
      User-agent: *
      Disallow: /
      User-agent: OAI-SearchBot
      Allow: /
    `);

    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/kr"),
    ).toBe("ALLOWED");
    expect(evaluateRobotsPolicy(policy, "OtherBot", "/kr")).toBe(
      "BLOCKED",
    );
  });

  it("가장 긴 경로 규칙을 사용하고 동률이면 allow를 우선한다", () => {
    const policy = parseRobotsPolicy(`
      User-agent: *
      Disallow: /private
      Allow: /private/public
      Disallow: /same
      Allow: /same
    `);

    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/private/a"),
    ).toBe("BLOCKED");
    expect(
      evaluateRobotsPolicy(
        policy,
        "OAI-SearchBot",
        "/private/public/a",
      ),
    ).toBe("ALLOWED");
    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/same"),
    ).toBe("ALLOWED");
  });

  it("빈 disallow는 차단 규칙으로 취급하지 않는다", () => {
    const policy = parseRobotsPolicy(`
      User-agent: *
      Disallow:
    `);

    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/"),
    ).toBe("UNSPECIFIED");
  });

  it("일치하는 그룹이 없으면 미지정 상태를 반환한다", () => {
    const policy = parseRobotsPolicy(`
      User-agent: ExampleBot
      Disallow: /
    `);

    expect(
      evaluateRobotsPolicy(policy, "OAI-SearchBot", "/"),
    ).toBe("UNSPECIFIED");
  });

  it("ChatGPT-User는 robots 차단보다 실제 사용자 요청 접근을 판정한다", async () => {
    const seenUserAgents: string[] = [];
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url, options) => {
        if (options?.userAgent) {
          seenUserAgents.push(options.userAgent);
        }

        if (url.endsWith("/robots.txt")) {
          return response(
            url,
            "User-agent: ChatGPT-User\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /",
            "text/plain",
          );
        }

        if (url.endsWith("/sitemap.xml")) {
          return response(url, "<urlset></urlset>", "application/xml");
        }

        return response(
          url,
          '<html lang="ko"><head><title>예제</title></head><body><h1>예제</h1>' +
            "본문 ".repeat(300) +
            '<a href="/about">소개</a></body></html>',
        );
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
    );

    expect(
      findingStatus(result, "ACCESS-CHATGPT-USER-001"),
    ).toBe("PASS");
    expect(
      seenUserAgents.some((value) =>
        value.includes("compatible; ChatGPT-User/1.0"),
      ),
    ).toBe(true);
  });

  it("OAI-SearchBot은 robots 정책과 실제 접근을 함께 판정한다", async () => {
    const seenUserAgents: string[] = [];
    const fetcher: SafeHttpFetcher = {
      fetch: vi.fn(async (url, options) => {
        if (options?.userAgent) {
          seenUserAgents.push(options.userAgent);
        }

        if (url.endsWith("/robots.txt")) {
          return response(
            url,
            "User-agent: OAI-SearchBot\nDisallow: /",
            "text/plain",
          );
        }

        if (url.endsWith("/sitemap.xml")) {
          return response(url, "<urlset></urlset>", "application/xml");
        }

        return response(
          url,
          '<html lang="ko"><head><title>예제</title></head><body><h1>예제</h1>' +
            "본문 ".repeat(300) +
            '<a href="/about">소개</a></body></html>',
        );
      }),
    };

    const result = await collectSiteScan(
      "https://example.com/",
      fetcher,
    );

    expect(
      findingStatus(result, "ACCESS-OAI-SEARCHBOT-001"),
    ).toBe("FAIL");
    expect(
      seenUserAgents.some((value) =>
        value.includes("compatible; OAI-SearchBot/1.3"),
      ),
    ).toBe(true);
  });
});
