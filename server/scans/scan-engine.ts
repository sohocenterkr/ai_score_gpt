import {
  HttpFetchError,
  selectEvidenceHeaders,
  type SafeHttpFetcher,
  type SafeHttpResponse,
} from "./http-fetcher";
import {
  analyzeHtml,
  type HtmlAnalysis,
} from "./html-analyzer";

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

async function fetchOptionalResource(
  fetcher: SafeHttpFetcher,
  url: string,
  accept: string,
): Promise<OptionalResource> {
  try {
    const response = await fetcher.fetch(url, { accept });

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
      errorCode:
        error instanceof HttpFetchError
          ? error.code
          : "HTTP_REQUEST_FAILED",
      errorMessage:
        error instanceof Error
          ? error.message
          : "리소스를 불러오지 못했습니다.",
    };
  }
}

function robotsSitemaps(text: string): string[] {
  const values = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(.+?)\s*$/i);

    if (match?.[1]) {
      values.add(match[1]);
    }
  }

  return [...values].slice(0, 20);
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

function metadataFindings(
  analysis: HtmlAnalysis,
): CollectedFinding[] {
  const hasTitle = Boolean(analysis.title);
  const hasDescription = Boolean(analysis.metaDescription);
  const hasCanonical = Boolean(analysis.canonicalUrl);
  const hasH1 = analysis.headings.h1.length > 0;
  const hasLang = Boolean(analysis.htmlLang);
  const hasValidJsonLd = analysis.jsonLd.validCount > 0;
  const readableText = analysis.textLength >= 200;

  return [
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
      ruleCode: "STRUCT-LINKS-001",
      category: "AI 에이전트 사용 가능성",
      severity: "INFO",
      status: "PASS",
      title: "페이지 링크 구조",
      description: "초기 HTML의 탐색 가능한 링크를 수집했습니다.",
      evidence: {
        ...analysis.links,
      },
      recommendation: null,
    }),
    finding({
      ruleCode: "STRUCT-IFRAME-001",
      category: "콘텐츠 읽기 용이성",
      severity: "INFO",
      status: "PASS",
      title: "iframe 사용 현황",
      description: "초기 HTML의 iframe 개수를 수집했습니다.",
      evidence: {
        iframeCount: analysis.iframeCount,
      },
      recommendation: null,
    }),
  ];
}

export async function collectSiteScan(
  baseUrl: string,
  fetcher: SafeHttpFetcher,
): Promise<ScanCollectionResult> {
  const main = await fetcher.fetch(baseUrl);
  const htmlContent = isHtmlContentType(main.contentType);
  const analysis = htmlContent
    ? analyzeHtml(main.body, main.finalUrl)
    : null;
  const finalOrigin = new URL(main.finalUrl).origin;
  const robotsUrl = new URL("/robots.txt", finalOrigin).toString();
  const sitemapUrl = new URL("/sitemap.xml", finalOrigin).toString();

  const [robots, sitemap] = await Promise.all([
    fetchOptionalResource(
      fetcher,
      robotsUrl,
      "text/plain,*/*;q=0.5",
    ),
    fetchOptionalResource(
      fetcher,
      sitemapUrl,
      "application/xml,text/xml,*/*;q=0.5",
    ),
  ]);

  const findings: CollectedFinding[] = [];
  const httpPassed = isSuccessful(main.statusCode);

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

  const usesHttps = new URL(main.finalUrl).protocol === "https:";

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

  const robotsText =
    robots.response &&
    isSuccessful(robots.response.statusCode)
      ? robots.response.body.toString("utf8")
      : "";
  const declaredSitemaps = robotsText
    ? robotsSitemaps(robotsText)
    : [];

  findings.push(
    finding({
      ruleCode: "ACCESS-ROBOTS-EVIDENCE",
      category: "접근 및 수집 정책",
      severity: "INFO",
      status: robots.response ? "PASS" : "BLOCKED",
      title: "robots.txt 기초 증거",
      description:
        "robots.txt의 sitemap 선언과 응답 일부를 수집했습니다.",
      evidence: {
        url: robotsUrl,
        declaredSitemaps,
        textSample: robotsText.slice(0, 2_000),
      },
      recommendation: null,
    }),
  );

  findings.push(
    resourceFinding(
      "ACCESS-SITEMAP-001",
      "sitemap.xml",
      "정보 구조와 의미 전달",
      sitemap,
      "사이트 루트에 접근 가능한 sitemap.xml을 제공하거나 robots.txt에 실제 sitemap URL을 선언하세요.",
    ),
  );

  if (analysis) {
    findings.push(...metadataFindings(analysis));
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
