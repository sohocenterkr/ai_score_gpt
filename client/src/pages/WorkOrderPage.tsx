import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelWorkOrderRequest,
  getWorkOrderRequest,
  issueWorkOrderRequest,
  reviseWorkOrderRequest,
  submitVerificationRequest,
  workOrderExportUrl,
  WorkOrderApiError,
  type WorkOrderDetail,
} from "../work-orders/work-order-api";
import "../work-orders.css";

const verificationStatusLabels: Record<string, string> = {
  QUEUED: "검사 대기",
  RUNNING: "검사 중",
  EVALUATING: "완료 기준 판정 준비",
  PASSED: "통과",
  REWORK_REQUIRED: "재작업 필요",
  FAILED: "검사 실패",
};

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  ISSUED: "발급",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업 중",
  PENDING: "대기",
  REVIEW_REQUIRED: "수동 확인 필요",
  COMPLETED: "완료",
  NOT_APPLICABLE: "해당 없음",
  SUBMITTED: "제출",
  VERIFYING: "검수 중",
  REWORK_REQUIRED: "재작업 필요",
  PASSED: "통과",
  CANCELLED: "취소",
};

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

function evidenceText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const verificationItemStatusLabels: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NOT_APPLICABLE: "해당 없음",
};

function verificationStatusClass(status: string): string {
  return status.toLowerCase().replaceAll("_", "-");
}

function verificationCriteria(
  value: unknown,
): Array<{
  code: string;
  label: string;
  required: boolean;
  status: string;
  automated: boolean;
  message: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return [];
    }

    const record = item as Record<string, unknown>;

    if (
      typeof record.code !== "string" ||
      typeof record.label !== "string" ||
      typeof record.status !== "string"
    ) {
      return [];
    }

    return [
      {
        code: record.code,
        label: record.label,
        required: record.required !== false,
        status: record.status,
        automated: record.automated !== false,
        message:
          typeof record.message === "string"
            ? record.message
            : "",
      },
    ];
  });
}

export function WorkOrderPage() {
  const { locale = "ko", workOrderId = "" } = useParams();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] =
    useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [submittingVerification, setSubmittingVerification] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!workOrderId) {
      setErrorMessage("작업지시서 번호가 없습니다.");
      setLoading(false);
      return;
    }

    void getWorkOrderRequest(workOrderId)
      .then((value) => {
        if (!cancelled) {
          setWorkOrder(value);
          setSubmittedUrl(
            value.site.finalUrl ?? value.site.baseUrl,
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof WorkOrderApiError
              ? error.message
              : "작업지시서를 불러오지 못했습니다.",
          );
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
  }, [workOrderId]);

  useEffect(() => {
    if (
      !workOrderId ||
      workOrder?.status !== "VERIFYING"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void getWorkOrderRequest(workOrderId)
        .then((value) => {
          setWorkOrder(value);
        })
        .catch(() => {
          // 일시적인 갱신 실패는 기존 화면을 유지합니다.
        });
    }, 2_000);

    return () => window.clearInterval(timer);
  }, [workOrderId, workOrder?.status]);

  async function runAction(
    action: () => Promise<WorkOrderDetail>,
    successMessage: string,
  ) {
    setWorking(true);
    setErrorMessage("");
    setMessage("");

    try {
      const value = await action();
      setWorkOrder(value);
      setMessage(successMessage);
      return value;
    } catch (error) {
      setErrorMessage(
        error instanceof WorkOrderApiError
          ? error.message
          : "요청을 처리하지 못했습니다.",
      );
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function handleIssue() {
    if (!workOrder) return;
    await runAction(
      () => issueWorkOrderRequest(workOrder.id),
      "작업지시서를 발급 상태로 변경했습니다.",
    );
  }

  async function handleSubmitVerification() {
    if (!workOrder) return;

    setSubmittingVerification(true);
    setErrorMessage("");
    setMessage("");

    try {
      const value = await submitVerificationRequest(
        workOrder.id,
        submittedUrl,
      );
      setWorkOrder(value);
      setMessage(
        "수정된 공개 URL을 접수했습니다. 자동 검사를 시작합니다.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof WorkOrderApiError
          ? error.message
          : "수정 URL을 접수하지 못했습니다.",
      );
    } finally {
      setSubmittingVerification(false);
    }
  }

  async function handleRevise() {
    if (!workOrder) return;
    const revised = await runAction(
      () => reviseWorkOrderRequest(workOrder.id),
      "새 버전을 만들었습니다.",
    );

    if (revised) {
      navigate(`/${locale}/work-orders/${revised.id}`, {
        replace: true,
      });
    }
  }

  async function handleCancel() {
    if (!workOrder) return;
    setWorking(true);
    setErrorMessage("");

    try {
      await cancelWorkOrderRequest(workOrder.id);
      setWorkOrder({
        ...workOrder,
        status: "CANCELLED",
      });
      setMessage("작업지시서 초안을 취소했습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof WorkOrderApiError
          ? error.message
          : "작업지시서를 취소하지 못했습니다.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <section className="full-bleed-section work-orders-section">
        <div className="content-container work-order-empty" role="status">
          작업지시서를 불러오고 있습니다.
        </div>
      </section>
    );
  }

  if (!workOrder) {
    return (
      <section className="full-bleed-section work-orders-section">
        <div className="content-container work-order-empty">
          <p role="alert">{errorMessage || "작업지시서가 없습니다."}</p>
          <Link to={`/${locale}/work-orders`}>목록으로 돌아가기</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="full-bleed-section work-orders-section">
      <div className="content-container work-order-detail-content">
        <header className="work-orders-heading">
          <div>
            <p className="eyebrow">WORK ORDER</p>
            <h1>{workOrder.site.name} 수정 작업지시서</h1>
            <p>
              {workOrder.orderNumber} · v{workOrder.version} ·{" "}
              {statusLabels[workOrder.status] ?? workOrder.status}
            </p>
          </div>
          <Link className="work-order-back" to={`/${locale}/work-orders`}>
            작업지시서 목록
          </Link>
        </header>

        {message ? (
          <p className="work-order-message work-order-success" role="status">
            {message}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="work-order-message work-order-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="work-order-toolbar">
          {workOrder.status === "DRAFT" ? (
            <>
              <button
                type="button"
                onClick={handleIssue}
                disabled={working}
              >
                {working ? "처리 중..." : "작업지시서 발급"}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={handleCancel}
                disabled={working}
              >
                초안 취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleRevise}
              disabled={
                working || workOrder.status === "CANCELLED"
              }
            >
              새 버전 만들기
            </button>
          )}
          <a
            className="secondary"
            href={workOrderExportUrl(workOrder.id, "json")}
          >
            JSON 저장
          </a>
          <a
            className="secondary"
            href={workOrderExportUrl(workOrder.id, "csv")}
          >
            CSV 저장
          </a>
          <a
            className="secondary"
            href={workOrderExportUrl(workOrder.id, "pdf")}
          >
            PDF 저장
          </a>
        </div>

        <section className="surface work-order-overview">
          <div className="work-order-score-range">
            <span>현재 점수</span>
            <strong>{workOrder.scoreBefore ?? "—"}</strong>
            <small>{workOrder.gradeBefore ?? "미계산"}</small>
          </div>
          <div className="work-order-arrow" aria-hidden="true">
            →
          </div>
          <div className="work-order-score-range expected">
            <span>예상 점수 범위</span>
            <strong>
              {workOrder.expectedScoreMin}~
              {workOrder.expectedScoreMax}
            </strong>
            <small>보장값이 아닌 규칙 배점 기준</small>
          </div>
          <dl>
            <div>
              <dt>규칙 버전</dt>
              <dd>{workOrder.rulesVersion}</dd>
            </div>
            <div>
              <dt>발급 시각(KST)</dt>
              <dd>{formatKST(workOrder.issuedAt)}</dd>
            </div>
            <div>
              <dt>검사 URL</dt>
              <dd>
                <a
                  href={
                    workOrder.site.finalUrl ??
                    workOrder.site.baseUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {workOrder.site.finalUrl ??
                    workOrder.site.baseUrl}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface work-order-verification">
          <div className="work-order-verification-heading">
            <div>
              <p className="eyebrow">AUTOMATIC VERIFICATION</p>
              <h2>수정된 공개 URL 자동검수</h2>
              <p>
                개발자가 수정 사항을 배포한 뒤 공개 URL을 제출하면
                원래 사이트 주소를 바꾸지 않고 별도의 검수 검사로
                확인합니다.
              </p>
            </div>
            {workOrder.status === "VERIFYING" ? (
              <span className="work-order-verification-live">
                자동검수 진행 중
              </span>
            ) : null}
          </div>

          {[
            "ISSUED",
            "ASSIGNED",
            "IN_PROGRESS",
            "SUBMITTED",
            "REWORK_REQUIRED",
          ].includes(workOrder.status) ? (
            <form
              className="work-order-verification-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitVerification();
              }}
            >
              <label htmlFor="verification-url">
                수정 사항이 배포된 공개 URL
              </label>
              <div>
                <input
                  id="verification-url"
                  type="url"
                  value={submittedUrl}
                  onChange={(event) =>
                    setSubmittedUrl(event.target.value)
                  }
                  placeholder="https://example.com/updated-page"
                  required
                  maxLength={2048}
                  disabled={submittingVerification}
                />
                <button
                  type="submit"
                  disabled={
                    submittingVerification ||
                    submittedUrl.trim().length === 0
                  }
                >
                  {submittingVerification
                    ? "검수 요청 중..."
                    : "수정 URL 제출 및 자동검수"}
                </button>
              </div>
              <small>
                로그인이나 사내망 없이 외부에서 접속 가능한 HTTP(S)
                주소만 제출할 수 있습니다.
              </small>
            </form>
          ) : workOrder.status === "DRAFT" ? (
            <p className="work-order-verification-notice">
              작업지시서를 먼저 발급하면 수정된 URL을 제출할 수
              있습니다.
            </p>
          ) : workOrder.status === "VERIFYING" ? (
            <p className="work-order-verification-notice">
              현재 제출된 URL을 검사하고 있습니다. 이 화면은 자동으로
              상태를 갱신합니다.
            </p>
          ) : null}

          {workOrder.verificationAttempts.length > 0 ? (
            <div className="work-order-verification-history">
              <h3>검수 요청 이력</h3>
              <ol>
                {workOrder.verificationAttempts.map((attempt) => {
                  const passCount = attempt.itemResults.filter(
                    (result) => result.status === "PASS",
                  ).length;
                  const failCount = attempt.itemResults.filter(
                    (result) => result.status === "FAIL",
                  ).length;
                  const blockedCount = attempt.itemResults.filter(
                    (result) => result.status === "BLOCKED",
                  ).length;
                  const notApplicableCount =
                    attempt.itemResults.filter(
                      (result) =>
                        result.status === "NOT_APPLICABLE",
                    ).length;

                  return (
                    <li key={attempt.id}>
                      <div>
                        <strong>
                          {attempt.attemptNumber}차 검수
                        </strong>
                        <span
                          className={`verification-attempt-status verification-attempt-status-${verificationStatusClass(
                            attempt.status,
                          )}`}
                        >
                          {verificationStatusLabels[attempt.status] ??
                            attempt.status}
                        </span>
                      </div>
                      <a
                        href={attempt.submittedUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attempt.submittedUrl}
                      </a>
                      <dl>
                        <div>
                          <dt>요청 시각</dt>
                          <dd>{formatKST(attempt.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>검사 상태</dt>
                          <dd>
                            {statusLabels[attempt.scan.status] ??
                              attempt.scan.status}
                          </dd>
                        </div>
                        <div>
                          <dt>검사 후 점수</dt>
                          <dd>
                            {attempt.scoreAfter ?? "—"}{" "}
                            {attempt.gradeAfter ?? ""}
                          </dd>
                        </div>
                      </dl>

                      {attempt.itemResults.length > 0 ? (
                        <div className="verification-result-summary">
                          <strong>항목별 자동검수 결과</strong>
                          <div>
                            <span className="verification-count-pass">
                              통과 {passCount}
                            </span>
                            <span className="verification-count-fail">
                              실패 {failCount}
                            </span>
                            <span className="verification-count-blocked">
                              확인 불가 {blockedCount}
                            </span>
                            <span className="verification-count-na">
                              해당 없음 {notApplicableCount}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {attempt.itemResults.length > 0 ? (
                        <div className="verification-item-results">
                          {attempt.itemResults.map((result) => {
                            const item = workOrder.items.find(
                              (candidate) =>
                                candidate.id ===
                                result.workOrderItemId,
                            );
                            const criterionResults =
                              verificationCriteria(
                                result.criteriaResults,
                              );

                            return (
                              <article
                                className={`verification-item-result verification-item-result-${verificationStatusClass(
                                  result.status,
                                )}`}
                                key={result.id}
                              >
                                <header>
                                  <div>
                                    <span>
                                      {item?.itemCode ??
                                        result.workOrderItemId}
                                    </span>
                                    <h4>
                                      {item?.title ??
                                        "작업 항목 검수 결과"}
                                    </h4>
                                  </div>
                                  <b>
                                    {verificationItemStatusLabels[
                                      result.status
                                    ] ?? result.status}
                                  </b>
                                </header>

                                {result.message ? (
                                  <p className="verification-item-message">
                                    {result.message}
                                  </p>
                                ) : null}

                                {criterionResults.length > 0 ? (
                                  <div className="verification-criteria-results">
                                    <strong>완료 기준별 판정</strong>
                                    <ul>
                                      {criterionResults.map(
                                        (criterion) => (
                                          <li
                                            className={`verification-criterion verification-criterion-${verificationStatusClass(
                                              criterion.status,
                                            )}`}
                                            key={criterion.code}
                                          >
                                            <div>
                                              <span>
                                                {criterion.code}
                                              </span>
                                              <b>
                                                {verificationItemStatusLabels[
                                                  criterion.status
                                                ] ??
                                                  criterion.status}
                                              </b>
                                            </div>
                                            <p>{criterion.label}</p>
                                            {criterion.message ? (
                                              <small>
                                                {criterion.message}
                                              </small>
                                            ) : null}
                                            <em>
                                              {criterion.required
                                                ? "필수"
                                                : "권장"}
                                              {" · "}
                                              {criterion.automated
                                                ? "자동 판정"
                                                : "수동 확인"}
                                            </em>
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                ) : null}

                                {result.evidence ? (
                                  <details>
                                    <summary>
                                      자동검수 증거 보기
                                    </summary>
                                    <pre>
                                      {evidenceText(result.evidence)}
                                    </pre>
                                  </details>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      ) : attempt.status === "PASSED" ||
                        attempt.status === "REWORK_REQUIRED" ? (
                        <p className="work-order-verification-error">
                          저장된 항목별 검수 결과가 없습니다.
                        </p>
                      ) : null}

                      {attempt.errorCode ? (
                        <p className="work-order-verification-error">
                          오류 코드: {attempt.errorCode}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </section>


        <section className="work-order-items-section">
          <div className="work-order-section-heading">
            <div>
              <h2>선택한 수정 요구사항</h2>
              <p>
                소스코드가 아니라 배포된 공개 URL에서 완료 여부를
                확인합니다.
              </p>
            </div>
            <span>{workOrder.items.length}개</span>
          </div>

          <div className="work-order-items">
            {workOrder.items.map((item, index) => (
              <article className="surface work-order-item-card" key={item.id}>
                <header>
                  <div>
                    <span>
                      {String(index + 1).padStart(2, "0")} ·{" "}
                      {item.itemCode}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                  <div className="work-order-item-badges">
                    <span>
                      {item.finding
                        ? item.isRequired
                          ? "필수"
                          : "일반"
                        : "권장 개선"}
                    </span>
                    <span>
                      {item.weight > 0
                        ? `예상 ${item.weight}점`
                        : "점수 외 개선"}
                    </span>
                  </div>
                </header>

                <dl className="work-order-item-meta">
                  <div>
                    <dt>대상 URL</dt>
                    <dd>{item.targetUrl}</dd>
                  </div>
                  <div>
                    <dt>현재 판정</dt>
                    <dd>
                      {item.finding?.status ?? "추가 개선 권장"}
                    </dd>
                  </div>
                  <div>
                    <dt>중요도</dt>
                    <dd>
                      {item.finding?.severity ?? "AI 수집 안정성"}
                    </dd>
                  </div>
                </dl>

                <div className="work-order-requirement">
                  <strong>수정 요구사항</strong>
                  <p>{item.requirement}</p>
                </div>

                <div className="work-order-developer-message">
                  <strong>개발자 전달용 문구</strong>
                  <p>{item.developerMessage}</p>
                </div>

                <div className="work-order-criteria">
                  <strong>완료 판정 기준</strong>
                  <ul>
                    {item.acceptanceCriteria.map((criterion) => (
                      <li key={criterion.code}>
                        <span>{criterion.code}</span>
                        <p>{criterion.label}</p>
                        <em>
                          {criterion.required ? "필수" : "권장"}
                        </em>
                      </li>
                    ))}
                  </ul>
                </div>

                {item.finding ? (
                  <details>
                    <summary>최초 검사 증거 보기</summary>
                    <pre>{evidenceText(item.finding.evidence)}</pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <p className="work-order-disclaimer">
          예상 점수 범위는 선택한 점수 규칙의 배점만을 기준으로
          계산한 참고값입니다. 점수 외 AI 수집 개선안은 예상 점수에
          포함되지 않으며 실제 상승 폭이나 AI 검색 노출은 보장되지
          않습니다.
        </p>
      </div>
    </section>
  );
}
