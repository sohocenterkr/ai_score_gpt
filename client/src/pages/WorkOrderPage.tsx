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

function formatKST(value: string | null, isEnglish = false): string {
  if (!value) {
    return isEnglish ? "No record" : "기록 없음";
  }

  return new Intl.DateTimeFormat(isEnglish ? "en-US" : "ko-KR", {
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
  const isEnglish = locale === "en";
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
              : isEnglish ? "Could not load the work order." : "작업지시서를 불러오지 못했습니다.",
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
      isEnglish ? "The work order has been issued." : "작업지시서를 발급 상태로 변경했습니다.",
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
        isEnglish ? "The public URL has been submitted. Verification has started." : "공개 URL을 접수했습니다. 검수를 시작합니다.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof WorkOrderApiError
          ? error.message
          : isEnglish ? "Could not submit the updated URL." : "수정 URL을 접수하지 못했습니다.",
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
          : isEnglish ? "Could not cancel the work order." : "작업지시서를 취소하지 못했습니다.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <section className="full-bleed-section work-orders-section">
        <div className="content-container work-order-empty" role="status">
          {isEnglish ? "Loading the work order." : "작업지시서를 불러오고 있습니다."}
        </div>
      </section>
    );
  }

  if (!workOrder) {
    return (
      <section className="full-bleed-section work-orders-section">
        <div className="content-container work-order-empty">
          <p role="alert">{errorMessage || (isEnglish ? "Work order not found." : "작업지시서가 없습니다.")}</p>
          <Link to={`/${locale}/work-orders`}>{isEnglish ? "Back to list" : "목록으로 돌아가기"}</Link>
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
            <h1>{isEnglish ? `${workOrder.site.name} Improvement Work Order` : `${workOrder.site.name} 수정 작업지시서`}</h1>
            <p>
              {workOrder.orderNumber} · v{workOrder.version}
            </p>
          </div>
          <Link className="work-order-back" to={`/${locale}/work-orders`}>
              {isEnglish ? "Work order list" : "작업지시서 목록"}
          </Link>
        </header>

        {message && !(message.startsWith("공개 URL") || message.startsWith("The public URL")) ? (
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
                {working ? (isEnglish ? "Processing..." : "처리 중...") : isEnglish ? "Issue work order" : "작업지시서 발급"}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={handleCancel}
                disabled={working}
              >
                {isEnglish ? "Cancel draft" : "초안 취소"}
              </button>
            </>
          ) : (
            <>
              <a
                className="work-order-primary-link"
                href={`${workOrderExportUrl(workOrder.id, "pdf")}${isEnglish ? "?locale=en" : ""}`}
              >
                  {isEnglish ? "Save PDF" : "PDF 저장"}
                </a>
              <a
                className="secondary"
                href={`${workOrderExportUrl(workOrder.id, "json")}${isEnglish ? "?locale=en" : ""}`}
              >
                  {isEnglish ? "Save JSON" : "JSON 저장"}
                </a>
              <a
                className="secondary"
                href={`${workOrderExportUrl(workOrder.id, "csv")}${isEnglish ? "?locale=en" : ""}`}
              >
                  {isEnglish ? "Save CSV" : "CSV 저장"}
                </a>
            </>
          )}
        </div>

        {workOrder.status !== "DRAFT" ? (
          <div className="work-order-process-guide" role="note">
            <strong>{isEnglish ? "Current step: update the site using this work order" : "현재 단계: 작업지시서로 사이트 수정 진행"}</strong>
              <p>
                {isEnglish
                  ? "Save this document as a PDF or send it to the developer to update the site. After deployment, submit the public URL below to verify whether the work was applied."
                  : "이 문서를 PDF로 저장하거나 개발자에게 전달해 사이트 수정을 진행하세요. 수정 사항을 배포한 뒤 아래 자동검수 영역에 공개 URL을 제출하면 작업 반영 여부를 확인할 수 있습니다."}
              </p>
          </div>
        ) : null}

          <section className="surface work-order-overview">
            {(() => {
              const latestScoredVerificationAttempt =
                workOrder.verificationAttempts.find(
                  (attempt) => attempt.scoreAfter !== null,
                );

              return latestScoredVerificationAttempt ? (
                <>
                  <div className="work-order-score-comparison">
                    <div className="work-order-score-card">
                      <span>{isEnglish ? "Initial score" : "1차 점수"}</span>
                      <strong>{workOrder.scoreBefore ?? "—"}</strong>
                      <small>{isEnglish ? "Initial diagnostic completed" : "1차 검수완료"}</small>
                    </div>

                    <dl className="work-order-score-comparison-meta">
                      <div>
                        <dt>{isEnglish ? "Initial rules version" : "1차 규칙 버전"}</dt>
                        <dd>{workOrder.initialScan.rulesVersion}</dd>
                      </div>
                      <div>
                        <dt>{isEnglish ? "Initial diagnostic completed at (KST)" : "1차 검수 완료 시각(KST)"}</dt>
                        <dd>{formatKST(workOrder.initialScan.completedAt, isEnglish)}</dd>
                      </div>
                      <div>
                        <dt>{isEnglish ? "Initial diagnostic URL" : "1차 검사 URL"}</dt>
                        <dd>
                          <a
                            href={
                              workOrder.initialScan.targetUrl ??
                              workOrder.site.finalUrl ??
                              workOrder.site.baseUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {workOrder.initialScan.targetUrl ??
                              workOrder.site.finalUrl ??
                              workOrder.site.baseUrl}
                          </a>
                        </dd>
                      </div>
                    </dl>

                    <div
                      className="work-order-score-comparison-arrow"
                      aria-hidden="true"
                    >
                      →
                    </div>

                    <div className="work-order-score-card verification">
                      <span>{isEnglish ? "Latest recheck" : "최근 재검수"}</span>
                      <strong>
                        {latestScoredVerificationAttempt.scoreAfter}
                        {latestScoredVerificationAttempt.gradeAfter ? (
                          <small>
                            {" "}
                            {latestScoredVerificationAttempt.gradeAfter}
                          </small>
                        ) : null}
                      </strong>
                      <small>
                        {isEnglish
                          ? `Verification ${latestScoredVerificationAttempt.attemptNumber + 1} completed`
                          : `${latestScoredVerificationAttempt.attemptNumber + 1}차 검수완료`}
                      </small>
                    </div>
                  </div>

                </>
              ) : (
                <>
                  <div className="work-order-score-range">
                    <span>{isEnglish ? "Initial score" : "1차 점수"}</span>
                    <strong>{workOrder.scoreBefore ?? "—"}</strong>
                    <small>{isEnglish ? "Initial diagnostic completed" : "1차 검수완료"}</small>
                  </div>
                  <div className="work-order-arrow" aria-hidden="true">
                    →
                  </div>
                  <div className="work-order-score-range expected">
                    <span>{isEnglish ? "Expected score range" : "예상 점수 범위"}</span>
                    <strong>
                      {workOrder.expectedScoreMin}~
                      {workOrder.expectedScoreMax}
                    </strong>
                    <small>{isEnglish ? "Based on rule points, not a guarantee" : "보장값이 아닌 규칙 배점 기준"}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>{isEnglish ? "Initial rules version" : "1차 규칙 버전"}</dt>
                      <dd>{workOrder.initialScan.rulesVersion}</dd>
                    </div>
                    <div>
                      <dt>{isEnglish ? "Initial diagnostic completed at (KST)" : "1차 검수 완료 시각(KST)"}</dt>
                      <dd>{formatKST(workOrder.initialScan.completedAt, isEnglish)}</dd>
                    </div>
                    <div>
                      <dt>{isEnglish ? "Initial diagnostic URL" : "1차 검사 URL"}</dt>
                      <dd>
                        <a
                          href={
                            workOrder.initialScan.targetUrl ??
                            workOrder.site.finalUrl ??
                            workOrder.site.baseUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {workOrder.initialScan.targetUrl ??
                            workOrder.site.finalUrl ??
                            workOrder.site.baseUrl}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </>
              );
            })()}
          </section>

        <section className="surface work-order-verification">
          <div className="work-order-verification-heading">
            <div>
              <p className="eyebrow">AUTOMATIC VERIFICATION</p>
              <h2>{isEnglish ? "Verify after site improvements" : "사이트 개선 후 검수진행"}</h2>
              <p>
                  {isEnglish
                    ? "After the developer updates the site, run verification again against the same public site address."
                    : "개발자가 사이트를 수정한 후 사이트 주소를 바꾸지 않고 다시한번 검수를 진행합니다."}
                </p>
            </div>
            {workOrder.status === "VERIFYING" ? (
              <span className="work-order-verification-live">
                {isEnglish ? "Automatic verification in progress" : "자동검수 진행 중"}
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
                  {isEnglish ? "Public URL" : "공개 URL"}
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
                      ? isEnglish
                        ? "Requesting verification..."
                        : "검수 요청 중..."
                      : isEnglish
                        ? "Start verification"
                        : "검수시작"}
                </button>
              </div>
              <small>
                  {isEnglish
                    ? "Only externally accessible HTTP(S) URLs can be submitted. URLs requiring login or an internal network are not supported."
                    : "로그인이나 사내망 없이 외부에서 접속 가능한 HTTP(S) 주소만 제출할 수 있습니다."}
                </small>
            </form>
          ) : workOrder.status === "DRAFT" ? (
            <p className="work-order-verification-notice">
                {isEnglish
                  ? "Issue the work order first to submit the updated URL."
                  : "작업지시서를 먼저 발급하면 수정된 URL을 제출할 수 있습니다."}
              </p>
          ) : workOrder.status === "VERIFYING" ? (
            <p className="work-order-verification-notice">
                {isEnglish
                  ? "The submitted URL is being checked. This page will refresh its status automatically."
                  : "현재 제출된 URL을 검사하고 있습니다. 이 화면은 자동으로 상태를 갱신합니다."}
              </p>
          ) : null}

          {message && (message.startsWith("공개 URL") || message.startsWith("The public URL")) ? (
            <p className="work-order-message work-order-success" role="status">
              {message}
            </p>
          ) : null}

          {workOrder.status !== "DRAFT" &&
          workOrder.status !== "CANCELLED" ? (
            <div className="work-order-revision-panel" role="note">
              <div>
                <strong>{isEnglish ? "Recheck after site updates" : "사이트 수정 후 재검수 가능"}</strong>
                <p>
                    {isEnglish
                      ? "Use rechecks after verifying the improved site, especially when the score did not improve enough or remaining issues require a follow-up work order."
                      : "재검수는 개선된 사이트를 검수한 뒤 점수가 충분히 오르지 않았거나 남은 문제가 있을 때 후속 작업지시서를 만들 때 사용합니다."}
                  </p>
              </div>
              <button
                className="secondary work-order-revision-button"
                type="button"
                onClick={handleRevise}
                  disabled={
                    working ||
                    workOrder.status === "VERIFYING" ||
                    workOrder.verificationAttempts.length === 0 ||
                    workOrder.verificationAttempts.some(
                      (attempt) =>
                        attempt.status === "PASSED" ||
                        ((attempt.scoreAfter ?? -1) >=
                          workOrder.expectedScoreMax),
                    )
                  }
              >
                {isEnglish ? "Issue follow-up work order" : "후속 작업지시서 발급"}
              </button>
            </div>
          ) : null}

          {workOrder.verificationAttempts.length > 0 ? (
            <div className="work-order-verification-history">
              <h3>{isEnglish ? "Verification request history" : "검수 요청 이력"}</h3>
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
                          {isEnglish ? `Verification ${attempt.attemptNumber + 1}` : `${attempt.attemptNumber + 1}차 검수`}
                        </strong>
                        <span
                          className={`verification-attempt-status verification-attempt-status-${verificationStatusClass(
                            attempt.status,
                          )}`}
                        >
                          {isEnglish
                            ? attempt.status.replaceAll("_", " ").toLowerCase()
                            : verificationStatusLabels[attempt.status] ?? attempt.status}
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
                          <dt>{isEnglish ? "Requested at" : "요청 시각"}</dt>
                          <dd>{formatKST(attempt.createdAt, isEnglish)}</dd>
                        </div>
                        <div>
                          <dt>{isEnglish ? "Verification status" : "검사 상태"}</dt>
                          <dd>
                            {isEnglish
                              ? attempt.scan.status.replaceAll("_", " ").toLowerCase()
                              : statusLabels[attempt.scan.status] ?? attempt.scan.status}
                          </dd>
                        </div>
                        <div>
                          <dt>{isEnglish ? "Score after verification" : "검사 후 점수"}</dt>
                          <dd>
                            {attempt.scoreAfter ?? "—"}{" "}
                            {attempt.gradeAfter ?? ""}
                          </dd>
                        </div>
                      </dl>

                      {attempt.itemResults.length > 0 ? (
                        <div className="verification-result-summary">
                          <strong>{isEnglish ? "Item-level automatic verification results" : "항목별 자동검수 결과"}</strong>
                          <div>
                            <span className="verification-count-pass">
                              {isEnglish ? "Pass" : "통과"} {passCount}
                            </span>
                            <span className="verification-count-fail">
                              {isEnglish ? "Fail" : "실패"} {failCount}
                            </span>
                            <span className="verification-count-blocked">
                              {isEnglish ? "Blocked" : "확인 불가"} {blockedCount}
                            </span>
                            <span className="verification-count-na">
                              {isEnglish ? "Not applicable" : "해당 없음"} {notApplicableCount}
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
                                        (isEnglish ? "Work item verification result" : "작업 항목 검수 결과")}
                                    </h4>
                                  </div>
                                  <b>
                                    {isEnglish
                                      ? result.status.replaceAll("_", " ").toLowerCase()
                                      : verificationItemStatusLabels[result.status] ?? result.status}
                                  </b>
                                </header>

                                {result.message ? (
                                  <p className="verification-item-message">
                                    {result.message}
                                  </p>
                                ) : null}

                                {criterionResults.length > 0 ? (
                                  <div className="verification-criteria-results">
                                    <strong>{isEnglish ? "Completion criteria decisions" : "완료 기준별 판정"}</strong>
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
                                                {isEnglish
                                                  ? criterion.status.replaceAll("_", " ").toLowerCase()
                                                  : verificationItemStatusLabels[criterion.status] ?? criterion.status}
                                              </b>
                                            </div>
                                            <p>{criterion.label}</p>
                                            {criterion.message ? (
                                              <small>
                                                {criterion.message}
                                              </small>
                                            ) : null}
                                            <em>
                                              {criterion.required ? (isEnglish ? "Required" : "필수") : (isEnglish ? "Recommended" : "권장")}
                                              {" · "}
                                              {criterion.automated
                                                ? isEnglish ? "Automatic decision" : "자동 판정"
                                                : isEnglish ? "Manual review" : "수동 확인"}
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
                                      {isEnglish ? "View automatic verification evidence" : "자동검수 증거 보기"}
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
                          {isEnglish ? "No saved item-level verification results." : "저장된 항목별 검수 결과가 없습니다."}
                        </p>
                      ) : null}

                      {attempt.errorCode ? (
                        <p className="work-order-verification-error">
                          {isEnglish ? "Error code" : "오류 코드"}: {attempt.errorCode}
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
              <h2>{isEnglish ? "Improvement items found in the initial diagnostic" : "1차 진단에서 발견된 수정 항목"}</h2>
              <p>
                {isEnglish
                  ? "Completion is verified against the deployed public URL, not the source code."
                  : "소스코드가 아니라 배포된 공개 URL에서 완료 여부를 확인합니다."}
              </p>
            </div>
            <span>{workOrder.items.length} {isEnglish ? "items" : "개"}</span>
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
                          ? isEnglish ? "Required" : "필수"
                          : isEnglish ? "General" : "일반"
                        : isEnglish ? "Recommended improvement" : "권장 개선"}
                    </span>
                    <span>
                      {item.weight > 0 ? (isEnglish ? `Expected +${item.weight} pts` : `예상 ${item.weight}점`) : (isEnglish ? "Non-score improvement" : "점수 외 개선")}
                    </span>
                  </div>
                </header>

                <dl className="work-order-item-meta">
                  <div>
                    <dt>{isEnglish ? "Target URL" : "대상 URL"}</dt>
                    <dd>{item.targetUrl}</dd>
                  </div>
                  <div>
                    <dt>{isEnglish ? "Initial finding" : "1차 판정"}</dt>
                    <dd>
                      {item.finding?.status ?? (isEnglish ? "Additional improvement recommended" : "추가 개선 권장")}
                    </dd>
                  </div>
                  <div>
                    <dt>{isEnglish ? "Severity" : "중요도"}</dt>
                    <dd>
                      {item.finding?.severity ?? (isEnglish ? "AI collection stability" : "AI 수집 안정성")}
                    </dd>
                  </div>
                </dl>

                <div className="work-order-requirement">
                  <strong>{isEnglish ? "Required change" : "수정 요구사항"}</strong>
                  <p>{item.requirement}</p>
                </div>

                <div className="work-order-developer-message">
                  <strong>{isEnglish ? "Developer instructions" : "개발자 전달용 문구"}</strong>
                  <p>{item.developerMessage}</p>
                </div>

                <div className="work-order-criteria">
                  <strong>{isEnglish ? "Completion criteria" : "완료 판정 기준"}</strong>
                  <ul>
                    {item.acceptanceCriteria.map((criterion) => (
                      <li key={criterion.code}>
                        <span>{criterion.code}</span>
                        <p>{criterion.label}</p>
                        <em>
                          {criterion.required ? (isEnglish ? "Required" : "필수") : (isEnglish ? "Recommended" : "권장")}
                        </em>
                      </li>
                    ))}
                  </ul>
                </div>

                {item.finding ? (
                  <details>
                    <summary>{isEnglish ? "View initial diagnostic evidence" : "최초 검사 증거 보기"}</summary>
                    <pre>{evidenceText(item.finding.evidence)}</pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <p className="work-order-disclaimer">
          {isEnglish
            ? "The expected score range is only a reference based on the selected scoring rule weights. Non-score AI collection improvements are not included, and actual score increases or AI search visibility are not guaranteed."
            : "예상 점수 범위는 선택한 점수 규칙의 배점만을 기준으로 계산한 참고값입니다. 점수 외 AI 수집 개선안은 예상 점수에 포함되지 않으며 실제 상승 폭이나 AI 검색 노출은 보장되지 않습니다."}
        </p>
      </div>
    </section>
  );
}
