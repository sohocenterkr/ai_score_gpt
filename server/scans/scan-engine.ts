import {
  selectEvidenceHeaders,
  type SafeHttpFetcher,
  type SafeHttpResponse,
} from "./http-fetcher";
import {
  analyzeHtml,
  type HtmlAnalysis,
} from "./html-analyzer";
import type {
  RenderedDomCollector,
  RenderedDomResult,
} from "./rendered-dom";
import {
  evaluateRobotsPolicy,
  parseRobotsPolicy,
  type ParsedRobotsPolicy,
  type RobotsDecision,
} from "./robots-policy";

export type CollectedFindingStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NA";

export type CollectedFindingSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface CollectedFinding {
  ruleCode: string;
  category: string;
  severity: CollectedFindingSeverity;
  status: CollectedFindingStatus;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string | null;
  scoreDelta: number;
}

export interface ScanCollectionOptions {
  renderedDomCollector?: RenderedDomCollector;
}

export interface ScanCollectionResult {
  status: "COMPLETED" | "PARTIAL";
  finalUrl: string;
  page: {
    url: string;
    statusCode: number;
    finalUrl: string;
    contentType: string | null;
    rawHtmlHash: string | null;
    initialTextLength: number | null;
    iframeCount: number | null;
  };
  findings: CollectedFinding[];
}

interface OptionalResource {
  url: string;
  response: SafeHttpResponse | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface SitemapAttempt {
  url: string;
  statusCode: number | null;
  finalUrl: string | null;
  contentType: string | null;
  validXml: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

interface SitemapCollection {
  selected: SafeHttpResponse | null;
  attempts: SitemapAttempt[];
}

interface BotDefinition {
  ruleCode: string;
  token: string;
  label: string;
  userAgent: string;
  kind: "SEARCH" | "USER" | "TRAINING";
}

const botDefinitions: readonly BotDefinition[] = [
  {
    ruleCode: "ACCESS-OAI-SEARCHBOT-001",
    token: "OAI-SearchBot",
    label: "OAI-SearchBot 검색 접근",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot",
    kind: "SEARCH",
  },
  {
    ruleCode: "ACCESS-CHATGPT-USER-001",
    token: "ChatGPT-User",
    label: "ChatGPT-User 사용자 요청 접근",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
    kind: "USER",
  },
  {
    ruleCode: "ACCESS-GPTBOT-001",
    token: "GPTBot",
    label: "GPTBot 학습 접근 정책",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.3; +https://openai.com/gptbot",
    kind: "TRAINING",
  },
];

function finding(
  input: Omit<CollectedFinding, "scoreDelta">,
): CollectedFinding {
  return {
    ...input,
    scoreDelta: 0,
  };
}

function isSuccessful(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

function isHtmlContentType(
  contentType: string | null,
): boolean {
  if (!contentType) {
    return true;
  }

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml")
  );
}

function statusSeverity(
  statusCode: number,
): CollectedFindingSeverity {
  if (statusCode >= 500 || statusCode === 0) {
    return "CRITICAL";
  }

  if (statusCode >= 400) {
    return "HIGH";
  }

  if (statusCode >= 300) {
    return "MEDIUM";
  }

  return "INFO";
}

function errorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "HTTP_REQUEST_FAILED";
}

async function fetchOptionalResource(
  fetcher: SafeHttpFetcher,
  url: string,
  accept: string,
  userAgent?: string,
): Promise<OptionalResource> {
  try {
    const response = await fetcher.fetch(url, {
      accept,
      userAgent,
    });

    return {
      url,
      response,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    return {
      url,
      response: null,
      errorCode: errorCode(error),
      errorMessage:
        error instanceof Error
          ? error.message
          : "리소스를 불러오지 못했습니다.",
    };
  }
}

function isXmlSitemap(response: SafeHttpResponse): boolean {
  const contentType = response.contentType?.toLowerCase() ?? "";
  const sample = response.body
    .subarray(0, 4_096)
    .toString("utf8")
    .toLowerCase();

  return (
    contentType.includes("xml") ||
    sample.includes("<urlset") ||
    sample.includes("<sitemapindex")
  );
}

async function collectSitemap(
  fetcher: SafeHttpFetcher,
  declaredSitemaps: readonly string[],
  defaultSitemapUrl: string,
): Promise<SitemapCollection> {
  const candidates = [
    ...new Set([...declaredSitemaps, defaultSitemapUrl]),
  ].slice(0, 5);
  const attempts: SitemapAttempt[] = [];

  for (const url of candidates) {
    const resource = await fetchOptionalResource(
      fetcher,
      url,
      "application/xml,text/xml,*/*;q=0.5",
    );

    if (!resource.response) {
      attempts.push({
        url,
        statusCode: null,
        finalUrl: null,
        contentType: null,
        validXml: false,
        errorCode: resource.errorCode,
        errorMessage: resource.errorMessage,
      });
      continue;
    }

    const validXml =
      isSuccessful(resource.response.statusCode) &&
      isXmlSitemap(resource.response);

    attempts.push({
      url,
      statusCode: resource.response.statusCode,
      finalUrl: resource.response.finalUrl,
      contentType: resource.response.contentType,
      validXml,
      errorCode: null,
      errorMessage: null,
    });

    if (validXml) {
      return {
        selected: resource.response,
        attempts,
      };
    }
  }

  return {
    selected: null,
    attempts,
  };
}

function resourceFinding(
  ruleCode: string,
  title: string,
  category: string,
  resource: OptionalResource,
  recommendation: string,
): CollectedFinding {
  if (!resource.response) {
    return finding({
      ruleCode,
      category,
      severity: "MEDIUM",
      status: "BLOCKED",
      title,
      description: `${title}을 확인하지 못했습니다.`,
      evidence: {
        url: resource.url,
        errorCode: resource.errorCode,
        errorMessage: resource.errorMessage,
      },
      recommendation,
    });
  }

  const passed = isSuccessful(resource.response.statusCode);

  return finding({
    ruleCode,
    category,
    severity: passed ? "INFO" : "MEDIUM",
    status: passed ? "PASS" : "FAIL",
    title,
    description: passed
      ? `${title}에 정상적으로 접근했습니다.`
      : `${title} 응답 상태를 확인해야 합니다.`,
    evidence: {
      requestedUrl: resource.response.requestedUrl,
      finalUrl: resource.response.finalUrl,
      statusCode: resource.response.statusCode,
      contentType: resource.response.contentType,
      redirects: resource.response.redirects,
      headers: selectEvidenceHeaders(
        resource.response.headers,
      ),
    },
    recommendation: passed ? null : recommendation,
  });
}

function sitemapFinding(
  collection: SitemapCollection,
  declaredSitemaps: readonly string[],
  defaultSitemapUrl: string,
): CollectedFinding {
  const hasHttpResponse = collection.attempts.some(
    (attempt) => attempt.statusCode !== null,
  );

  return finding({
    ruleCode: "ACCESS-SITEMAP-001",
    category: "접근 및 수집 정책",
    severity: collection.selected ? "INFO" : "MEDIUM",
    status: collection.selected
      ? "PASS"
      : hasHttpResponse
        ? "FAIL"
        : "BLOCKED",
    title: "sitemap",
    description: collection.selected
      ? "robots.txt 선언 또는 사이트 루트에서 유효한 sitemap을 확인했습니다."
      : "확인한 sitemap 후보에서 유효한 XML sitemap을 찾지 못했습니다.",
    evidence: {
      declaredSitemaps,
      defaultSitemapUrl,
      selectedUrl: collection.selected?.finalUrl ?? null,
      attempts: collection.attempts,
    },
    recommendation: collection.selected
      ? null
      : "robots.txt에 실제 sitemap URL을 선언하고 해당 주소가 2xx XML 응답을 반환하도록 설정하세요.",
  });
}

function containsNoindex(value: string | null): boolean {
  return Boolean(value?.toLowerCase().includes("noindex"));
}

function renderedAnalysisSummary(analysis: HtmlAnalysis) {
  return {
    rawHtmlHash: analysis.rawHtmlHash,
    textLength: analysis.textLength,
    title: analysis.title,
    metaDescription: analysis.metaDescription,
    canonicalUrl: analysis.canonicalUrl,
    htmlLang: analysis.htmlLang,
    openGraph: analysis.openGraph,
    headings: {
      h1: analysis.headings.h1,
      h2Count: analysis.headings.h2.length,
      h3Count: analysis.headings.h3Count,
    },
    links: {
      total: analysis.links.total,
      internal: analysis.links.internal,
      external: analysis.links.external,
    },
    jsonLd: {
      scriptCount: analysis.jsonLd.scriptCount,
      validCount: analysis.jsonLd.validCount,
      invalidCount: analysis.jsonLd.invalidCount,
      types: analysis.jsonLd.types,
    },
    iframeCount: analysis.iframeCount,
  };
}

function renderedDomEvidence(
  initial: HtmlAnalysis | null,
  result: RenderedDomResult,
) {
  if (result.status !== "SUCCESS" || !initial) {
    return result;
  }

  return {
    status: result.status,
    browserVersion: result.browserVersion,
    durationMs: result.durationMs,
    statusCode: result.statusCode,
    finalUrl: result.finalUrl,
    allowedRequests: result.allowedRequests,
    blockedRequests: result.blockedRequests,
    pageErrorCount: result.pageErrorCount,
    pageErrorNames: result.pageErrorNames,
    initialHtml: renderedAnalysisSummary(initial),
    renderedDom: renderedAnalysisSummary(result.analysis),
    comparison: {
      textLengthDelta:
        result.analysis.textLength - initial.textLength,
      internalLinksDelta:
        result.analysis.links.internal - initial.links.internal,
      externalLinksDelta:
        result.analysis.links.external - initial.links.external,
      h1CountDelta:
        result.analysis.headings.h1.length -
        initial.headings.h1.length,
      h2CountDelta:
        result.analysis.headings.h2.length -
        initial.headings.h2.length,
      jsonLdValidCountDelta:
        result.analysis.jsonLd.validCount -
        initial.jsonLd.validCount,
      canonicalChanged:
        result.analysis.canonicalUrl !== initial.canonicalUrl,
      openGraphChanged:
        JSON.stringify(result.analysis.openGraph) !==
        JSON.stringify(initial.openGraph),
    },
  };
}

function metadataFindings(
  analysis: HtmlAnalysis,
  main: SafeHttpResponse,
): CollectedFinding[] {
  const hasTitle = Boolean(analysis.title);
  const hasDescription = Boolean(analysis.metaDescription);
  const hasCanonical = Boolean(analysis.canonicalUrl);
  const hasH1 = analysis.headings.h1.length > 0;
  const hasHeadingStructure =
    hasH1 && analysis.headings.h2.length > 0;
  const hasLang = Boolean(analysis.htmlLang);
  const hasOpenGraph = Boolean(
    analysis.openGraph.title &&
      analysis.openGraph.description,
  );
  const hasValidJsonLd = analysis.jsonLd.validCount > 0;
  const hasJsonLdTypes = analysis.jsonLd.types.length > 0;
  const readableText = analysis.textLength >= 200;
  const answerableText = analysis.textLength >= 800;
  const navigable = analysis.links.internal >= 1;
  const iframeIndependent =
    analysis.iframeCount === 0 || analysis.textLength >= 500;
  const xRobotsTag =
    selectEvidenceHeaders(main.headers)["x-robots-tag"];
  const indexable =
    !containsNoindex(analysis.robotsMeta) &&
    !containsNoindex(xRobotsTag);

  return [
    finding({
      ruleCode: "CONTENT-HTML-001",
      category: "콘텐츠 읽기 용이성",
      severity: "INFO",
      status: "PASS",
      title: "HTML 콘텐츠",
      description: "대표 페이지에서 HTML 문서를 확인했습니다.",
      evidence: {
        contentType: main.contentType,
        bodyBytes: analysis.bodyBytes,
        rawHtmlHash: analysis.rawHtmlHash,
      },
      recommendation: null,
    }),
    finding({
      ruleCode: "META-TITLE-001",
      category: "정보 구조와 의미 전달",
      severity: hasTitle ? "INFO" : "HIGH",
      status: hasTitle ? "PASS" : "FAIL",
      title: "문서 제목(title)",
      description: hasTitle
        ? "초기 HTML에서 문서 제목을 확인했습니다."
        : "초기 HTML에서 문서 제목을 찾지 못했습니다.",
      evidence: {
        title: analysis.title,
      },
      recommendation: hasTitle
        ? null
        : "각 페이지의 주제를 분명히 설명하는 고유한 title 요소를 초기 HTML에 추가하세요.",
    }),
    finding({
      ruleCode: "META-DESCRIPTION-001",
      category: "정보 구조와 의미 전달",
      severity: hasDescription ? "INFO" : "MEDIUM",
      status: hasDescription ? "PASS" : "FAIL",
      title: "메타 설명",
      description: hasDescription
        ? "초기 HTML에서 메타 설명을 확인했습니다."
        : "초기 HTML에서 메타 설명을 찾지 못했습니다.",
      evidence: {
        metaDescription: analysis.metaDescription,
      },
      recommendation: hasDescription
        ? null
        : "페이지의 핵심 내용을 요약하는 meta description을 초기 HTML에 추가하세요.",
    }),
    finding({
      ruleCode: "META-CANONICAL-001",
      category: "정보 구조와 의미 전달",
      severity: hasCanonical ? "INFO" : "LOW",
      status: hasCanonical ? "PASS" : "FAIL",
      title: "대표 URL(canonical)",
      description: hasCanonical
        ? "canonical URL을 확인했습니다."
        : "canonical URL을 찾지 못했습니다.",
      evidence: {
        canonicalUrl: analysis.canonicalUrl,
      },
      recommendation: hasCanonical
        ? null
        : "중복 URL 판단을 돕도록 대표 URL을 가리키는 canonical 링크를 추가하세요.",
    }),
    finding({
      ruleCode: "META-OG-001",
      category: "정보 구조와 의미 전달",
      severity: hasOpenGraph ? "INFO" : "LOW",
      status: hasOpenGraph ? "PASS" : "FAIL",
      title: "Open Graph 핵심 메타데이터",
      description: hasOpenGraph
        ? "og:title과 og:description을 확인했습니다."
        : "og:title 또는 og:description이 누락되었습니다.",
      evidence: {
        ...analysis.openGraph,
      },
      recommendation: hasOpenGraph
        ? null
        : "공유·요약 문맥을 돕도록 og:title과 og:description을 초기 HTML에 추가하세요.",
    }),
    finding({
      ruleCode: "STRUCT-H1-001",
      category: "콘텐츠 읽기 용이성",
      severity: hasH1 ? "INFO" : "MEDIUM",
      status: hasH1 ? "PASS" : "FAIL",
      title: "최상위 제목(H1)",
      description: hasH1
        ? "초기 HTML에서 H1 제목을 확인했습니다."
        : "초기 HTML에서 H1 제목을 찾지 못했습니다.",
      evidence: {
        h1Count: analysis.headings.h1.length,
        h1: analysis.headings.h1,
        h2: analysis.headings.h2,
        h3Count: analysis.headings.h3Count,
      },
      recommendation: hasH1
        ? null
        : "페이지의 핵심 주제를 나타내는 H1 제목을 초기 HTML에 추가하세요.",
    }),
    finding({
      ruleCode: "CONTENT-HEADINGS-001",
      category: "콘텐츠 이해 및 답변 가능성",
      severity: hasHeadingStructure ? "INFO" : "LOW",
      status: hasHeadingStructure ? "PASS" : "FAIL",
      title: "제목 계층 구조",
      description: hasHeadingStructure
        ? "H1과 H2를 사용한 기본 제목 계층을 확인했습니다."
        : "H1과 H2를 함께 사용한 기본 제목 계층이 부족합니다.",
      evidence: {
        h1: analysis.headings.h1,
        h2: analysis.headings.h2,
        h3Count: analysis.headings.h3Count,
      },
      recommendation: hasHeadingStructure
        ? null
        : "페이지 주제와 하위 내용을 H1·H2 계층으로 명확히 구분하세요.",
    }),
    finding({
      ruleCode: "STRUCT-LANG-001",
      category: "정보 구조와 의미 전달",
      severity: hasLang ? "INFO" : "LOW",
      status: hasLang ? "PASS" : "FAIL",
      title: "문서 기본 언어",
      description: hasLang
        ? "HTML lang 속성을 확인했습니다."
        : "HTML lang 속성을 찾지 못했습니다.",
      evidence: {
        htmlLang: analysis.htmlLang,
      },
      recommendation: hasLang
        ? null
        : "html 요소에 페이지의 기본 언어를 나타내는 lang 속성을 추가하세요.",
    }),
    finding({
      ruleCode: "STRUCT-JSONLD-001",
      category: "핵심정보 인식 정확도",
      severity: hasValidJsonLd ? "INFO" : "MEDIUM",
      status: hasValidJsonLd ? "PASS" : "FAIL",
      title: "JSON-LD 구조화 데이터",
      description: hasValidJsonLd
        ? "유효한 JSON-LD 구조화 데이터를 확인했습니다."
        : "유효한 JSON-LD 구조화 데이터를 확인하지 못했습니다.",
      evidence: {
        ...analysis.jsonLd,
      },
      recommendation: hasValidJsonLd
        ? null
        : "사이트의 업종과 핵심정보에 맞는 Schema.org JSON-LD를 초기 HTML에 추가하세요.",
    }),
    finding({
      ruleCode: "STRUCT-JSONLD-TYPES-001",
      category: "핵심정보 인식 정확도",
      severity: hasJsonLdTypes ? "INFO" : "MEDIUM",
      status: hasJsonLdTypes ? "PASS" : "FAIL",
      title: "JSON-LD 유형 식별",
      description: hasJsonLdTypes
        ? "JSON-LD에서 Schema.org 유형을 식별했습니다."
        : "식별 가능한 JSON-LD @type이 없습니다.",
      evidence: {
        scriptCount: analysis.jsonLd.scriptCount,
        types: analysis.jsonLd.types,
      },
      recommendation: hasJsonLdTypes
        ? null
        : "WebSite, Organization, LocalBusiness 등 사이트에 맞는 @type을 명시하세요.",
    }),
    finding({
      ruleCode: "CONTENT-INITIAL-001",
      category: "콘텐츠 읽기 용이성",
      severity: readableText ? "INFO" : "MEDIUM",
      status: readableText ? "PASS" : "FAIL",
      title: "초기 HTML 텍스트",
      description: readableText
        ? "초기 HTML에서 읽을 수 있는 본문 텍스트를 확인했습니다."
        : "초기 HTML의 읽을 수 있는 본문 텍스트가 매우 적습니다.",
      evidence: {
        textLength: analysis.textLength,
        bodyBytes: analysis.bodyBytes,
      },
      recommendation: readableText
        ? null
        : "핵심 설명과 주요 정보를 JavaScript 실행 전 초기 HTML에서도 읽을 수 있게 제공하세요.",
    }),
    finding({
      ruleCode: "CONTENT-ANSWERABILITY-001",
      category: "콘텐츠 이해 및 답변 가능성",
      severity: answerableText ? "INFO" : "MEDIUM",
      status: answerableText ? "PASS" : "FAIL",
      title: "초기 콘텐츠 답변 기반",
      description: answerableText
        ? "초기 HTML에 기초 질문 답변에 사용할 수 있는 본문량이 있습니다."
        : "초기 HTML 본문량이 적어 사이트 기반 답변 생성이 제한될 수 있습니다.",
      evidence: {
        textLength: analysis.textLength,
        threshold: 800,
      },
      recommendation: answerableText
        ? null
        : "서비스·장소·이용방법 등 주요 질문에 답할 수 있는 설명을 초기 HTML에 보강하세요.",
    }),
    finding({
      ruleCode: "STRUCT-LINKS-001",
      category: "AI 에이전트 사용 가능성",
      severity: navigable ? "INFO" : "MEDIUM",
      status: navigable ? "PASS" : "FAIL",
      title: "페이지 링크 구조",
      description: navigable
        ? "초기 HTML에서 탐색 가능한 내부 링크를 확인했습니다."
        : "초기 HTML에서 탐색 가능한 내부 링크를 찾지 못했습니다.",
      evidence: {
        ...analysis.links,
      },
      recommendation: navigable
        ? null
        : "주요 페이지로 이동할 수 있는 표준 a 링크를 초기 HTML에 제공하세요.",
    }),
    finding({
      ruleCode: "CONTENT-NAVIGATION-001",
      category: "콘텐츠 이해 및 답변 가능성",
      severity: navigable ? "INFO" : "LOW",
      status: navigable ? "PASS" : "FAIL",
      title: "관련 콘텐츠 탐색 단서",
      description: navigable
        ? "초기 HTML의 내부 링크가 관련 콘텐츠 탐색 단서를 제공합니다."
        : "관련 콘텐츠로 이어지는 내부 링크 단서가 부족합니다.",
      evidence: {
        internalLinks: analysis.links.internal,
        externalLinks: analysis.links.external,
        sample: analysis.links.sample,
      },
      recommendation: navigable
        ? null
        : "핵심 주제와 관련 페이지를 설명적인 링크 텍스트로 연결하세요.",
    }),
    finding({
      ruleCode: "STRUCT-IFRAME-001",
      category: "콘텐츠 읽기 용이성",
      severity: iframeIndependent ? "INFO" : "MEDIUM",
      status: iframeIndependent ? "PASS" : "FAIL",
      title: "초기 HTML의 iframe 비의존성",
      description: iframeIndependent
        ? "초기 HTML만으로도 충분한 본문을 읽을 수 있습니다."
        : "iframe이 존재하고 초기 HTML 본문이 적어 핵심정보 의존 가능성이 있습니다.",
      evidence: {
        iframeCount: analysis.iframeCount,
        textLength: analysis.textLength,
      },
      recommendation: iframeIndependent
        ? null
        : "iframe 내부에만 있는 핵심정보를 상위 페이지 초기 HTML에도 제공하세요.",
    }),
    finding({
      ruleCode: "ACCESS-INDEXABILITY-001",
      category: "AI 에이전트 사용 가능성",
      severity: indexable ? "INFO" : "HIGH",
      status: indexable ? "PASS" : "FAIL",
      title: "색인 허용 상태",
      description: indexable
        ? "robots meta와 X-Robots-Tag에서 noindex를 확인하지 못했습니다."
        : "robots meta 또는 X-Robots-Tag에 noindex가 있습니다.",
      evidence: {
        robotsMeta: analysis.robotsMeta,
        xRobotsTag,
      },
      recommendation: indexable
        ? null
        : "검색·답변 노출이 필요한 페이지에서는 noindex 지시를 제거하세요.",
    }),
  ];
}

async function botFinding(
  fetcher: SafeHttpFetcher,
  targetUrl: string,
  pathname: string,
  policy: ParsedRobotsPolicy,
  definition: BotDefinition,
): Promise<CollectedFinding> {
  const robotsDecision = evaluateRobotsPolicy(
    policy,
    definition.token,
    pathname,
  );
  const resource = await fetchOptionalResource(
    fetcher,
    targetUrl,
    "text/html,application/xhtml+xml,*/*;q=0.5",
    definition.userAgent,
  );
  const actualAccessible = Boolean(
    resource.response &&
      isSuccessful(resource.response.statusCode),
  );
  const mismatch =
    robotsDecision === "BLOCKED" && actualAccessible;

  if (definition.kind === "TRAINING") {
    return finding({
      ruleCode: definition.ruleCode,
      category: "접근 및 수집 정책",
      severity: "INFO",
      status:
        robotsDecision === "BLOCKED"
          ? "NA"
          : actualAccessible
            ? "PASS"
            : "BLOCKED",
      title: definition.label,
      description:
        robotsDecision === "BLOCKED"
          ? "학습용 GPTBot은 robots.txt에서 차단되어 있습니다. 이 선택은 자동 감점하지 않습니다."
          : actualAccessible
            ? "학습용 GPTBot User-Agent 요청이 실제로 응답했습니다."
            : "학습용 GPTBot User-Agent의 실제 응답을 확인하지 못했습니다. CDN·WAF·봇 방어 설정에 따라 일시적으로 달라질 수 있으며 점수에는 직접 반영하지 않습니다.",
      evidence: {
        kind: definition.kind,
        robotsDecision,
        actualAccessible,
        mismatch,
        statusCode: resource.response?.statusCode ?? null,
        finalUrl: resource.response?.finalUrl ?? null,
        errorCode: resource.errorCode,
        errorMessage: resource.errorMessage,
        officialSource:
          "https://developers.openai.com/api/docs/bots",
      },
      recommendation: null,
    });
  }

  if (definition.kind === "USER") {
    return finding({
      ruleCode: definition.ruleCode,
      category: "AI 에이전트 사용 가능성",
      severity: actualAccessible ? "INFO" : "MEDIUM",
      status: actualAccessible
        ? "PASS"
        : resource.response
          ? "FAIL"
          : "BLOCKED",
      title: definition.label,
      description: actualAccessible
        ? "사용자 요청형 ChatGPT-User User-Agent가 실제 페이지에 접근했습니다."
        : "사용자 요청형 ChatGPT-User User-Agent의 실제 접근을 확인하지 못했습니다. CDN·WAF·봇 방어 설정에 따라 일시적으로 달라질 수 있으며 점수에는 직접 반영하지 않습니다.",
      evidence: {
        kind: definition.kind,
        robotsDecision,
        robotsPolicyNote:
          "ChatGPT-User는 사용자 요청으로 동작하므로 robots.txt 규칙이 적용되지 않을 수 있습니다.",
        actualAccessible,
        statusCode: resource.response?.statusCode ?? null,
        finalUrl: resource.response?.finalUrl ?? null,
        redirects: resource.response?.redirects ?? [],
        errorCode: resource.errorCode,
        errorMessage: resource.errorMessage,
        officialSource:
          "https://developers.openai.com/api/docs/bots",
      },
      recommendation: actualAccessible
        ? null
        : "반복적으로 실패하면 사용자 요청형 AI 접근이 필요한 서비스인지 확인하고, 필요 시 WAF·CDN·봇 방어 설정을 점검하세요.",
    });
  }

  const passed =
    robotsDecision !== "BLOCKED" && actualAccessible;
  const blockedByPolicy = robotsDecision === "BLOCKED";

  return finding({
    ruleCode: definition.ruleCode,
    category: "접근 및 수집 정책",
    severity: passed ? "INFO" : blockedByPolicy ? "HIGH" : "MEDIUM",
    status: passed
      ? "PASS"
      : blockedByPolicy
        ? "FAIL"
        : resource.response
          ? "FAIL"
          : "BLOCKED",
    title: definition.label,
    description: passed
      ? "robots.txt 정책과 실제 User-Agent 요청에서 접근 가능함을 확인했습니다."
      : blockedByPolicy
        ? "robots.txt 정책에서 해당 검색 봇의 접근을 차단합니다."
        : "robots.txt는 차단하지 않지만 실제 검색 봇 User-Agent 요청이 정상 응답하지 않았습니다. CDN·WAF·봇 방어 설정에 따라 일시적으로 달라질 수 있으며 점수에는 직접 반영하지 않습니다.",
    evidence: {
      kind: definition.kind,
      robotsDecision,
      actualAccessible,
      mismatch,
      statusCode: resource.response?.statusCode ?? null,
      finalUrl: resource.response?.finalUrl ?? null,
      redirects: resource.response?.redirects ?? [],
      errorCode: resource.errorCode,
      errorMessage: resource.errorMessage,
      officialSource:
        "https://developers.openai.com/api/docs/bots",
    },
    recommendation: passed
      ? null
      : blockedByPolicy
        ? "AI 검색 노출이 필요하면 robots.txt에서 OAI-SearchBot 접근을 허용하세요."
        : "반복적으로 실패하면 AI 검색 봇 접근이 필요한 서비스인지 확인하고, 필요 시 WAF·CDN·봇 방어 설정을 점검하세요.",
  });
}

export async function collectSiteScan(
  baseUrl: string,
  fetcher: SafeHttpFetcher,
  options: ScanCollectionOptions = {},
): Promise<ScanCollectionResult> {
  const main = await fetcher.fetch(baseUrl);
  const htmlContent = isHtmlContentType(main.contentType);
  const analysis = htmlContent
    ? analyzeHtml(main.body, main.finalUrl)
    : null;
  const httpPassed = isSuccessful(main.statusCode);
  const renderedDomPromise =
    httpPassed && analysis && options.renderedDomCollector
      ? options.renderedDomCollector.collect(main.finalUrl)
      : Promise.resolve<RenderedDomResult>({
          status: "NOT_RUN",
          reason:
            options.renderedDomCollector
              ? "대표 페이지가 정상 HTML 응답이 아닙니다."
              : "렌더링 수집기가 비활성화되어 있습니다.",
        });
  const finalUrl = new URL(main.finalUrl);
  const finalOrigin = finalUrl.origin;
  const robotsUrl = new URL("/robots.txt", finalOrigin).toString();
  const defaultSitemapUrl = new URL(
    "/sitemap.xml",
    finalOrigin,
  ).toString();
  const robots = await fetchOptionalResource(
    fetcher,
    robotsUrl,
    "text/plain,*/*;q=0.5",
  );
  const robotsText =
    robots.response &&
    isSuccessful(robots.response.statusCode)
      ? robots.response.body.toString("utf8")
      : "";
  const robotsPolicy = parseRobotsPolicy(robotsText);
  const sitemap = await collectSitemap(
    fetcher,
    robotsPolicy.sitemaps,
    defaultSitemapUrl,
  );
  const botFindings = await Promise.all(
    botDefinitions.map((definition) =>
      botFinding(
        fetcher,
        main.finalUrl,
        finalUrl.pathname || "/",
        robotsPolicy,
        definition,
      ),
    ),
  );

  const findings: CollectedFinding[] = [];

  findings.push(
    finding({
      ruleCode: "ACCESS-HTTP-001",
      category: "접근 및 수집 정책",
      severity: httpPassed
        ? "INFO"
        : statusSeverity(main.statusCode),
      status: httpPassed ? "PASS" : "FAIL",
      title: "대표 페이지 HTTP 응답",
      description: httpPassed
        ? "대표 페이지가 정상 HTTP 상태로 응답했습니다."
        : "대표 페이지 HTTP 응답 상태를 확인해야 합니다.",
      evidence: {
        requestedUrl: main.requestedUrl,
        finalUrl: main.finalUrl,
        statusCode: main.statusCode,
        contentType: main.contentType,
        redirects: main.redirects,
        headers: selectEvidenceHeaders(main.headers),
        bodyBytes: main.body.length,
      },
      recommendation: httpPassed
        ? null
        : "대표 페이지가 안정적으로 2xx 상태를 반환하도록 서버·리디렉션·WAF 설정을 확인하세요.",
    }),
  );

  const usesHttps = finalUrl.protocol === "https:";

  findings.push(
    finding({
      ruleCode: "ACCESS-HTTPS-001",
      category: "접근 및 수집 정책",
      severity: usesHttps ? "INFO" : "HIGH",
      status: usesHttps ? "PASS" : "FAIL",
      title: "HTTPS 사용",
      description: usesHttps
        ? "최종 URL이 HTTPS를 사용합니다."
        : "최종 URL이 HTTPS를 사용하지 않습니다.",
      evidence: {
        finalUrl: main.finalUrl,
      },
      recommendation: usesHttps
        ? null
        : "대표 URL과 모든 리디렉션을 HTTPS로 통일하세요.",
    }),
  );

  findings.push(
    resourceFinding(
      "ACCESS-ROBOTS-001",
      "robots.txt",
      "접근 및 수집 정책",
      robots,
      "사이트 루트에 접근 가능한 robots.txt를 제공하고 검색용 AI 봇 정책을 명시하세요.",
    ),
  );

  findings.push(
    finding({
      ruleCode: "ACCESS-ROBOTS-EVIDENCE",
      category: "접근 및 수집 정책",
      severity: "INFO",
      status: robots.response ? "PASS" : "BLOCKED",
      title: "robots.txt 기초 증거",
      description:
        "robots.txt의 sitemap 선언과 봇별 정책 분석을 위한 기초 증거를 수집했습니다.",
      evidence: {
        url: robotsUrl,
        declaredSitemaps: robotsPolicy.sitemaps,
        textSample: robotsText.slice(0, 4_000),
      },
      recommendation: null,
    }),
  );

  findings.push(
    sitemapFinding(
      sitemap,
      robotsPolicy.sitemaps,
      defaultSitemapUrl,
    ),
  );
  findings.push(...botFindings);

  if (analysis) {
    findings.push(...metadataFindings(analysis, main));
  } else {
    findings.push(
      finding({
        ruleCode: "CONTENT-HTML-001",
        category: "콘텐츠 읽기 용이성",
        severity: "HIGH",
        status: "FAIL",
        title: "HTML 콘텐츠",
        description:
          "대표 페이지 응답을 HTML 문서로 확인하지 못했습니다.",
        evidence: {
          contentType: main.contentType,
          bodyBytes: main.body.length,
        },
        recommendation:
          "대표 URL이 사람이 읽을 수 있는 HTML 문서를 반환하는지 확인하세요.",
      }),
    );
  }

  const renderedDom = await renderedDomPromise;

  findings.push(
    finding({
      ruleCode: "ENV-MEASUREMENT-001",
      category: "최신성 및 측정 환경",
      severity: "INFO",
      status: "PASS",
      title: "실제 공개 URL 측정 환경",
      description:
        renderedDom.status === "SUCCESS"
          ? "검사 시점의 공개 URL에서 초기 HTML과 JavaScript 실행 후 DOM을 함께 비교했습니다."
          : "검사 시점의 공개 URL에서 DNS·리디렉션·HTTP 응답과 초기 HTML을 새로 수집했습니다.",
      evidence: {
        measuredAt: new Date().toISOString(),
        requestedUrl: main.requestedUrl,
        finalUrl: main.finalUrl,
        statusCode: main.statusCode,
        rulesScope:
          renderedDom.status === "SUCCESS"
            ? "QUICK_INITIAL_HTML_WITH_RENDERED_DOM_EVIDENCE"
            : "QUICK_INITIAL_HTML",
        renderedDom: renderedDomEvidence(analysis, renderedDom),
      },
      recommendation: null,
    }),
  );

  return {
    status:
      httpPassed && analysis ? "COMPLETED" : "PARTIAL",
    finalUrl: main.finalUrl,
    page: {
      url: baseUrl,
      statusCode: main.statusCode,
      finalUrl: main.finalUrl,
      contentType: main.contentType,
      rawHtmlHash: analysis?.rawHtmlHash ?? null,
      initialTextLength: analysis?.textLength ?? null,
      iframeCount: analysis?.iframeCount ?? null,
    },
    findings,
  };
}
