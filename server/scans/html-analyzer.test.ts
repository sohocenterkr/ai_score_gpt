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
    expect(result.canonicalUrl).toBe("https://example.com/canonical");
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
      sameAsCount: 0,
      contactPointCount: 0,
      hasSearchAction: false,
      hasEntityContact: false,
    });
    expect(result.iframeCount).toBe(1);
    expect(result.rawHtmlHash).toMatch(/^[a-f0-9]{64}$/);
  });



  it("JSON-LD 신뢰 신호를 추출한다", () => {
    const result = analyzeHtml(
      Buffer.from(`
        <html><head>
          <script type="application/ld+json">
            {
              "@context":"https://schema.org",
              "@graph":[
                {
                  "@type":"Organization",
                  "name":"Example Inc.",
                  "url":"https://example.com/",
                  "sameAs":["https://www.linkedin.com/company/example"],
                  "contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"help@example.com"}
                },
                {
                  "@type":"WebSite",
                  "name":"Example",
                  "url":"https://example.com/",
                  "potentialAction":{"@type":"SearchAction","target":"https://example.com/search?q={search_term_string}"}
                }
              ]
            }
          </script>
        </head><body>본문</body></html>
      `),
      "https://example.com/",
    );

    expect(result.jsonLd.sameAsCount).toBe(1);
    expect(result.jsonLd.contactPointCount).toBe(1);
    expect(result.jsonLd.hasSearchAction).toBe(true);
    expect(result.jsonLd.hasEntityContact).toBe(true);
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

import {
  describe as describeContentSignals,
  expect as expectContentSignals,
  it as itContentSignals,
} from "vitest";
import { analyzeHtml as analyzeHtmlForContentSignals } from "./html-analyzer";

describeContentSignals("html content signals", () => {
  itContentSignals(
    "결제형 사이트의 AI 답변 준비 콘텐츠 신호를 추출한다",
    () => {
      const html = Buffer.from(
        `<!doctype html><html lang="ko"><head><title>TaxDIY</title><meta name="description" content="개인사업자와 프리랜서를 위한 세무 자료 정리 서비스"></head><body><h1>세무 신고 준비 서비스</h1><h2>이런 분께 추천합니다</h2><p>개인사업자와 프리랜서가 영수증과 통장 자료를 업로드하고 결과물을 확인합니다. 무료 범위와 유료 플랜, 개인정보 처리, 카카오톡 고객지원, 환불 및 해지 기준, 기존 엑셀 관리와의 차별점, 고객 사례, 후기와 신뢰 근거를 안내합니다.</p><a href="/pricing">요금제</a><a href="/privacy">개인정보처리방침</a></body></html>`,
      );
      const result = analyzeHtmlForContentSignals(html, "https://taxdiy.kr/");

      expectContentSignals(result.contentSignals.conversionIntent).toBe(
        "DIRECT_PAYMENT",
      );
      expectContentSignals(result.contentSignals.hasPricingOrTerms).toBe(true);
      expectContentSignals(result.contentSignals.hasTransactionPolicy).toBe(
        true,
      );
      expectContentSignals(
        result.contentSignals.hasDifferentiationOrProof,
      ).toBe(true);
    },
  );
});
