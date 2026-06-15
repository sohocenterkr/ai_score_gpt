import { describe, expect, it } from "vitest";
import { analyzeHtml } from "./html-analyzer";

describe("HTML analyzer", () => {
  it("메타데이터·제목·링크·JSON-LD·iframe을 추출한다", () => {
    const result = analyzeHtml(
      Buffer.from(`
        <!doctype html>
        <html lang="ko">
          <head>
            <title> 테스트 페이지 </title>
            <meta name="description" content="페이지 설명">
            <meta name="robots" content="index,follow">
            <meta property="og:title" content="OG 제목">
            <link rel="canonical" href="/canonical">
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"WebSite"}
            </script>
          </head>
          <body>
            <h1>대표 제목</h1>
            <h2>하위 제목</h2>
            <a href="/inside">내부</a>
            <a href="https://outside.example/path">외부</a>
            <iframe src="https://frame.example"></iframe>
            본문 내용입니다.
          </body>
        </html>
      `),
      "https://example.com/page",
    );

    expect(result.title).toBe("테스트 페이지");
    expect(result.metaDescription).toBe("페이지 설명");
    expect(result.canonicalUrl).toBe(
      "https://example.com/canonical",
    );
    expect(result.htmlLang).toBe("ko");
    expect(result.headings.h1).toEqual(["대표 제목"]);
    expect(result.links).toMatchObject({
      total: 2,
      internal: 1,
      external: 1,
    });
    expect(result.jsonLd).toMatchObject({
      scriptCount: 1,
      validCount: 1,
      invalidCount: 0,
      types: ["WebSite"],
    });
    expect(result.iframeCount).toBe(1);
    expect(result.rawHtmlHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("잘못된 JSON-LD를 오류 증거로 기록한다", () => {
    const result = analyzeHtml(
      Buffer.from(`
        <html><body>
          <script type="application/ld+json">{invalid}</script>
        </body></html>
      `),
      "https://example.com/",
    );

    expect(result.jsonLd.validCount).toBe(0);
    expect(result.jsonLd.invalidCount).toBe(1);
    expect(result.jsonLd.errors).toHaveLength(1);
  });

  it("스크립트와 스타일 텍스트를 본문 길이에서 제외한다", () => {
    const result = analyzeHtml(
      Buffer.from(`
        <html>
          <head><style>hidden style words</style></head>
          <body>
            실제 본문
            <script>hidden script words</script>
          </body>
        </html>
      `),
      "https://example.com/",
    );

    expect(result.textLength).toBe("실제 본문".length);
  });
});
