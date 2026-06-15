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
    if (!result || selectedFindingIds.length === 0) {
      setWorkOrderError(
        "작업지시서에 포함할 주요 문제를 1개 이상 선택해 주세요.",
      );
      return;
    }

    setCreatingWorkOrder(true);
    setWorkOrderError("");

    try {
      const workOrder = await createWorkOrderRequest({
        scanId: result.scan.id,
        findingIds: selectedFindingIds,
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

  const groupedFindings = useMemo(() => {
    const groups = new Map<string, ScanResultFinding[]>();

    for (const finding of result?.findings ?? []) {
      const values = groups.get(finding.category) ?? [];
      values.push(finding);
      groups.set(finding.category, values);
    }

    return [...groups.entries()];
  }, [result]);

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
              계산한 규칙 기반 점수입니다.
            </p>
          </div>
          <Link className="scan-result-back" to={`/${locale}/sites`}>
            사이트 관리로
          </Link>
        </header>

        <div className="scan-result-scope" role="note">
          현재 점수는 QUICK 초기 HTML 진단 범위입니다. JavaScript 실행
          후 DOM·모바일/PC 비교·업종별 기준정보·질문 정답률은 정밀진단
          단계에서 추가됩니다.
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
              <p>LLM의 추측이 아니라 저장된 HTML 증거를 요약했습니다.</p>
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
            <strong>작업지시서 대상 선택</strong>
            <p>
              주요 문제 카드에서 포함할 항목을 선택했습니다. 현재{" "}
              {selectedFindingIds.length}개 항목이 선택되어 있습니다.
            </p>
          </div>

          {workOrderError ? (
            <p className="work-order-message work-order-error" role="alert">
              {workOrderError}
            </p>
          ) : null}

          <div className="scan-result-actions">
            <button
              className="work-order-create-button"
              type="button"
              onClick={handleCreateWorkOrder}
              disabled={
                creatingWorkOrder ||
                selectedFindingIds.length === 0
              }
            >
              {creatingWorkOrder
                ? "작업지시서 생성 중..."
                : `작업지시서 만들기 · ${selectedFindingIds.length}개`}
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
