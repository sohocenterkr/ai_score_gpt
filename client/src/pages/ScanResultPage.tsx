import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getScanResultRequest,
  scanResultPdfUrl,
  SiteApiError,
  type ScanResultFinding,
  type ScanResultResponse,
} from "../sites/site-api";
import "../scan-results.css";
import {
  createWorkOrderRequest,
  WorkOrderApiError,
} from "../work-orders/work-order-api";
import "../work-orders.css";

const statusLabels: Record<ScanResultFinding["status"], string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const severityLabels: Record<
  ScanResultFinding["severity"],
  string
> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

const severityDescriptions: Record<
  ScanResultFinding["severity"],
  string
> = {
  INFO: "문제 해결 순서를 정할 때 참고하는 안내 수준입니다.",
  LOW: "점수 영향과 위험이 비교적 낮은 개선 항목입니다.",
  MEDIUM: "점수와 AI 이해도에 영향을 줄 수 있어 확인이 필요한 항목입니다.",
  HIGH: "핵심 접근성이나 이해 정확도에 큰 영향을 줄 수 있는 항목입니다.",
  CRITICAL: "검사 결과 전체를 제한할 수 있어 가장 먼저 해결해야 하는 항목입니다.",
};

function pointImpactLabel(finding: ScanResultFinding): string {
  if (finding.weight <= 0 || finding.status === "NA") {
    return "점수 영향 없음";
  }

  return finding.status === "PASS"
    ? `배점 ${finding.weight}점`
    : `감점 ${finding.weight}점`;
}

function pointImpactDescription(
  finding: ScanResultFinding,
): string {
  if (finding.weight <= 0 || finding.status === "NA") {
    return "이 항목은 현재 종합 점수 계산에 영향을 주지 않습니다.";
  }

  if (finding.status === "PASS") {
    return `통과하여 이 규칙의 배점 ${finding.weight}점을 획득했습니다.`;
  }

  return `통과하지 못해 이 규칙의 배점 ${finding.weight}점이 반영되지 않았습니다.`;
}

function formatKST(value: string | null): string {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function messageFromError(error: unknown): string {
  return error instanceof SiteApiError
    ? error.message
    : "검사 결과를 불러오지 못했습니다.";
}

function evidenceText(value: unknown): string {
  if (value === null || value === undefined) {
    return "저장된 증거 없음";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function findingAnchor(ruleCode: string): string {
  return `finding-${ruleCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

type EvidenceRecord = Record<string, unknown>;

interface RenderedDomMetric {
  initial: number | null;
  rendered: number | null;
  delta: number | null;
}

interface RenderedDomComparisonView {
  status: string;
  browserVersion: string | null;
  durationMs: number | null;
  pageErrorCount: number | null;
  errorCode: string | null;
  message: string | null;
  textLength: RenderedDomMetric;
  internalLinks: RenderedDomMetric;
  h1Count: RenderedDomMetric;
  h2Count: RenderedDomMetric;
  jsonLdValidCount: RenderedDomMetric;
  initialTitle: string | null;
  renderedTitle: string | null;
  initialDescription: string | null;
  renderedDescription: string | null;
  initialH1: string[];
  renderedH1: string[];
  initialJsonLdTypes: string[];
  renderedJsonLdTypes: string[];
}

interface RenderedImprovementPlan {
  code: string;
  title: string;
  currentState: string;
  meaning: string;
  change: string;
  developerInstructions: string[];
  acceptanceCriteria: string[];
}

function evidenceRecord(value: unknown): EvidenceRecord | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as EvidenceRecord)
    : null;
}

function recordNumber(
  record: EvidenceRecord | null,
  key: string,
): number | null {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function recordString(
  record: EvidenceRecord | null,
  key: string,
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function nestedRecord(
  record: EvidenceRecord | null,
  key: string,
): EvidenceRecord | null {
  return evidenceRecord(record?.[key]);
}

function recordArrayLength(
  record: EvidenceRecord | null,
  key: string,
): number | null {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : null;
}

function recordStringArray(
  record: EvidenceRecord | null,
  key: string,
): string[] {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" && Boolean(item.trim()),
  );
}

function renderedMetric(
  initial: number | null,
  rendered: number | null,
): RenderedDomMetric {
  return {
    initial,
    rendered,
    delta:
      initial === null || rendered === null
        ? null
        : rendered - initial,
  };
}

function renderedDomComparisonFromFindings(
  findings: ScanResultFinding[],
): RenderedDomComparisonView | null {
  const environment = findings.find(
    (finding) => finding.ruleCode === "ENV-MEASUREMENT-001",
  );
  const evidence = evidenceRecord(environment?.evidence);
  const renderedEvidence = nestedRecord(evidence, "renderedDom");

  if (!renderedEvidence) {
    return null;
  }

  const status =
    recordString(renderedEvidence, "status") ?? "UNKNOWN";
  const initial = nestedRecord(renderedEvidence, "initialHtml");
  const rendered = nestedRecord(renderedEvidence, "renderedDom");
  const initialLinks = nestedRecord(initial, "links");
  const renderedLinks = nestedRecord(rendered, "links");
  const initialHeadings = nestedRecord(initial, "headings");
  const renderedHeadings = nestedRecord(rendered, "headings");
  const initialJsonLd = nestedRecord(initial, "jsonLd");
  const renderedJsonLd = nestedRecord(rendered, "jsonLd");

  return {
    status,
    browserVersion: recordString(
      renderedEvidence,
      "browserVersion",
    ),
    durationMs: recordNumber(renderedEvidence, "durationMs"),
    pageErrorCount: recordNumber(
      renderedEvidence,
      "pageErrorCount",
    ),
    errorCode: recordString(renderedEvidence, "errorCode"),
    message: recordString(renderedEvidence, "message"),
    textLength: renderedMetric(
      recordNumber(initial, "textLength"),
      recordNumber(rendered, "textLength"),
    ),
    internalLinks: renderedMetric(
      recordNumber(initialLinks, "internal"),
      recordNumber(renderedLinks, "internal"),
    ),
    h1Count: renderedMetric(
      recordArrayLength(initialHeadings, "h1"),
      recordArrayLength(renderedHeadings, "h1"),
    ),
    h2Count: renderedMetric(
      recordNumber(initialHeadings, "h2Count"),
      recordNumber(renderedHeadings, "h2Count"),
    ),
    jsonLdValidCount: renderedMetric(
      recordNumber(initialJsonLd, "validCount"),
      recordNumber(renderedJsonLd, "validCount"),
    ),
    initialTitle: recordString(initial, "title"),
    renderedTitle: recordString(rendered, "title"),
    initialDescription: recordString(
      initial,
      "metaDescription",
    ),
    renderedDescription: recordString(
      rendered,
      "metaDescription",
    ),
    initialH1: recordStringArray(initialHeadings, "h1"),
    renderedH1: recordStringArray(renderedHeadings, "h1"),
    initialJsonLdTypes: recordStringArray(
      initialJsonLd,
      "types",
    ),
    renderedJsonLdTypes: recordStringArray(
      renderedJsonLd,
      "types",
    ),
  };
}

function normalizedText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedList(values: string[]): string {
  return [...values]
    .map((value) => normalizedText(value))
    .filter(Boolean)
    .sort()
    .join("|");
}

function buildRenderedImprovementPlans(
  comparison: RenderedDomComparisonView | null,
): RenderedImprovementPlan[] {
  if (!comparison || comparison.status !== "SUCCESS") {
    return [];
  }

  const plans: RenderedImprovementPlan[] = [];
  const textDelta = comparison.textLength.delta ?? 0;
  const linkDelta = comparison.internalLinks.delta ?? 0;
  const textInitial = comparison.textLength.initial ?? 0;
  const textGrowthRate =
    textInitial > 0 ? textDelta / textInitial : textDelta > 0 ? 1 : 0;
  const hasLargeAddedContent =
    textDelta >= 500 || textGrowthRate >= 0.25 || linkDelta >= 10;

  if (hasLargeAddedContent) {
    const stateParts = [
      comparison.textLength.initial !== null &&
      comparison.textLength.rendered !== null
        ? `본문 글자 수가 ${metricValue(
            comparison.textLength.initial,
            "자",
          )}에서 ${metricValue(
            comparison.textLength.rendered,
            "자",
          )}로 늘었습니다.`
        : null,
      comparison.internalLinks.initial !== null &&
      comparison.internalLinks.rendered !== null
        ? `내부 링크가 ${metricValue(
            comparison.internalLinks.initial,
            "개",
          )}에서 ${metricValue(
            comparison.internalLinks.rendered,
            "개",
          )}로 늘었습니다.`
        : null,
    ].filter((value): value is string => Boolean(value));

    plans.push({
      code: "RENDERED-ADDED-CONTENT",
      title:
        "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
      currentState:
        stateParts.join(" ") ||
        "페이지가 열린 뒤 본문이나 이동 링크가 추가됩니다.",
      meaning:
        "사람의 화면에는 정상적으로 보이지만, JavaScript를 충분히 처리하지 않는 일부 AI 검색 봇은 나중에 추가된 정보와 링크를 놓칠 수 있습니다.",
      change:
        "모든 화면 기능을 바꿀 필요는 없습니다. SSR, SSG 또는 사전 렌더링을 통해 AI가 처음 받는 HTML에도 서비스 정의, 대상 고객, 이용 절차, 요금·보안 정보, FAQ와 중요한 이동 링크가 실제 사용자 화면과 같은 의미로 포함되도록 수정합니다.",
      developerInstructions: [
        "이 항목은 8개의 독립 작업으로 나누기보다 SSR/SSG/사전 렌더링 도입 또는 랜딩 페이지 정적화를 중심 작업으로 묶어 처리해 주세요.",
        "초기 HTML에는 단순 글자 채우기가 아니라 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차를 자연스러운 본문 섹션으로 포함해 주세요.",
        "요금제 또는 무료·유료 이용 범위, 개인정보·입력자료 처리 방식, 운영 주체와 문의 경로를 초기 HTML에 1~2문장 이상 요약하고 관련 정책 페이지로 표준 a 링크를 제공해 주세요.",
        "실제 화면에 보이는 핵심 FAQ 3~4개를 만들고, 같은 질문·답변을 FAQPage JSON-LD로도 선언해 주세요.",
        "주요 내부 링크는 JavaScript 클릭 핸들러만 쓰지 말고 href가 있는 표준 a 링크로 초기 HTML에 제공해 주세요.",
        "필요하면 서버 렌더링(SSR), 정적 생성(SSG) 또는 사전 렌더링을 적용해 주세요.",
        "기존 디자인과 사용자 기능을 제거하거나 비활성화하지 마세요.",
      ],
      acceptanceCriteria: [
        "JavaScript 실행 전 HTML에서도 사이트의 핵심 소개와 주요 정보가 확인됩니다.",
        "초기 HTML만 확인해도 서비스 정의, 대상 고객, 대표 활용 사례, 이용 절차, 요금·데이터 처리 요약을 이해할 수 있습니다.",
        "중요한 내부 페이지로 이동하는 일반 링크가 초기 HTML에 존재합니다.",
        "실제 화면 FAQ와 FAQPage JSON-LD의 질문·답변이 일치합니다.",
        "기존 화면 디자인과 사용자 기능이 정상적으로 동작합니다.",
        "재검사에서 초기 HTML과 렌더링 DOM의 본문·링크 격차가 줄어듭니다.",
      ],
    });
  }

  const mismatchedFields: string[] = [];

  if (
    normalizedText(comparison.initialTitle) !==
    normalizedText(comparison.renderedTitle)
  ) {
    mismatchedFields.push("페이지 제목");
  }

  if (
    normalizedText(comparison.initialDescription) !==
    normalizedText(comparison.renderedDescription)
  ) {
    mismatchedFields.push("페이지 설명");
  }

  if (
    normalizedList(comparison.initialH1) !==
    normalizedList(comparison.renderedH1)
  ) {
    mismatchedFields.push("대표 제목(H1)");
  }

  if (
    normalizedList(comparison.initialJsonLdTypes) !==
    normalizedList(comparison.renderedJsonLdTypes)
  ) {
    mismatchedFields.push("구조화 정보(JSON-LD)");
  }

  if (mismatchedFields.length > 0) {
    plans.push({
      code: "RENDERED-INCONSISTENT-INFORMATION",
      title:
        "AI가 처음 받은 정보와 화면에 표시된 정보가 서로 다릅니다",
      currentState: `${mismatchedFields.join(
        ", ",
      )} 항목이 페이지가 처음 전달될 때와 화면이 완성된 뒤 서로 다릅니다.`,
      meaning:
        "AI 검색 시스템에 따라 처음 받은 정보를 사용하기도 하고 화면 완성 후의 정보를 사용하기도 합니다. 값이 다르면 같은 페이지를 서로 다르게 이해할 수 있으며, B2B 서비스에서는 AI가 서비스명·기능·요금·데이터 처리 방식을 잘못 설명할 위험이 커집니다.",
      change:
        "글자 하나까지 완전히 같을 필요는 없지만 페이지 주제, 서비스명, 핵심 기능, 가격·요금, 개인정보·자료 처리 방식, 운영 주체처럼 중요한 사실과 의미는 처음과 나중이 일치하도록 맞춥니다.",
      developerInstructions: [
        "초기 HTML과 렌더링 DOM의 title, meta description, H1, JSON-LD 값을 비교해 주세요.",
        "클라이언트 실행 후 올바른 초기 값을 오래되거나 다른 값으로 덮어쓰는 코드를 수정해 주세요.",
        "WebApplication, Organization, WebSite, FAQPage 등 JSON-LD의 이름·URL·설명·FAQ 답변이 실제 화면 정보와 일치하도록 유지해 주세요.",
        "중복되거나 충돌하는 메타데이터 선언은 하나의 정확한 값으로 정리해 주세요.",
        "요금, 보안, 개인정보, 지원 범위처럼 구매 검토에 영향을 주는 정보는 화면 본문·메타데이터·JSON-LD가 서로 다른 의미로 말하지 않게 점검해 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML과 화면 완성 후의 페이지 제목과 설명이 같은 주제와 의미를 전달합니다.",
        "대표 제목과 구조화 정보의 핵심 사실이 실제 화면 내용과 일치합니다.",
        "FAQPage JSON-LD를 추가한 경우 실제 화면 FAQ와 질문·답변이 일치합니다.",
        "서로 충돌하거나 오래된 메타데이터가 남아 있지 않습니다.",
        "재검사에서 렌더링 전후 핵심정보 불일치가 사라집니다.",
      ],
    });
  }

  const missingInitial: string[] = [];

  if (!comparison.initialTitle) {
    missingInitial.push("페이지 제목");
  }

  if (!comparison.initialDescription) {
    missingInitial.push("페이지 설명");
  }

  if (comparison.h1Count.initial === 0) {
    missingInitial.push("대표 제목(H1)");
  }

  if ((comparison.textLength.initial ?? 0) < 300) {
    missingInitial.push("핵심 본문");
  }

  if (missingInitial.length > 0) {
    plans.push({
      code: "INITIAL-HTML-MISSING-CORE",
      title: "AI가 처음 받는 페이지에 핵심 정보가 부족합니다",
      currentState: `${missingInitial.join(
        ", ",
      )} 항목을 초기 HTML에서 충분히 확인하지 못했습니다.`,
      meaning:
        "사람은 화면을 둘러보며 내용을 이해할 수 있지만, 일부 AI 검색 봇은 처음 전달된 제목·설명·본문을 중심으로 사이트의 주제를 판단합니다.",
      change:
        "페이지를 처음 불러왔을 때도 사이트가 누구를 위한 곳이며 무엇을 제공하는지, 어떤 절차로 이용하는지, 요금·데이터 처리·FAQ는 어디서 확인할 수 있는지 알 수 있도록 핵심 소개와 주요 정보를 보완합니다.",
      developerInstructions: [
        "페이지별로 고유하고 구체적인 title과 meta description을 초기 HTML에 제공해 주세요.",
        "페이지의 주제를 설명하는 명확한 H1과 핵심 본문을 초기 HTML에 포함해 주세요.",
        "핵심 본문에는 서비스 정의와 핵심 가치, 이용 대상과 대표 활용 사례, 3~5단계 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로를 포함해 주세요.",
        "중요한 콘텐츠 페이지, 요금제, 개인정보처리방침, 이용약관, 도움말·문의 페이지로 이동하는 일반 HTML 링크를 제공해 주세요.",
        "화면에 없는 내용을 검색 노출만을 위해 숨겨 넣지 말고 실제 사용자에게 보이는 정보와 일치시켜 주세요.",
      ],
      acceptanceCriteria: [
        "초기 HTML만 확인해도 페이지의 주제와 주요 서비스가 이해됩니다.",
        "title, meta description, H1과 핵심 본문의 의미가 서로 일관됩니다.",
        "서비스 정의, 대상 고객, 이용 절차, 요금·데이터 처리 요약, FAQ 또는 도움말 경로가 사용자 화면과 초기 HTML에서 함께 확인됩니다.",
        "사용자에게 보이는 내용과 AI에 제공되는 핵심 정보가 일치합니다.",
        "재검사에서 누락된 초기 HTML 핵심 항목이 확인됩니다.",
      ],
    });
  }

  return plans;
}

function publicRenderedPlanChange(
  code: string,
  fallback: string,
): string {
  switch (code) {
    case "RENDERED-ADDED-CONTENT":
      return "초기 HTML에 핵심 본문과 주요 이동 경로가 충분히 포함되도록 렌더링 의존도를 줄이는 개선이 필요합니다.";
    case "RENDERED-INCONSISTENT-INFORMATION":
      return "초기 HTML과 JavaScript 렌더링 후 화면의 핵심 제목·설명·구조화 정보가 같은 의미를 전달하도록 정합성 점검이 필요합니다.";
    case "INITIAL-HTML-MISSING-CORE":
      return "AI가 첫 응답만 보더라도 페이지 주제와 주요 서비스를 이해할 수 있도록 핵심 정보 보강이 필요합니다.";
    default:
      return fallback;
  }
}

function metricValue(
  value: number | null,
  suffix: string,
): string {
  return value === null
    ? "미확인"
    : `${value.toLocaleString("ko-KR")}${suffix}`;
}

function metricDelta(
  value: number | null,
  suffix: string,
): string {
  if (value === null) {
    return "변화 미확인";
  }

  const sign = value > 0 ? "+" : "";
  return `변화 ${sign}${value.toLocaleString("ko-KR")}${suffix}`;
}

export function ScanResultPage() {
  const {
    locale = "ko",
    siteId = "",
    scanId = "",
  } = useParams();
  const navigate = useNavigate();
  const [result, setResult] =
    useState<ScanResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [workOrderError, setWorkOrderError] = useState("");
  const [creatingWorkOrder, setCreatingWorkOrder] =
    useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = useState<
    string[]
  >([]);
  const [
    selectedRenderedImprovementCodes,
    setSelectedRenderedImprovementCodes,
  ] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!scanId) {
      setErrorMessage("검사 번호가 없습니다.");
      setLoading(false);
      return;
    }

    void getScanResultRequest(scanId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (siteId && response.site.id !== siteId) {
          setErrorMessage("사이트와 검사 결과가 일치하지 않습니다.");
          return;
        }

        setResult(response);
        setSelectedFindingIds(
          response.primaryIssues
            .filter((finding) => finding.weight > 0)
            .map((finding) => finding.id),
        );
        setSelectedRenderedImprovementCodes(
          buildRenderedImprovementPlans(
            renderedDomComparisonFromFindings(
              response.findings,
            ),
          ).map((plan) => plan.code),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(messageFromError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scanId, siteId]);

  async function handleCreateWorkOrder() {
    const selectedCount =
      selectedFindingIds.length +
      selectedRenderedImprovementCodes.length;

    if (!result || selectedCount === 0) {
      setWorkOrderError(
        "작업지시서에 포함할 문제나 개선안을 1개 이상 선택해 주세요.",
      );
      return;
    }

    setCreatingWorkOrder(true);
    setWorkOrderError("");

    try {
      const workOrder = await createWorkOrderRequest({
        scanId: result.scan.id,
        findingIds: selectedFindingIds,
        renderedImprovementCodes:
          selectedRenderedImprovementCodes,
      });
      navigate(`/${locale}/work-orders/${workOrder.id}`);
    } catch (error) {
      setWorkOrderError(
        error instanceof WorkOrderApiError
          ? error.message
          : "작업지시서를 만들지 못했습니다.",
      );
    } finally {
      setCreatingWorkOrder(false);
    }
  }

  function toggleWorkOrderFinding(
    findingId: string,
    checked: boolean,
  ) {
    setSelectedFindingIds((current) =>
      checked
        ? [...new Set([...current, findingId])]
        : current.filter((id) => id !== findingId),
    );
  }

  function toggleRenderedImprovement(
    planCode: string,
    checked: boolean,
  ) {
    setSelectedRenderedImprovementCodes((current) =>
      checked
        ? [...new Set([...current, planCode])]
        : current.filter((code) => code !== planCode),
    );
  }

  const groupedFindings = useMemo(() => {
    const groups = new Map<string, ScanResultFinding[]>();

    for (const finding of result?.findings ?? []) {
      const values = groups.get(finding.category) ?? [];
      values.push(finding);
      groups.set(finding.category, values);
    }

    return [...groups.entries()];
  }, [result]);

  const renderedDomComparison = useMemo(
    () =>
      renderedDomComparisonFromFindings(
        result?.findings ?? [],
      ),
    [result],
  );
  const renderedImprovementPlans = useMemo(
    () => buildRenderedImprovementPlans(renderedDomComparison),
    [renderedDomComparison],
  );
  const selectedWorkOrderItemCount =
    selectedFindingIds.length +
    selectedRenderedImprovementCodes.length;

  if (loading) {
    return (
      <section className="full-bleed-section scan-result-section">
        <div
          className="content-container scan-result-loading"
          role="status"
        >
          검사 결과를 불러오고 있습니다.
        </div>
      </section>
    );
  }

  if (!result || errorMessage) {
    return (
      <section className="full-bleed-section scan-result-section">
        <div className="content-container scan-result-loading">
          <p className="scan-result-error" role="alert">
            {errorMessage || "검사 결과가 없습니다."}
          </p>
          <Link className="scan-result-back" to={`/${locale}/sites`}>
            사이트 관리로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  const score = result.scan.score;
  const grade = result.scan.grade;
  const scoreSummary = result.scoreSummary;

  return (
    <section className="full-bleed-section scan-result-section">
      <div className="content-container scan-result-content">
        <header className="scan-result-header">
          <div>
            <p className="eyebrow">SCAN RESULT</p>
            <h1>{result.site.name} 간편진단 결과</h1>
            <p>
              공개 URL의 실제 HTTP 응답과 초기 HTML을 기준으로
              점수를 계산하고, JavaScript 렌더링 결과는 AI 수집
              개선안을 만드는 데 활용합니다.
            </p>
          </div>
          <Link className="scan-result-back" to={`/${locale}/sites`}>
            사이트 관리로
          </Link>
        </header>

        <div className="scan-result-actions">
            <button
              className="work-order-create-button"
              type="button"
              onClick={handleCreateWorkOrder}
              disabled={
                creatingWorkOrder ||
                selectedWorkOrderItemCount === 0
              }
            >
              {creatingWorkOrder
                ? "작업지시서 1건 생성 중..."
                : selectedWorkOrderItemCount > 0
                  ? `선택한 ${selectedWorkOrderItemCount}개 항목으로 작업지시서 1건 만들기`
                  : "작업지시서로 만들 항목을 선택하세요"}
            </button>
            <Link
              className="work-order-list-link"
              to={`/${locale}/work-orders`}
            >
              작업지시서 목록
            </Link>
            <a
              className="scan-report-link"
              href={scanResultPdfUrl(result.scan.id)}
            >
              PDF 보고서 저장
            </a>
        </div>

        <div className="scan-result-scope" role="note">
          현재 점수는 QUICK 초기 HTML 기준 25개 규칙으로 계산합니다.
          JavaScript 실행 후 DOM 비교는 점수에 직접 반영하지 않고
          렌더링 비교 총평과 개선 제안에 활용하며, 모바일·PC 별도 비교·업종별
          기준정보·질문 정답률은 정밀진단 단계에서 추가됩니다.
        </div>

        <section className="surface scan-score-hero">
          <div className="scan-score-main">
            <span>Site AI Score</span>
            <strong>
              {score === null ? "—" : Math.round(score)}
              <small>/100</small>
            </strong>
            <em>{grade ?? "미계산"}</em>
          </div>

          <dl className="scan-score-meta">
            <div>
              <dt>검사 상태</dt>
              <dd>{result.scan.status}</dd>
            </div>
            <div>
              <dt>규칙 버전</dt>
              <dd>{result.scan.rulesVersion}</dd>
            </div>
            <div>
              <dt>완료 시각(KST)</dt>
              <dd>{formatKST(result.scan.completedAt)}</dd>
            </div>
            <div>
              <dt>최종 URL</dt>
              <dd>
                <a
                  href={result.site.finalUrl ?? result.site.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.site.finalUrl ?? result.site.baseUrl}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {scoreSummary ? (
          <section className="surface scan-category-section">
            <div className="scan-section-heading">
              <div>
                <h2>영역별 점수</h2>
                <p>기획서의 7개 영역, 총 100점 배점입니다.</p>
              </div>
              <span>측정 범위 {scoreSummary.coverage}%</span>
            </div>

            <div className="scan-category-grid">
              {scoreSummary.categories.map((category) => (
                <article
                  className="scan-category-card"
                  key={category.category}
                >
                  <div>
                    <strong>{category.category}</strong>
                    <span>
                      {category.score}/{category.maxScore}점
                    </span>
                  </div>
                  <div
                    className="scan-category-bar"
                    role="progressbar"
                    aria-label={`${category.category} 점수`}
                    aria-valuemin={0}
                    aria-valuemax={category.maxScore}
                    aria-valuenow={category.score}
                  >
                    <span
                      style={{
                        width: `${category.percentage}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>

            {scoreSummary.cap !== null ? (
              <p className="scan-cap-notice">
                치명적 조건으로 최종 점수가 {scoreSummary.cap}점
                이하로 제한되었습니다.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="surface scan-legacy-notice">
            이 결과는 이전 규칙 버전으로 생성되어 점수가 없습니다.
            새 간편검사를 실행하면 현재 규칙으로 점수를 계산합니다.
          </section>
        )}

        <section className="surface scan-understanding-section">
          <div className="scan-section-heading">
            <div>
              <h2>AI가 읽은 사이트</h2>
              <p>
                LLM의 추측이 아니라 저장된 초기 HTML 증거를
                요약했습니다.
              </p>
            </div>
          </div>
          <p className="scan-understanding-text">
            {result.understandingSummary}
          </p>

          <div className="scan-information-grid">
            <div>
              <h3>찾은 정보</h3>
              {result.foundInformation.length > 0 ? (
                <dl className="scan-information-list">
                  {result.foundInformation.map((item) => (
                    <div key={`${item.label}-${item.value}`}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>표시할 핵심정보가 없습니다.</p>
              )}
            </div>

            <div>
              <h3>찾지 못했거나 확인하지 못한 정보</h3>
              {result.missingInformation.length > 0 ? (
                <ul className="scan-missing-list">
                  {result.missingInformation.map((item) => (
                    <li key={item.ruleCode}>
                      <a href={`#${findingAnchor(item.ruleCode)}`}>
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>현재 가중 규칙에서 누락된 항목이 없습니다.</p>
              )}
            </div>
          </div>
        </section>



        {renderedDomComparison ? (
          <section className="surface scan-rendered-section">
            <div className="scan-section-heading">
              <div>
                <h2>초기 HTML vs JavaScript 렌더링</h2>
                <p>
                  브라우저에서 JavaScript를 실행한 뒤 실제 DOM이
                  얼마나 확장되는지 비교했습니다.
                </p>
              </div>
              <span
                className={`scan-rendered-status scan-rendered-status-${renderedDomComparison.status.toLowerCase()}`}
              >
                {renderedDomComparison.status === "SUCCESS"
                  ? "렌더링 성공"
                  : renderedDomComparison.status === "FAILED"
                    ? "렌더링 실패"
                    : "렌더링 미실행"}
              </span>
            </div>

            {renderedDomComparison.status === "SUCCESS" ? (
              <>
                <div className="scan-rendered-grid">
                  {[
                    {
                      label: "본문 글자 수",
                      metric: renderedDomComparison.textLength,
                      suffix: "자",
                    },
                    {
                      label: "내부 링크",
                      metric: renderedDomComparison.internalLinks,
                      suffix: "개",
                    },
                    {
                      label: "H1",
                      metric: renderedDomComparison.h1Count,
                      suffix: "개",
                    },
                    {
                      label: "H2",
                      metric: renderedDomComparison.h2Count,
                      suffix: "개",
                    },
                    {
                      label: "유효 JSON-LD",
                      metric:
                        renderedDomComparison.jsonLdValidCount,
                      suffix: "개",
                    },
                  ].map((item) => (
                    <article
                      className="scan-rendered-card"
                      key={item.label}
                    >
                      <h3>{item.label}</h3>
                      <div className="scan-rendered-values">
                        <div>
                          <span>초기 HTML</span>
                          <strong>
                            {metricValue(
                              item.metric.initial,
                              item.suffix,
                            )}
                          </strong>
                        </div>
                        <b aria-hidden="true">→</b>
                        <div>
                          <span>렌더링 DOM</span>
                          <strong>
                            {metricValue(
                              item.metric.rendered,
                              item.suffix,
                            )}
                          </strong>
                        </div>
                      </div>
                      <p>
                        {metricDelta(
                          item.metric.delta,
                          item.suffix,
                        )}
                      </p>
                    </article>
                  ))}
                </div>

                <dl className="scan-rendered-meta">
                  <div>
                    <dt>브라우저</dt>
                    <dd>
                      {renderedDomComparison.browserVersion ??
                        "미확인"}
                    </dd>
                  </div>
                  <div>
                    <dt>렌더링 시간</dt>
                    <dd>
                      {renderedDomComparison.durationMs === null
                        ? "미확인"
                        : `${(
                            renderedDomComparison.durationMs /
                            1_000
                          ).toFixed(1)}초`}
                    </dd>
                  </div>
                  <div>
                    <dt>페이지 JavaScript 오류</dt>
                    <dd>
                      {metricValue(
                        renderedDomComparison.pageErrorCount,
                        "건",
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="scan-rendered-improvements">
                  <div>
                    <p className="eyebrow">RENDERING SUMMARY</p>
                    <h3>초기 HTML·JavaScript 렌더링 비교 총평</h3>
                    <p>
                      위 비교 수치가 뜻하는 바와 필요한 경우의
                      개선 방향을 함께 설명합니다.
                    </p>
                  </div>

                  {renderedImprovementPlans.length > 0 ? (
                    <div className="scan-rendered-improvement-list">
                      {renderedImprovementPlans.map((plan) => (
                        <article
                          className={`scan-rendered-improvement-card${
                            selectedRenderedImprovementCodes.includes(
                              plan.code,
                            )
                              ? " scan-rendered-improvement-selected"
                              : ""
                          }`}
                          key={plan.code}
                        >
                          <div className="scan-rendered-improvement-header">
                            <h4>{plan.title}</h4>
                            <label className="scan-rendered-improvement-select">
                              <input
                                type="checkbox"
                                checked={selectedRenderedImprovementCodes.includes(
                                  plan.code,
                                )}
                                onChange={(event) =>
                                  toggleRenderedImprovement(
                                    plan.code,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>작업지시서에 포함</span>
                            </label>
                          </div>

                          <div className="scan-rendered-explanation">
                            <section>
                              <strong>현재 어떤 상태인가요?</strong>
                              <p>{plan.currentState}</p>
                            </section>
                            <section>
                              <strong>무슨 뜻인가요?</strong>
                              <p>{plan.meaning}</p>
                            </section>
                            <section>
                              <strong>개선 방향 요약</strong>
                              <p>
                                {publicRenderedPlanChange(
                                  plan.code,
                                  plan.change,
                                )}
                              </p>
                            </section>
                          </div>

                          <div className="scan-rendered-action-grid">
                            <section>
                              <h5>진단 보고서 제공 범위</h5>
                              <p>
                                이 보고서는 현재 상태, 영향, 개선 방향만
                                요약합니다. 세부 구현 순서와 완료 기준은
                                작업지시서에서 제공합니다.
                              </p>
                            </section>
                            <section>
                              <h5>다음 단계</h5>
                              <p>
                                선택한 개선안을 작업지시서에 포함하면
                                개발자 전달 문구, 완료 판정 기준, 회귀 방지
                                기준을 확인할 수 있습니다.
                              </p>
                            </section>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="scan-rendered-no-improvement">
                      초기 HTML과 화면 완성 후의 핵심 구조가
                      비교적 비슷합니다. 현재 비교 결과에서 별도
                      개선안이 생성되지 않았습니다.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="scan-rendered-failure" role="status">
                <strong>
                  {renderedDomComparison.errorCode ??
                    renderedDomComparison.status}
                </strong>
                <p>
                  {renderedDomComparison.message ??
                    "JavaScript 렌더링 비교 증거를 생성하지 못했습니다."}
                </p>
              </div>
            )}

            <p className="scan-rendered-note">
              Site AI Score는 처음 전달되는 초기 HTML을
              기준으로 점수를 계산합니다. JavaScript 렌더링
              결과는 추가 콘텐츠를 읽을 수 있는 AI 환경까지
              고려해 위 비교 총평과 필요한 개선 제안을 만드는 데 활용합니다.
            </p>
          </section>
        ) : null}

        <section className="surface scan-issues-section">
          <div className="scan-section-heading">
            <div>
              <h2>주요 문제</h2>
              <p>
                배점과 중요도를 기준으로 먼저 확인할 항목입니다.
              </p>
            </div>
            {scoreSummary ? (
              <span>
                예상 개선 범위 +{scoreSummary.expectedImprovementMin}~
                {scoreSummary.expectedImprovementMax}점
              </span>
            ) : null}
          </div>

          <div
            className="scan-finding-guide"
            role="note"
            aria-label="진단 배지 안내"
          >
            <strong>진단 배지 읽는 법</strong>
            <dl>
              <div>
                <dt>판정</dt>
                <dd>
                  통과·실패·확인 불가 등 실제 검사 결과입니다.
                </dd>
              </div>
              <div>
                <dt>중요도</dt>
                <dd>
                  참고·낮음·주의·높음·매우 높음 순으로 해결
                  우선순위를 나타냅니다.
                </dd>
              </div>
              <div>
                <dt>점수 영향</dt>
                <dd>
                  통과한 항목은 배점, 실패·확인 불가 항목은
                  감점으로 표시합니다.
                </dd>
              </div>
            </dl>
          </div>

          {result.primaryIssues.length > 0 ? (
            <div className="scan-issue-list">
              {result.primaryIssues.map((finding) => (
                <FindingCard
                  finding={finding}
                  key={finding.id}
                  primary
                  selectable={finding.weight > 0}
                  selected={selectedFindingIds.includes(finding.id)}
                  onToggle={toggleWorkOrderFinding}
                />
              ))}
            </div>
          ) : (
            <p className="scan-empty-message">
              주요 문제로 분류된 항목이 없습니다.
            </p>
          )}

          <p className="scan-improvement-disclaimer">
            예상 개선 범위는 현재 규칙 배점 기준이며 실제 점수 상승을
            보장하지 않습니다. 재검사 시 동일 규칙 버전과 조건으로
            확인합니다.
          </p>

          <div className="work-order-selection" role="note">
            <strong>작업지시서는 선택 기능입니다</strong>
            <p>
              PDF 보고서 저장과는 별개입니다. 사이트 수정을 맡기거나
              진행 상황을 관리할 때 주요 문제와 AI 수집 개선안을
              선택해 작업지시서 1건으로 만들 수 있습니다. 현재{" "}
              {selectedWorkOrderItemCount}개 항목이 선택되어 있습니다.
            </p>
          </div>

          {workOrderError ? (
            <p className="work-order-message work-order-error" role="alert">
              {workOrderError}
            </p>
          ) : null}

        </section>

        <section className="scan-all-findings">
          <div className="scan-section-heading">
            <div>
              <h2>전체 진단 항목</h2>
              <p>통과·실패·확인 불가·감점 제외를 모두 표시합니다.</p>
            </div>
            <span>{result.findings.length}개</span>
          </div>

          {groupedFindings.map(([category, findings]) => (
            <div className="scan-finding-group" key={category}>
              <h3>{category}</h3>
              <div className="scan-finding-list">
                {findings.map((finding) => (
                  <FindingCard
                    finding={finding}
                    key={finding.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="surface scan-page-section">
          <div className="scan-section-heading">
            <div>
              <h2>수집 페이지</h2>
              <p>원본 HTML은 저장하지 않고 해시와 측정값만 보관합니다.</p>
            </div>
          </div>
          <div className="scan-page-list">
            {result.pages.map((page) => (
              <dl key={page.id}>
                <div>
                  <dt>검사 URL</dt>
                  <dd>{page.url}</dd>
                </div>
                <div>
                  <dt>최종 URL</dt>
                  <dd>{page.finalUrl ?? "미확인"}</dd>
                </div>
                <div>
                  <dt>HTTP</dt>
                  <dd>{page.statusCode ?? "미확인"}</dd>
                </div>
                <div>
                  <dt>초기 텍스트</dt>
                  <dd>
                    {page.initialTextLength?.toLocaleString("ko-KR") ??
                      "미확인"}
                    자
                  </dd>
                </div>
                <div>
                  <dt>iframe</dt>
                  <dd>{page.iframeCount ?? "미확인"}개</dd>
                </div>
                <div>
                  <dt>HTML SHA-256</dt>
                  <dd className="scan-hash">
                    {page.rawHtmlHash ?? "미저장"}
                  </dd>
                </div>
              </dl>
            ))}
          </div>
        </section>
        {result.contentReadiness ? (
          <section className="surface scan-content-readiness-section">
            <div className="scan-section-heading">
              <div>
                <h2>AI 답변을 위한 추가 콘텐츠 제안</h2>
                <p>
                  현재 QUICK 점수와 별개로, AI가 더 구체적인
                  질문에 답하는 데 도움이 될 추가 콘텐츠를 안내합니다.
                </p>
              </div>
              <span
                className={`scan-content-readiness-status scan-content-readiness-status-${result.contentReadiness.status.toLowerCase()}`}
              >
                점수 외 참고
              </span>
            </div>

            <p className="scan-content-readiness-summary">
              이 영역은 자동진단 점수와 별개로 제공되는 추가 콘텐츠
              가이드입니다. 자동검사만으로 사실 여부를 확정하기 어려운
              이용 대상, 활용 사례, 이용 절차, 지원 범위, 요금·자료
              처리·운영 주체, 자주 묻는 질문 등을 사이트 운영자가
              선택적으로 보완하면 AI가 사이트를 바탕으로 더 구체적인
              질문에 답하는 데 도움이 될 수 있습니다. 이 제안은 감점이나
              미완료 판정이 아닙니다.
            </p>

            <div className="scan-content-readiness-guide" role="note">
              <strong>이 제안의 활용 방법</strong>
              <p>{result.contentReadiness.benchmarkNote}</p>
              <p>{result.contentReadiness.disclaimer}</p>
            </div>

            <div className="scan-content-readiness-signals">
              <h3>자동검사에서 확인한 참고 단서</h3>
              <ul>
                {result.contentReadiness.confirmedSignals.map(
                  (signal) => (
                    <li key={signal}>{signal}</li>
                  ),
                )}
              </ul>
            </div>

            <div className="scan-content-topic-grid">
              {result.contentReadiness.topics.map((topic, index) => (
                <article className="scan-content-topic" key={topic.code}>
                  <div className="scan-content-topic-header">
                    <div>
                      <span>보완 주제 {index + 1}</span>
                      <h3>{topic.title}</h3>
                    </div>
                    <b>
                      {topic.status === "PARTIAL"
                        ? "관련 단서 일부 확인"
                        : "추가 정보 제안"}
                    </b>
                  </div>
                  <p>{topic.reason}</p>

                  <div className="scan-content-topic-detail">
                    <strong>AI가 답하기 어려울 수 있는 질문</strong>
                    <ul>
                      {topic.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="scan-content-topic-detail">
                    <strong>추가 권장 섹션</strong>
                    <p>{topic.suggestedSections.join(" · ")}</p>
                  </div>

                  <div className="scan-content-topic-instructions">
                    <div>
                      <strong>사이트 운영자</strong>
                      <p>{topic.contentWriterInstruction}</p>
                    </div>
                    <div>
                      <strong>개발자 참고</strong>
                      <p>상세 개발 반영 방법은 수정 작업지시서에서 제공합니다.</p>
                    </div>
                  </div>

                  <details>
                    <summary>보완 체크포인트</summary>
                    <p>
                        상세 보완 체크포인트와 완료 기준은 수정
                        작업지시서에서 제공합니다.
                      </p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        ) : null}

      </div>
    </section>
  );
}

function FindingCard({
  finding,
  primary = false,
  selectable = false,
  selected = false,
  onToggle,
}: {
  finding: ScanResultFinding;
  primary?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (findingId: string, checked: boolean) => void;
}) {
  return (
    <article
      className={`scan-finding-card scan-status-${finding.status.toLowerCase()}${
        primary ? " scan-finding-primary" : ""
      }`}
      id={findingAnchor(finding.ruleCode)}
    >
      <div className="scan-finding-header">
        <div>
          <span>{finding.ruleCode}</span>
          <h4>{finding.title}</h4>
        </div>
        <div
          className="scan-finding-badges"
          aria-label="진단 판정과 점수 영향"
        >
          <span
            className={`scan-badge scan-badge-status scan-badge-status-${finding.status.toLowerCase()}`}
            title={`판정: ${statusLabels[finding.status]}`}
          >
            판정 · {statusLabels[finding.status]}
          </span>
          <span
            className={`scan-badge scan-badge-severity scan-badge-severity-${finding.severity.toLowerCase()}`}
            title={severityDescriptions[finding.severity]}
          >
            중요도 · {severityLabels[finding.severity]}
          </span>
          <span
            className={`scan-badge scan-badge-points ${
              finding.weight <= 0 || finding.status === "NA"
                ? "scan-badge-points-none"
                : finding.status === "PASS"
                  ? "scan-badge-points-earned"
                  : "scan-badge-points-lost"
            }`}
            title={pointImpactDescription(finding)}
          >
            {pointImpactLabel(finding)}
          </span>
        </div>
      </div>

      {selectable ? (
        <label className="work-order-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) =>
              onToggle?.(finding.id, event.target.checked)
            }
          />
          작업지시서에 포함
        </label>
      ) : null}

      <p>{finding.description}</p>

      {finding.recommendation ? (
        <div className="scan-recommendation">
          <strong>수정 권장사항</strong>
          <p>{finding.recommendation}</p>
        </div>
      ) : null}

      <details>
        <summary>검사 증거 보기</summary>
        <pre>{evidenceText(finding.evidence)}</pre>
      </details>
    </article>
  );
}
