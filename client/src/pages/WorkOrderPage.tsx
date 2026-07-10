import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelWorkOrderRequest,
  getWorkOrderRequest,
  issueWorkOrderRequest,
  submitVerificationRequest,
  workOrderExportUrl,
  WorkOrderApiError,
  type WorkOrderDetail,
} from "../work-orders/work-order-api";
import "../work-orders.css";

function extraVerificationCheckoutPath(
  locale: string,
  workOrder: WorkOrderDetail,
): string {
  const params = new URLSearchParams({
    workOrderId: workOrder.id,
    plan: "EXTRA_VERIFICATION",
    returnTo: `/${locale}/work-orders/${workOrder.id}`,
  });

  return `/${locale}/checkout?${params.toString()}`;
}

function evidenceText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function WorkOrderPage() {
  const { locale = "ko", workOrderId = "" } = useParams();
  const isEnglish = locale === "en";
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);
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
          setSubmittedUrl(value.site.finalUrl ?? value.site.baseUrl);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof WorkOrderApiError
              ? error.message
              : isEnglish
                ? "Could not load the work order."
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
    if (!workOrderId || workOrder?.status !== "VERIFYING") {
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
      isEnglish
        ? "The work order has been issued."
        : "작업지시서를 발급 상태로 변경했습니다.",
    );
  }

  async function handleSubmitVerification() {
    if (!workOrder) return;

    const hasLaterVerificationResult = workOrder.versionHistory.some(
      (entry) => entry.version > workOrder.version,
    );

    if (hasLaterVerificationResult) {
      setErrorMessage(
        isEnglish
          ? "A later diagnostic and work order already exist. Continue from the latest work order."
          : "이미 다음 차수 진단과 작업지시서가 있습니다. 최신 작업지시서에서 계속 진행해 주세요.",
      );
      return;
    }

    if (
      workOrder.extraVerification.required &&
      !workOrder.extraVerification.available
    ) {
      navigate(extraVerificationCheckoutPath(locale, workOrder));
      return;
    }

    setSubmittingVerification(true);
    setErrorMessage("");
    setMessage("");

    try {
      const value = await submitVerificationRequest(workOrder.id, submittedUrl);
      setWorkOrder(value);
      setMessage(
        isEnglish
          ? `The public URL has been submitted. Diagnostic ${Math.min(
              workOrder.version + 1,
              4,
            )} has started.`
          : `공개 URL을 접수했습니다. ${Math.min(
              workOrder.version + 1,
              4,
            )}차 사이트 진단을 시작합니다.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof WorkOrderApiError
          ? error.message
          : isEnglish
            ? "Could not submit the updated URL."
            : "수정 URL을 접수하지 못했습니다.",
      );
    } finally {
      setSubmittingVerification(false);
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
          : isEnglish
            ? "Could not cancel the work order."
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
          {isEnglish
            ? "Loading the work order."
            : "작업지시서를 불러오고 있습니다."}
        </div>
      </section>
    );
  }

  if (!workOrder) {
    return (
      <section className="full-bleed-section work-orders-section">
        <div className="content-container work-order-empty">
          <p role="alert">
            {errorMessage ||
              (isEnglish ? "Work order not found." : "작업지시서가 없습니다.")}
          </p>
          <Link to={`/${locale}/work-orders`}>
            {isEnglish ? "Back to list" : "목록으로 돌아가기"}
          </Link>
        </div>
      </section>
    );
  }

  const latestVerificationAttempt = workOrder.verificationAttempts[0] ?? null;
  const isLatestVerificationConclusive =
    latestVerificationAttempt !== null &&
    (latestVerificationAttempt.status === "PASSED" ||
      latestVerificationAttempt.status === "REWORK_REQUIRED" ||
      (latestVerificationAttempt.completedAt !== null &&
        latestVerificationAttempt.scoreAfter !== null &&
        latestVerificationAttempt.status !== "FAILED"));
  const hasRemainingVerificationItems =
    latestVerificationAttempt?.itemResults.some(
      (result) => result.status === "FAIL" || result.status === "BLOCKED",
    ) ?? false;
  const canSubmitVerification =
    [
      "ISSUED",
      "ASSIGNED",
      "IN_PROGRESS",
      "SUBMITTED",
      "REWORK_REQUIRED",
    ].includes(workOrder.status) && !isLatestVerificationConclusive;
  const followUpWorkOrderEntry =
    workOrder.versionHistory
      .filter((entry) => entry.version > workOrder.version)
      .sort((left, right) => left.version - right.version)[0] ?? null;
  const hasLaterVerificationResult = followUpWorkOrderEntry !== null;
  const followUpWorkOrderVersion =
    followUpWorkOrderEntry?.version ?? workOrder.version + 1;
  const needsExtraVerificationPayment =
    workOrder.extraVerification.required &&
    !workOrder.extraVerification.available;
  const nextDiagnosticNumber = Math.min(workOrder.version + 1, 4);
  const nextDiagnosticId = latestVerificationAttempt?.scan.id ?? null;
  const nextDiagnosticReportAvailable =
    isLatestVerificationConclusive && nextDiagnosticId !== null;
  const latestDiagnosticFailed =
    latestVerificationAttempt !== null &&
    (latestVerificationAttempt.status === "FAILED" ||
      latestVerificationAttempt.scan.status === "FAILED" ||
      latestVerificationAttempt.errorCode !== null ||
      latestVerificationAttempt.scan.errorCode !== null);
  const verificationSubmitLabel = needsExtraVerificationPayment
    ? isEnglish
      ? `Pay and continue to Diagnostic ${nextDiagnosticNumber}`
      : `추가 결제 후 ${nextDiagnosticNumber}차 진단 진행`
    : isEnglish
      ? `Site updates complete · Start Diagnostic ${nextDiagnosticNumber}`
      : `사이트 수정 완료 · ${nextDiagnosticNumber}차 진단 시작`;

  return (
    <section className="full-bleed-section work-orders-section">
      <div className="content-container work-order-detail-content">
        <header className="work-orders-heading">
          <div>
            <p className="eyebrow">
              {isEnglish
                ? `WORK ORDER ${workOrder.version}`
                : `${workOrder.version}차 작업지시서`}
            </p>
            <h1>
              {isEnglish
                ? `${workOrder.site.name} Work Order ${workOrder.version}`
                : `${workOrder.site.name} ${workOrder.version}차 수정 작업지시서`}
            </h1>
            <p>
              {isEnglish
                ? `Work order no. ${workOrder.orderNumber}`
                : `작업지시서 번호 ${workOrder.orderNumber}`}
            </p>
          </div>
          <Link className="work-order-back" to={`/${locale}/sites`}>
            {isEnglish ? "Site dashboard" : "사이트 관리"}
          </Link>
        </header>

        {message &&
        !(
          message.startsWith("공개 URL") || message.startsWith("The public URL")
        ) ? (
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
              <button type="button" onClick={handleIssue} disabled={working}>
                {working
                  ? isEnglish
                    ? "Processing..."
                    : "처리 중..."
                  : isEnglish
                    ? "Issue work order"
                    : "작업지시서 발급"}
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
              {hasLaterVerificationResult && followUpWorkOrderEntry ? (
                <Link
                  className="work-order-primary-link"
                  to={`/${locale}/work-orders/${followUpWorkOrderEntry.id}`}
                >
                  {isEnglish
                    ? `Open Work Order ${followUpWorkOrderVersion}`
                    : `${followUpWorkOrderVersion}차 작업지시서 보기`}
                </Link>
              ) : null}
              <a
                className={
                  hasLaterVerificationResult
                    ? "secondary"
                    : "work-order-primary-link"
                }
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
            <strong>
              {hasLaterVerificationResult
                ? isEnglish
                  ? `Current step: Work Order ${followUpWorkOrderVersion} issued`
                  : `현재 단계: ${followUpWorkOrderVersion}차 작업지시서 발행 완료`
                : isLatestVerificationConclusive
                  ? isEnglish
                    ? `Current step: Diagnostic ${nextDiagnosticNumber} completed`
                    : `현재 단계: ${nextDiagnosticNumber}차 사이트 진단 완료`
                  : workOrder.status === "VERIFYING"
                    ? isEnglish
                      ? `Current step: Diagnostic ${nextDiagnosticNumber} in progress`
                      : `현재 단계: ${nextDiagnosticNumber}차 사이트 진단 진행 중`
                    : isEnglish
                      ? `Current step: update the site using Work Order ${workOrder.version}`
                      : `현재 단계: ${workOrder.version}차 작업지시서에 따라 사이트 수정`}
            </strong>
            <p>
              {hasLaterVerificationResult
                ? isEnglish
                  ? `Work Order ${followUpWorkOrderVersion} has already been issued. This page remains available as the previous work order record.`
                  : `${followUpWorkOrderVersion}차 작업지시서가 이미 발행되었습니다. 이 화면은 이전 작업지시서 기록으로 유지됩니다.`
                : isLatestVerificationConclusive
                  ? hasRemainingVerificationItems
                    ? isEnglish
                      ? `Diagnostic ${nextDiagnosticNumber} is complete. Open that diagnostic report to review the remaining items and create the next work order.`
                      : `${nextDiagnosticNumber}차 사이트 진단이 완료되었습니다. 해당 진단 보고서에서 남은 항목을 확인하고 다음 작업지시서를 진행하세요.`
                    : isEnglish
                      ? `Diagnostic ${nextDiagnosticNumber} is complete, and no remaining failed items were found.`
                      : `${nextDiagnosticNumber}차 사이트 진단이 완료되었으며 남은 실패 항목이 없습니다.`
                  : isEnglish
                    ? "Save this work order as a PDF or send it to the developer. After the updates are deployed, submit the public URL below."
                    : "이 작업지시서를 PDF로 저장하거나 개발자에게 전달해 사이트를 수정하세요. 수정 사항을 배포한 뒤 아래에 공개 URL을 제출하세요."}
            </p>
          </div>
        ) : null}

        <section className="surface work-order-verification">
          <div className="work-order-verification-heading">
            <div>
              <p className="eyebrow">SITE UPDATE COMPLETION</p>
              <h2>
                {isEnglish ? "Site updates complete" : "사이트 수정 완료"}
              </h2>
              <p>
                {isEnglish
                  ? `After applying Work Order ${workOrder.version} and deploying the changes, submit the public URL to start Diagnostic ${nextDiagnosticNumber}.`
                  : `${workOrder.version}차 작업지시서의 수정 사항을 반영하고 배포한 뒤 공개 URL을 제출하면 ${nextDiagnosticNumber}차 사이트 진단을 시작합니다.`}
              </p>
            </div>
            {workOrder.status === "VERIFYING" ? (
              <span className="work-order-verification-live">
                {isEnglish
                  ? `Diagnostic ${nextDiagnosticNumber} in progress`
                  : `${nextDiagnosticNumber}차 사이트 진단 진행 중`}
              </span>
            ) : null}
          </div>

          {hasLaterVerificationResult && followUpWorkOrderEntry ? (
            <div className="work-order-verification-notice">
              <p>
                {isEnglish
                  ? `Work Order ${followUpWorkOrderVersion} has already been issued from the next diagnostic report. Continue from that work order.`
                  : `다음 차수 진단 보고서에서 ${followUpWorkOrderVersion}차 작업지시서가 이미 발행되었습니다. 해당 작업지시서에서 계속 진행하세요.`}
              </p>
              <Link
                className="secondary work-order-revision-button"
                to={`/${locale}/work-orders/${followUpWorkOrderEntry.id}`}
              >
                {isEnglish
                  ? `Open Work Order ${followUpWorkOrderVersion}`
                  : `${followUpWorkOrderVersion}차 작업지시서 보기`}
              </Link>
            </div>
          ) : nextDiagnosticReportAvailable ? (
            <div className="work-order-verification-notice">
              <p>
                {hasRemainingVerificationItems
                  ? isEnglish
                    ? `Diagnostic ${nextDiagnosticNumber} is complete. Review the remaining items in the diagnostic report and create the next work order there.`
                    : `${nextDiagnosticNumber}차 사이트 진단이 완료되었습니다. 진단 보고서에서 남은 항목을 확인하고 다음 작업지시서를 생성하세요.`
                  : isEnglish
                    ? `Diagnostic ${nextDiagnosticNumber} is complete. No additional work order is required.`
                    : `${nextDiagnosticNumber}차 사이트 진단이 완료되었습니다. 추가 작업지시서는 필요하지 않습니다.`}
              </p>
              <Link
                className="secondary work-order-revision-button"
                to={`/${locale}/sites/${workOrder.site.id}/scans/${nextDiagnosticId}`}
              >
                {isEnglish
                  ? `View Diagnostic ${nextDiagnosticNumber} Report`
                  : `${nextDiagnosticNumber}차 진단 보고서 보기`}
              </Link>
            </div>
          ) : canSubmitVerification ? (
            <form
              className="work-order-verification-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitVerification();
              }}
            >
              <label htmlFor="verification-url">
                {isEnglish ? "Updated public URL" : "수정 완료된 공개 URL"}
              </label>
              <div>
                <input
                  id="verification-url"
                  type="url"
                  value={submittedUrl}
                  onChange={(event) => setSubmittedUrl(event.target.value)}
                  placeholder="https://example.com/updated-page"
                  required
                  maxLength={2048}
                  disabled={submittingVerification}
                />
                <button
                  type={needsExtraVerificationPayment ? "button" : "submit"}
                  disabled={
                    submittingVerification ||
                    (!needsExtraVerificationPayment &&
                      submittedUrl.trim().length === 0)
                  }
                  onClick={
                    needsExtraVerificationPayment
                      ? () =>
                          navigate(
                            extraVerificationCheckoutPath(locale, workOrder),
                          )
                      : undefined
                  }
                >
                  {submittingVerification
                    ? isEnglish
                      ? "Starting diagnostic..."
                      : "진단 요청 중..."
                    : verificationSubmitLabel}
                </button>
              </div>
              <small>
                {needsExtraVerificationPayment
                  ? isEnglish
                    ? `Diagnostic ${nextDiagnosticNumber} requires the additional payment for this work order.`
                    : `이 작업지시서 반영 후 ${nextDiagnosticNumber}차 사이트 진단은 추가 결제 후 진행할 수 있습니다.`
                  : isEnglish
                    ? "Submit an externally accessible HTTP(S) URL that does not require login or an internal network."
                    : "로그인이나 사내망 없이 외부에서 접속 가능한 HTTP(S) 주소만 제출할 수 있습니다."}
              </small>
            </form>
          ) : workOrder.status === "DRAFT" ? (
            <p className="work-order-verification-notice">
              {isEnglish
                ? "Issue the work order first. After the site updates are deployed, you can submit the public URL."
                : "작업지시서를 먼저 발급하세요. 사이트 수정 사항을 배포한 뒤 공개 URL을 제출할 수 있습니다."}
            </p>
          ) : workOrder.status === "VERIFYING" ? (
            <p className="work-order-verification-notice">
              {isEnglish
                ? `Diagnostic ${nextDiagnosticNumber} is checking the submitted public URL. This page refreshes automatically.`
                : `제출한 공개 URL을 기준으로 ${nextDiagnosticNumber}차 사이트 진단을 진행하고 있습니다. 이 화면은 자동으로 갱신됩니다.`}
            </p>
          ) : workOrder.status === "CANCELLED" ? (
            <p className="work-order-verification-notice">
              {isEnglish
                ? "This work order was cancelled."
                : "취소된 작업지시서입니다."}
            </p>
          ) : null}

          {message &&
          (message.startsWith("공개 URL") ||
            message.startsWith("The public URL")) ? (
            <p className="work-order-message work-order-success" role="status">
              {message}
            </p>
          ) : null}

          {latestDiagnosticFailed ? (
            <p className="work-order-message work-order-error" role="alert">
              {isEnglish
                ? `Diagnostic ${nextDiagnosticNumber} could not be completed. Review the site URL and try again from the latest workflow step.`
                : `${nextDiagnosticNumber}차 사이트 진단을 완료하지 못했습니다. 사이트 URL을 확인한 뒤 최신 진행 단계에서 다시 시도해 주세요.`}
            </p>
          ) : null}
        </section>

        <section className="work-order-items-section">
          <div className="work-order-section-heading">
            <div>
              <h2>
                {isEnglish
                  ? `Improvement items from Diagnostic ${workOrder.version}`
                  : `${workOrder.version}차 진단에서 확인된 수정 항목`}
              </h2>
              <p>
                {isEnglish
                  ? `Completion criteria are checked against the deployed public URL in Diagnostic ${nextDiagnosticNumber}.`
                  : `완료 기준은 배포된 공개 URL을 대상으로 ${nextDiagnosticNumber}차 사이트 진단에서 확인합니다.`}
              </p>
            </div>
            <span>
              {workOrder.items.length} {isEnglish ? "items" : "개"}
            </span>
          </div>

          <div className="work-order-items">
            {workOrder.items.map((item, index) => (
              <article className="surface work-order-item-card" key={item.id}>
                <header>
                  <div>
                    <span>
                      {String(index + 1).padStart(2, "0")} · {item.itemCode}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                  <div className="work-order-item-badges">
                    <span>
                      {item.finding
                        ? item.isRequired
                          ? isEnglish
                            ? "Required"
                            : "필수"
                          : isEnglish
                            ? "General"
                            : "일반"
                        : isEnglish
                          ? "Recommended improvement"
                          : "권장 개선"}
                    </span>
                    <span>
                      {item.weight > 0
                        ? isEnglish
                          ? `Expected +${item.weight} pts`
                          : `예상 ${item.weight}점`
                        : isEnglish
                          ? "Non-score improvement"
                          : "점수 외 개선"}
                    </span>
                  </div>
                </header>

                <dl className="work-order-item-meta">
                  <div>
                    <dt>{isEnglish ? "Target URL" : "대상 URL"}</dt>
                    <dd>{item.targetUrl}</dd>
                  </div>
                  <div>
                    <dt>
                      {isEnglish
                        ? `Diagnostic ${workOrder.version} finding`
                        : `${workOrder.version}차 진단 판정`}
                    </dt>
                    <dd>
                      {item.finding?.status ??
                        (isEnglish
                          ? "Additional improvement recommended"
                          : "필요시 추가 개선")}
                    </dd>
                  </div>
                  <div>
                    <dt>{isEnglish ? "Severity" : "중요도"}</dt>
                    <dd>
                      {item.finding?.severity ??
                        (isEnglish
                          ? "AI collection stability"
                          : "AI 수집 안정성")}
                    </dd>
                  </div>
                </dl>

                <div className="work-order-requirement">
                  <strong>
                    {isEnglish ? "Required change" : "수정 요구사항"}
                  </strong>
                  <p>{item.requirement}</p>
                </div>

                <div className="work-order-developer-message">
                  <strong>
                    {isEnglish
                      ? "Developer instructions"
                      : "개발자 전달용 문구"}
                  </strong>
                  <p>{item.developerMessage}</p>
                </div>

                <div className="work-order-criteria">
                  <strong>
                    {isEnglish ? "Completion criteria" : "완료 판정 기준"}
                  </strong>
                  <ul>
                    {item.acceptanceCriteria.map((criterion) => (
                      <li key={criterion.code}>
                        <span>{criterion.code}</span>
                        <p>{criterion.label}</p>
                        <em>
                          {criterion.required
                            ? isEnglish
                              ? "Required"
                              : "필수"
                            : isEnglish
                              ? "Recommended"
                              : "권장"}
                        </em>
                      </li>
                    ))}
                  </ul>
                </div>

                {item.finding ? (
                  <details>
                    <summary>
                      {isEnglish
                        ? `View Diagnostic ${workOrder.version} evidence`
                        : `${workOrder.version}차 진단 증거 보기`}
                    </summary>
                    <pre>{evidenceText(item.finding.evidence)}</pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <p className="work-order-disclaimer">
          {isEnglish
            ? "The target score describes the intended direction of this work order. It is not a guarantee of score increases, AI search exposure, or recommendation results."
            : "목표 점수는 이 작업지시서가 지향하는 수정 방향입니다. 실제 점수 상승, AI 검색 노출, 추천 결과를 보장하지 않습니다."}
        </p>
      </div>
    </section>
  );
}
