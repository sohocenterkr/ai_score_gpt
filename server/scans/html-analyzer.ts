import { createHash } from "node:crypto";
import { load } from "cheerio";

export type ConversionIntent =
  "DIRECT_PAYMENT" | "INQUIRY_OR_RESERVATION" | "INFORMATIONAL";

export interface ContentSignals {
  conversionIntent: ConversionIntent;
  detectedSignals: string[];
  missingSignals: string[];
  hasServiceDefinition: boolean;
  hasAudienceOrUseCase: boolean;
  hasWorkflowOrOutcome: boolean;
  hasPricingOrTerms: boolean;
  hasSupportOrContact: boolean;
  hasDataPolicy: boolean;
  hasDifferentiationOrProof: boolean;
  hasTransactionPolicy: boolean;
}

export interface HtmlAnalysis {
  rawHtmlHash: string;
  bodyBytes: number;
  textLength: number;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  htmlLang: string | null;
  openGraph: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3Count: number;
  };
  links: {
    total: number;
    internal: number;
    external: number;
    sample: string[];
  };
  jsonLd: {
    scriptCount: number;
    validCount: number;
    invalidCount: number;
    types: string[];
    errors: string[];
  };
  contentSignals: ContentSignals;
  iframeCount: number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstMetaContent(
  html: ReturnType<typeof load>,
  attributeName: "name" | "property",
  expectedValue: string,
): string | null {
  let result: string | null = null;

  html("meta").each((_index, element) => {
    if (result) {
      return;
    }

    const actual = html(element).attr(attributeName)?.trim().toLowerCase();

    if (actual === expectedValue.toLowerCase()) {
      const content = normalizeText(html(element).attr("content") ?? "");
      result = content || null;
    }
  });

  return result;
}

function canonicalFromDocument(
  html: ReturnType<typeof load>,
  finalUrl: string,
): string | null {
  let href: string | null = null;

  html("link[rel]").each((_index, element) => {
    if (href) {
      return;
    }

    const rel = (html(element).attr("rel") ?? "").toLowerCase().split(/\s+/);

    if (rel.includes("canonical")) {
      href = html(element).attr("href")?.trim() ?? null;
    }
  });

  if (!href) {
    return null;
  }

  try {
    return new URL(href, finalUrl).toString();
  } catch {
    return href;
  }
}

function collectJsonLdTypes(value: unknown, target: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, target);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const rawType = record["@type"];

  if (typeof rawType === "string") {
    target.add(rawType);
  } else if (Array.isArray(rawType)) {
    for (const item of rawType) {
      if (typeof item === "string") {
        target.add(item);
      }
    }
  }

  if (record["@graph"]) {
    collectJsonLdTypes(record["@graph"], target);
  }
}

function analyzeJsonLd(html: ReturnType<typeof load>) {
  let scriptCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  const types = new Set<string>();
  const errors: string[] = [];

  html('script[type="application/ld+json"]').each((_index, element) => {
    scriptCount += 1;
    const raw = html(element).text().trim();

    if (!raw) {
      invalidCount += 1;
      if (errors.length < 5) {
        errors.push("빈 JSON-LD 스크립트");
      }
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      validCount += 1;
      collectJsonLdTypes(parsed, types);
    } catch (error) {
      invalidCount += 1;
      if (errors.length < 5) {
        errors.push(
          error instanceof Error
            ? error.message.slice(0, 180)
            : "JSON 파싱 실패",
        );
      }
    }
  });

  return {
    scriptCount,
    validCount,
    invalidCount,
    types: [...types].sort(),
    errors,
  };
}

function analyzeLinks(html: ReturnType<typeof load>, finalUrl: string) {
  const base = new URL(finalUrl);
  const links = new Set<string>();

  html("a[href]").each((_index, element) => {
    const raw = html(element).attr("href")?.trim();

    if (
      !raw ||
      raw.startsWith("#") ||
      /^(?:mailto|tel|javascript|data):/i.test(raw)
    ) {
      return;
    }

    try {
      const resolved = new URL(raw, base);
      resolved.hash = "";

      if (["http:", "https:"].includes(resolved.protocol)) {
        links.add(resolved.toString());
      }
    } catch {
      return;
    }
  });

  let internal = 0;
  let external = 0;

  for (const link of links) {
    if (new URL(link).origin === base.origin) {
      internal += 1;
    } else {
      external += 1;
    }
  }

  return {
    total: links.size,
    internal,
    external,
    sample: [...links].slice(0, 20),
  };
}

function headingTexts(
  html: ReturnType<typeof load>,
  selector: string,
  limit: number,
): string[] {
  const values: string[] = [];

  html(selector).each((_index, element) => {
    if (values.length >= limit) {
      return;
    }

    const text = normalizeText(html(element).text());

    if (text) {
      values.push(text);
    }
  });

  return values;
}

function textMatches(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function detectContentSignals(input: {
  title: string | null;
  metaDescription: string | null;
  headings: HtmlAnalysis["headings"];
  links: HtmlAnalysis["links"];
  text: string;
}): ContentSignals {
  const haystack = normalizeText(
    [
      input.title ?? "",
      input.metaDescription ?? "",
      ...input.headings.h1,
      ...input.headings.h2,
      ...input.links.sample,
      input.text,
    ].join(" "),
  ).toLowerCase();

  const directPayment = textMatches(
    haystack,
    /결제|구매|주문|장바구니|구독|요금제|유료 플랜|checkout|payment|cart|order|subscribe|pricing|plan/i,
  );
  const inquiryOrReservation = textMatches(
    haystack,
    /예약|상담|견적|문의|전화|카카오|방문|예약하기|상담신청|contact|booking|reservation|quote|inquiry/i,
  );

  const hasServiceDefinition =
    input.text.length >= 300 &&
    Boolean(input.title || input.metaDescription || input.headings.h1.length);
  const hasAudienceOrUseCase = textMatches(
    haystack,
    /이용 대상|대상 고객|이런 분|추천합니다|누구에게|프리랜서|개인사업자|소상공인|고객|사용 사례|활용 사례|대표 사례|use case|for whom|target user/i,
  );
  const hasWorkflowOrOutcome = textMatches(
    haystack,
    /이용 절차|사용 방법|이용 방법|단계|시작하기|회원가입|업로드|등록|분석|결과물|결과 확인|how it works|step|workflow|getting started/i,
  );
  const hasPricingOrTerms = textMatches(
    haystack,
    /요금|가격|무료|유료|플랜|구독|비용|수수료|이용 범위|pricing|price|plan|free|paid|subscription/i,
  );
  const hasSupportOrContact = textMatches(
    haystack,
    /고객지원|고객 지원|문의|상담|전화|이메일|카카오|운영시간|응답|지원 채널|contact|support|help|email|phone/i,
  );
  const hasDataPolicy = textMatches(
    haystack,
    /개인정보|자료 처리|데이터 처리|입력자료|보안|보관|삭제|암호화|이용약관|privacy|security|data|retention|delete|terms/i,
  );
  const hasDifferentiationOrProof = textMatches(
    haystack,
    /차별|다른 서비스|비교|대안|장점|후기|사례|실적|고객사|리뷰|포트폴리오|왜.*선택|compare|alternative|review|case study|testimonial/i,
  );
  const hasCancelPolicy = textMatches(
    haystack,
    /환불|취소|해지|변경|예약 취소|예약 변경|반품|교환|refund|cancel|cancellation|termination|return|change/i,
  );

  const conversionIntent: ConversionIntent = directPayment
    ? "DIRECT_PAYMENT"
    : inquiryOrReservation
      ? "INQUIRY_OR_RESERVATION"
      : "INFORMATIONAL";

  const hasTransactionPolicy =
    conversionIntent === "DIRECT_PAYMENT"
      ? hasCancelPolicy
      : conversionIntent === "INQUIRY_OR_RESERVATION"
        ? hasCancelPolicy || hasSupportOrContact
        : hasSupportOrContact || hasDataPolicy;

  const signalEntries: Array<[string, boolean]> = [
    ["서비스 정의", hasServiceDefinition],
    ["이용 대상·활용 사례", hasAudienceOrUseCase],
    ["이용 절차·결과물", hasWorkflowOrOutcome],
    ["요금·이용 범위", hasPricingOrTerms],
    ["고객지원·문의", hasSupportOrContact],
    ["개인정보·자료 처리", hasDataPolicy],
    ["차별점·사례", hasDifferentiationOrProof],
    [
      conversionIntent === "DIRECT_PAYMENT"
        ? "환불·취소·해지"
        : conversionIntent === "INQUIRY_OR_RESERVATION"
          ? "예약·상담 취소/변경"
          : "운영 주체·문의 정책",
      hasTransactionPolicy,
    ],
  ];

  return {
    conversionIntent,
    detectedSignals: signalEntries
      .filter(([, detected]) => detected)
      .map(([label]) => label),
    missingSignals: signalEntries
      .filter(([, detected]) => !detected)
      .map(([label]) => label),
    hasServiceDefinition,
    hasAudienceOrUseCase,
    hasWorkflowOrOutcome,
    hasPricingOrTerms,
    hasSupportOrContact,
    hasDataPolicy,
    hasDifferentiationOrProof,
    hasTransactionPolicy,
  };
}

export function analyzeHtml(body: Buffer, finalUrl: string): HtmlAnalysis {
  const html = load(body.toString("utf8"));
  const title = normalizeText(html("title").first().text()) || null;
  const metaDescription = firstMetaContent(html, "name", "description");
  const robotsMeta = firstMetaContent(html, "name", "robots");
  const htmlLang = normalizeText(html("html").attr("lang") ?? "") || null;
  const iframeCount = html("iframe").length;
  const headings = {
    h1: headingTexts(html, "h1", 10),
    h2: headingTexts(html, "h2", 20),
    h3Count: html("h3").length,
  };
  const links = analyzeLinks(html, finalUrl);
  const jsonLd = analyzeJsonLd(html);

  html("script,style,noscript,template,svg,canvas").remove();
  const text = normalizeText(html("body").text() || html.root().text());
  const contentSignals = detectContentSignals({
    title,
    metaDescription,
    headings,
    links,
    text,
  });

  return {
    rawHtmlHash: createHash("sha256").update(body).digest("hex"),
    bodyBytes: body.length,
    textLength: text.length,
    title,
    metaDescription,
    canonicalUrl: canonicalFromDocument(html, finalUrl),
    robotsMeta,
    htmlLang,
    openGraph: {
      title: firstMetaContent(html, "property", "og:title"),
      description: firstMetaContent(html, "property", "og:description"),
      image: firstMetaContent(html, "property", "og:image"),
    },
    headings,
    links,
    jsonLd,
    contentSignals,
    iframeCount,
  };
}
