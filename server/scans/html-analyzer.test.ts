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
      expectContentSignals(result.contentSignals.siteArchetype).toBe(
        "SAAS_OR_WEB_SERVICE",
      );
      expectContentSignals(result.contentSignals.hasPricingOrTerms).toBe(true);
      expectContentSignals(result.contentSignals.hasTransactionPolicy).toBe(
        true,
      );
      expectContentSignals(
        result.contentSignals.hasDifferentiationOrProof,
      ).toBe(true);
      expectContentSignals(
        result.contentSignals.evidenceByKey?.hasPricingOrTerms.level,
      ).toBe("BODY");
      expectContentSignals(
        result.contentSignals.evidenceByKey?.hasDifferentiationOrProof.level,
      ).toBe("BODY");
    },
  );

  itContentSignals(
    "본문 설명 없이 제목·메타·링크에만 있는 표현은 짧은 단서로 분류한다",
    () => {
      const result = analyzeHtmlForContentSignals(
        Buffer.from(`
          <!doctype html>
          <html lang="ko">
            <head>
              <title>예제 서비스</title>
              <meta
                name="description"
                content="온라인 업무 지원 서비스"
              >
            </head>
            <body>
              <h1>예제 서비스</h1>
              <p>필요한 업무를 온라인에서 간편하게 처리할 수 있습니다.</p>
              <a href="/pricing">요금제</a>
            </body>
          </html>
        `),
        "https://example.com/",
      );

      expectContentSignals(
        result.contentSignals.evidenceByKey?.hasPricingOrTerms,
      ).toMatchObject({
        level: "HINT",
        matchedSources: ["LINK"],
      });
    },
  );
});


describeContentSignals("site archetype regression", () => {
  itContentSignals(
    "예약 기능을 선택하지 않아도 상품·가격·장바구니 증거가 있으면 쇼핑몰이다",
    () => {
      const result = analyzeHtmlForContentSignals(
        Buffer.from('<!doctype html><html><body><h1>프리미엄 가방 컬렉션</h1><p>상품 판매가 3,500,000원</p><button>장바구니</button><a href="/products/bag-1">상품 보기</a></body></html>'),
        "https://shop.example/",
        { hasReservationFeature: false, hasCommerceFeature: false },
      );

      expectContentSignals(result.contentSignals.conversionIntent).toBe("DIRECT_PAYMENT");
      expectContentSignals(result.contentSignals.siteArchetype).toBe("ECOMMERCE");
      expectContentSignals(result.contentSignals.classificationConflict).toBe(true);
    },
  );

  itContentSignals("Product JSON-LD는 직접 결제형 쇼핑몰의 강한 증거다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from('<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"가방","offers":{"@type":"Offer","price":"3500000","priceCurrency":"KRW"}}</script></head><body><h1>가방</h1></body></html>'),
      "https://shop.example/",
      { hasReservationFeature: false },
    );

    expectContentSignals(result.contentSignals.conversionIntent).toBe("DIRECT_PAYMENT");
    expectContentSignals(result.contentSignals.siteArchetype).toBe("ECOMMERCE");
    expectContentSignals(result.contentSignals.classificationSources).toContain("PRODUCT_OFFER_JSONLD");
  });

  itContentSignals("사용자가 직접 결제 가능을 선택하면 숨겨진 결제 흐름도 반영한다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from("<!doctype html><html><body><h1>회원 전용 판매</h1></body></html>"),
      "https://members.example/",
      { hasCommerceFeature: true, hasReservationFeature: false },
    );

    expectContentSignals(result.contentSignals.conversionIntent).toBe("DIRECT_PAYMENT");
    expectContentSignals(result.contentSignals.classificationConfidence).toBe("HIGH");
  });

  itContentSignals("유료 SaaS는 결제 문구가 있어도 쇼핑몰로 분류하지 않는다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from("<!doctype html><html><body><h1>온라인 업무 자동화 소프트웨어</h1><p>회원가입 후 파일을 업로드하면 대시보드에서 자동 분석 보고서를 확인합니다.</p><a href='/pricing'>유료 요금제 결제</a></body></html>"),
      "https://saas.example/",
      { hasCommerceFeature: false, hasReservationFeature: false },
    );

    expectContentSignals(result.contentSignals.conversionIntent).toBe("DIRECT_PAYMENT");
    expectContentSignals(result.contentSignals.siteArchetype).toBe("SAAS_OR_WEB_SERVICE");
    expectContentSignals(result.contentSignals.classificationSources).toContain("SAAS_TEXT");
    expectContentSignals(result.contentSignals.siteArchetype).not.toBe("ECOMMERCE");
  });

  itContentSignals("쇼핑몰 사용자 선언은 SaaS 단어가 함께 있어도 쇼핑몰로 우선한다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from("<!doctype html><html><body><h1>디지털 상품 스토어</h1><p>회원가입과 로그인 후 상품을 구매합니다.</p></body></html>"),
      "https://digital-shop.example/",
      { hasCommerceFeature: true, hasReservationFeature: false },
    );

    expectContentSignals(result.contentSignals.siteArchetype).toBe("ECOMMERCE");
    expectContentSignals(result.contentSignals.classificationSources).toContain("USER_COMMERCE_DECLARATION");
  });

  itContentSignals("예약 사이트는 결제 증거가 없을 때 예약·상담형이다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from("<!doctype html><html><body><h1>진료 예약</h1><p>전화 상담 후 방문하세요.</p></body></html>"),
      "https://clinic.example/",
      { hasCommerceFeature: false, hasReservationFeature: true },
    );

    expectContentSignals(result.contentSignals.conversionIntent).toBe("INQUIRY_OR_RESERVATION");
    expectContentSignals(result.contentSignals.siteArchetype).toBe("LOCAL_OR_RESERVATION_SERVICE");
  });

  itContentSignals("템플릿 변수 링크는 정상 내부 링크로 집계하지 않는다", () => {
    const result = analyzeHtmlForContentSignals(
      Buffer.from('<!doctype html><html><body><a href="/{#text_1}">오류</a><a href="/%7Bpc_thumb_tag%7D">오류2</a><a href="/products">정상 상품</a></body></html>'),
      "https://shop.example/",
    );

    expectContentSignals(result.links.internal).toBe(1);
    expectContentSignals(result.links.sample).toEqual(["https://shop.example/products"]);
  });
});
