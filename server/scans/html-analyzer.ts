import { createHash } from "node:crypto";
import { load } from "cheerio";

export type ConversionIntent =
  "DIRECT_PAYMENT" | "INQUIRY_OR_RESERVATION" | "INFORMATIONAL";

export type ContentSignalKey =
  | "hasServiceDefinition"
  | "hasAudienceOrUseCase"
  | "hasWorkflowOrOutcome"
  | "hasPricingOrTerms"
  | "hasSupportOrContact"
  | "hasDataPolicy"
  | "hasDifferentiationOrProof"
  | "hasTransactionPolicy";

export type ContentEvidenceLevel = "FULL" | "BODY" | "HINT" | "NONE";

export type ContentEvidenceSource =
  "TITLE" | "META_DESCRIPTION" | "HEADING" | "BODY" | "LINK";

export interface ContentSignalEvidence {
  level: ContentEvidenceLevel;
  matchedSources: ContentEvidenceSource[];
}

export interface ContentSignals {
  conversionIntent: ConversionIntent;
  detectedSignals: string[];
  missingSignals: string[];
  evidenceByKey?: Record<ContentSignalKey, ContentSignalEvidence>;
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
    sameAsCount: number;
    contactPointCount: number;
    hasSearchAction: boolean;
    hasEntityContact: boolean;
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

function collectJsonLdSignals(
  value: unknown,
  target: {
    types: Set<string>;
    sameAsCount: number;
    contactPointCount: number;
    hasSearchAction: boolean;
    hasEntityContact: boolean;
  },
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdSignals(item, target);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const rawType = record["@type"];
  const typeValues = Array.isArray(rawType)
    ? rawType.filter((item): item is string => typeof item === "string")
    : typeof rawType === "string"
      ? [rawType]
      : [];

  for (const type of typeValues) {
    target.types.add(type);
    if (type === "SearchAction") {
      target.hasSearchAction = true;
    }
  }

  const sameAs = record.sameAs;
  if (typeof sameAs === "string" && sameAs.trim()) {
    target.sameAsCount += 1;
  } else if (Array.isArray(sameAs)) {
    target.sameAsCount += sameAs.filter(
      (item) => typeof item === "string" && Boolean(item.trim()),
    ).length;
  }

  const contactPoint = record.contactPoint;
  if (contactPoint) {
    target.contactPointCount += Array.isArray(contactPoint)
      ? contactPoint.length
      : 1;
  }

  const potentialAction = record.potentialAction;
  if (potentialAction) {
    const before = target.hasSearchAction;
    collectJsonLdSignals(potentialAction, target);
    target.hasSearchAction = target.hasSearchAction || before;
  }

  const isEntityType = typeValues.some((type) =>
    /^(Organization|LocalBusiness|Person|WebSite|WebApplication)$/i.test(type),
  );
  const hasContactField = Boolean(
    record.name &&
    (record.url ||
      record.telephone ||
      record.email ||
      record.address ||
      record.contactPoint),
  );
  if (isEntityType && hasContactField) {
    target.hasEntityContact = true;
  }

  if (record["@graph"]) {
    collectJsonLdSignals(record["@graph"], target);
  }
}

function analyzeJsonLd(html: ReturnType<typeof load>) {
  let scriptCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  const signals = {
    types: new Set<string>(),
    sameAsCount: 0,
    contactPointCount: 0,
    hasSearchAction: false,
    hasEntityContact: false,
  };
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
      collectJsonLdSignals(parsed, signals);
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
    types: [...signals.types].sort(),
    errors,
    sameAsCount: signals.sameAsCount,
    contactPointCount: signals.contactPointCount,
    hasSearchAction: signals.hasSearchAction,
    hasEntityContact: signals.hasEntityContact,
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

function classifyContentEvidence(
  input: {
    title: string;
    metaDescription: string;
    headings: string;
    bodyText: string;
    links: string;
  },
  pattern: RegExp,
  fullBodyLength = 120,
): ContentSignalEvidence {
  const matchedSources: ContentEvidenceSource[] = [];
  const titleMatched = textMatches(input.title, pattern);
  const metaMatched = textMatches(input.metaDescription, pattern);
  const headingMatched = textMatches(input.headings, pattern);
  const bodyMatched = textMatches(input.bodyText, pattern);
  const linkMatched = textMatches(input.links, pattern);

  if (titleMatched) matchedSources.push("TITLE");
  if (metaMatched) matchedSources.push("META_DESCRIPTION");
  if (headingMatched) matchedSources.push("HEADING");
  if (bodyMatched) matchedSources.push("BODY");
  if (linkMatched) matchedSources.push("LINK");

  const level: ContentEvidenceLevel =
    headingMatched && bodyMatched && input.bodyText.length >= fullBodyLength
      ? "FULL"
      : bodyMatched
        ? "BODY"
        : matchedSources.length > 0
          ? "HINT"
          : "NONE";

  return {
    level,
    matchedSources,
  };
}

function detectContentSignals(input: {
  title: string | null;
  metaDescription: string | null;
  headings: HtmlAnalysis["headings"];
  links: HtmlAnalysis["links"];
  text: string;
  bodyText: string;
}): ContentSignals {
  const sources = {
    title: normalizeText(input.title ?? "").toLowerCase(),
    metaDescription: normalizeText(input.metaDescription ?? "").toLowerCase(),
    headings: normalizeText(
      [...input.headings.h1, ...input.headings.h2].join(" "),
    ).toLowerCase(),
    bodyText: normalizeText(input.bodyText).toLowerCase(),
    links: normalizeText(input.links.sample.join(" ")).toLowerCase(),
  };
  const haystack = normalizeText(
    [
      sources.title,
      sources.metaDescription,
      sources.headings,
      sources.links,
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

  const conversionIntent: ConversionIntent = directPayment
    ? "DIRECT_PAYMENT"
    : inquiryOrReservation
      ? "INQUIRY_OR_RESERVATION"
      : "INFORMATIONAL";

  // Keyword lists below were tuned against a SaaS-shaped vocabulary
  // ("이용 대상", "이용 절차", "차별점") and missed ordinary small-business
  // phrasing — a booking/lesson site that shows real prices as "500,000원"
  // and calls itself "레슨"/"스튜디오" instead of "서비스"/"센터" matched
  // almost nothing despite having substantive content. Each pattern below
  // adds the industry-agnostic vocabulary (and, for pricing, a numeric
  // "숫자+원" / "%" match) that real small-business sites actually use.
  const serviceDefinitionPattern =
    /서비스|플랫폼|솔루션|도구|앱|웹사이트|센터|학원|병원|의원|식당|음식점|카페|매장|쇼핑몰|회사|기관|제공|지원|판매|운영|레슨|강좌|수업|진료|시술|시공|제작|디자인|컨설팅|이용권|멤버십|프로그램|상품|브랜드|스튜디오|아카데미|클리닉|클래스|전문점|공방|service|platform|solution|tool|app|website|center|academy|clinic|restaurant|cafe|store|company|organization|provide|offer|lesson|studio|program|membership/i;
  const audiencePattern =
    /이용 대상|대상 고객|이런 분|추천합니다|누구에게|프리랜서|개인사업자|소상공인|고객|회원|수강생|환자|사용 사례|활용 사례|대표 사례|use case|for whom|target user/i;
  const workflowPattern =
    /이용 절차|사용 방법|이용 방법|단계|시작하기|시작해|회원가입|업로드|등록|분석|결과물|결과 확인|예약하기|신청하기|신청 방법|참여하기|자세히\s?보기|더\s?보기|바로가기|how it works|step|workflow|getting started/i;
  const pricingPattern =
    /요금|가격|무료|유료|플랜|구독|비용|수수료|이용 범위|수강료|진료비|이용요금|정가|할인가|이벤트가|[0-9][0-9,]{2,}\s?원|\d{1,3}\s?%\s?(할인|off)|pricing|price|plan|free|paid|subscription/i;
  const supportPattern =
    /고객지원|고객 지원|문의|상담|전화|이메일|카카오|운영시간|응답|지원 채널|오시는\s?길|영업시간|찾아오시는\s?길|contact|support|help|email|phone/i;
  const dataPolicyPattern =
    /개인정보|자료 처리|데이터 처리|입력자료|보안|보관|삭제|암호화|이용약관|privacy|security|data|retention|delete|terms/i;
  const differentiationPattern =
    /차별|다른 서비스|비교|대안|장점|후기|사례|실적|고객사|리뷰|포트폴리오|왜.*선택|검증된|인증|1위|베스트|공식|전문가|경력|자격증|수상|compare|alternative|review|case study|testimonial/i;
  const cancelPattern =
    /환불|취소|해지|변경|예약 취소|예약 변경|반품|교환|refund|cancel|cancellation|termination|return|change/i;

  const transactionPattern =
    conversionIntent === "DIRECT_PAYMENT"
      ? cancelPattern
      : conversionIntent === "INQUIRY_OR_RESERVATION"
        ? /예약 취소|예약 변경|상담 취소|상담 변경|취소|변경|문의|상담|운영시간|cancel|change|contact|support/i
        : /운영 주체|사업자|회사|기관|문의|고객지원|개인정보|이용약관|지점|매장|오시는\s?길|organization|company|contact|support|privacy|terms/i;

  const evidenceByKey: Record<ContentSignalKey, ContentSignalEvidence> = {
    hasServiceDefinition: classifyContentEvidence(
      sources,
      serviceDefinitionPattern,
      220,
    ),
    hasAudienceOrUseCase: classifyContentEvidence(sources, audiencePattern),
    hasWorkflowOrOutcome: classifyContentEvidence(sources, workflowPattern),
    hasPricingOrTerms: classifyContentEvidence(sources, pricingPattern),
    hasSupportOrContact: classifyContentEvidence(sources, supportPattern),
    hasDataPolicy: classifyContentEvidence(sources, dataPolicyPattern),
    hasDifferentiationOrProof: classifyContentEvidence(
      sources,
      differentiationPattern,
    ),
    hasTransactionPolicy: classifyContentEvidence(sources, transactionPattern),
  };

  const hasServiceDefinition =
    evidenceByKey.hasServiceDefinition.level !== "NONE";
  const hasAudienceOrUseCase =
    evidenceByKey.hasAudienceOrUseCase.level !== "NONE";
  const hasWorkflowOrOutcome =
    evidenceByKey.hasWorkflowOrOutcome.level !== "NONE";
  const hasPricingOrTerms = evidenceByKey.hasPricingOrTerms.level !== "NONE";
  const hasSupportOrContact =
    evidenceByKey.hasSupportOrContact.level !== "NONE";
  const hasDataPolicy = evidenceByKey.hasDataPolicy.level !== "NONE";
  const hasDifferentiationOrProof =
    evidenceByKey.hasDifferentiationOrProof.level !== "NONE";
  const hasTransactionPolicy =
    evidenceByKey.hasTransactionPolicy.level !== "NONE";

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
    evidenceByKey,
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
  const contentBody = html("body").clone();
  contentBody.find("nav,header,footer,aside,a,h1,h2,h3,h4,h5,h6").remove();
  const bodyText = normalizeText(contentBody.text());
  const contentSignals = detectContentSignals({
    title,
    metaDescription,
    headings,
    links,
    text,
    bodyText,
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
