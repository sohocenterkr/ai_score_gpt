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
  REWORK_REQUIRED: "필요시 추가 개선",
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
  REWORK_REQUIRED: "필요시 추가 개선",
  PASSED: "통과",
  CANCELLED: "취소",
};

function workOrderScoreGoal(scoreBefore: number | null | undefined) {
  const current = Math.max(0, Math.min(100, Math.round(scoreBefore ?? 0)));
  const firstMin =
    current < 70 ? 70 : current < 80 ? 80 : current < 90 ? 90 : current;
  const firstMax = firstMin < 80 ? 80 : 100;
  const finalMin = Math.max(80, Math.min(100, firstMin));

  return {
    firstMin,
    firstMax,
    finalMin,
    finalMax: 100,
  };
}

function formatGoalRange(
  min: number,
  max: number,
  isEnglish: boolean,
  plus = false,
): string {
  const range =
    min === max ? String(min) : isEnglish ? `${min}-${max}` : `${min}~${max}`;
  return plus
    ? isEnglish
      ? `${range}+`
      : `${range}점 이상`
    : isEnglish
      ? range
      : `${range}점`;
}

function workOrderVersionScoreLabel(
  version: number,
  isEnglish: boolean,
): string {
  return isEnglish ? `Version ${version} verification` : `${version}차 검수`;
}

function workOrderVersionCompletedLabel(
  version: number,
  isEnglish: boolean,
): string {
  return isEnglish
    ? `Version ${version} verification completed`
    : `${version}차 검수 완료`;
}

function verificationAttemptVersion(workOrderVersion: number): number {
  return workOrderVersion + 1;
}

function workOrderVersionMetaLabel(
  version: number,
  label: "rules" | "completedAt" | "url",
  isEnglish: boolean,
): string {
  if (isEnglish) {
    const prefix = `Version ${version}`;
    if (label === "rules") return `${prefix} verification rules version`;
    if (label === "completedAt")
      return `${prefix} verification completed at (KST)`;
    return `${prefix} verification URL`;
  }

  if (label === "rules") return `${version}차 검수 규칙 버전`;
  if (label === "completedAt") return `${version}차 검수 완료 시각(KST)`;
  return `${version}차 검수 URL`;
}

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

export const verificationItemStatusLabels: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NOT_APPLICABLE: "해당 없음",
};

function verificationStatusClass(status: string): string {
  return status.toLowerCase().replaceAll("_", "-");
}

function verificationCriteria(value: unknown): Array<{
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
    if (!item || typeof item !== "object" || Array.isArray(item)) {
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
        message: typeof record.message === "string" ? record.message : "",
      },
    ];
  });
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
  const [selectedVerificationAttemptId, setSelectedVerificationAttemptId] =
    useState("");

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

  useEffect(() => {
    const attempts = workOrder?.verificationAttempts ?? [];

    setSelectedVerificationAttemptId((current) => {
      if (attempts.length === 0) {
        return "";
      }

      return current && attempts.some((attempt) => attempt.id === current)
        ? current
        : (attempts[0]?.id ?? "");
    });
  }, [workOrder?.verificationAttempts]);

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
          ? "A later verification result already exists. Create or open the next work order to continue."
          : "이미 다음 차수 검수 결과가 있습니다. 후속 작업지시서를 만들거나 최신 작업지시서에서 검수를 진행해 주세요.",
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
          ? "The public URL has been submitted. Verification has started."
          : "공개 URL을 접수했습니다. 검수를 시작합니다.",
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

  async function handleRevise() {
    if (!workOrder) return;

    const hasLaterVerificationResult = workOrder.versionHistory.some(
      (entry) => entry.version > workOrder.version,
    );

    if (hasLaterVerificationResult) {
      setErrorMessage(
        isEnglish
          ? "A later work order already exists. Open the latest work order to continue."
          : "이미 후속 작업지시서가 있습니다. 최신 작업지시서에서 계속 진행해 주세요.",
      );
      return;
    }

    const revised = await runAction(
      () => reviseWorkOrderRequest(workOrder.id),
      isEnglish
        ? "A follow-up work order has been created from the remaining items."
        : "남은 항목으로 후속 작업지시서를 만들었습니다.",
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
  const latestScoredVerificationAttempt =
    workOrder.verificationAttempts.find(
      (attempt) => attempt.scoreAfter !== null,
    ) ?? null;
  const isLatestVerificationConclusive =
    latestVerificationAttempt !== null &&
    (latestVerificationAttempt.status === "PASSED" ||
      latestVerificationAttempt.status === "REWORK_REQUIRED" ||
      (latestVerificationAttempt.completedAt !== null &&
        latestVerificationAttempt.scoreAfter !== null &&
        latestVerificationAttempt.status !== "FAILED"));
  const remainingVerificationItemResults =
    latestVerificationAttempt?.itemResults.filter(
      (result) => result.status === "FAIL" || result.status === "BLOCKED",
    ) ?? [];
  const hasRemainingVerificationItems =
    remainingVerificationItemResults.length > 0;
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
  const verificationSubmitLabel = needsExtraVerificationPayment
    ? isEnglish
      ? "Pay to verify"
      : "결제 후 검수"
    : isEnglish
      ? "Start verification"
      : "검수시작";

  return (
    <section className="full-bleed-section work-orders-section">
      <div className="content-container work-order-detail-content">
        <header className="work-orders-heading">
          <div>
            <p className="eyebrow">WORK ORDER</p>
            <h1>
              {isEnglish
                ? `${workOrder.site.name} Improvement Work Order`
                : `${workOrder.site.name} 수정 작업지시서`}
            </h1>
            <p>
              {workOrder.orderNumber} · v{workOrder.version}
            </p>
          </div>
          <Link className="work-order-back" to={`/${locale}/work-orders`}>
            {isEnglish ? "Improvement work orders" : "수정 작업지시서 목록"}
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
                    ? `Continue in V${followUpWorkOrderVersion} work order`
                    : `V${followUpWorkOrderVersion} 작업지시서에서 수정·검수 진행하기`}
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
                  ? `Current step: V${followUpWorkOrderVersion} work order issued`
                  : `현재 단계: V${followUpWorkOrderVersion} 수정 작업지시서 발행됨`
                : isLatestVerificationConclusive
                  ? isEnglish
                    ? "Current step: verification completed"
                    : "현재 단계: 2차 검수 완료"
                  : isEnglish
                    ? "Current step: update the site using this work order"
                    : "현재 단계: 작업지시서로 사이트 수정 진행"}
            </strong>
            <p>
              {hasLaterVerificationResult
                ? isEnglish
                  ? `The V${followUpWorkOrderVersion} follow-up work order has been issued from the remaining items. This is the previous work order. Open the V${followUpWorkOrderVersion} work order, review the remaining items, update and deploy the site, then run verification from that work order.`
                  : `남은 항목을 기준으로 V${followUpWorkOrderVersion} 수정 작업지시서가 발행되었습니다. 이 화면은 이전 작업지시서입니다. V${followUpWorkOrderVersion} 작업지시서를 열어 남은 수정 항목을 확인하고, 사이트를 수정·배포한 뒤 V${followUpWorkOrderVersion} 작업지시서 화면에서 검수시작을 진행해 주세요.`
                : isLatestVerificationConclusive
                  ? hasRemainingVerificationItems
                    ? isEnglish
                      ? "The updated public URL has been verified. Create a follow-up work order only for the remaining failed or blocked items when additional improvement is needed."
                      : "수정된 공개 URL 검수가 완료되었습니다. 추가 개선이 필요한 경우 실패 또는 확인 불가 항목만 모아 후속 작업지시서를 만들 수 있습니다."
                    : isEnglish
                      ? "The updated public URL has been verified and no remaining failed or blocked items were found."
                      : "수정된 공개 URL 검수가 완료되었고 남은 실패 또는 확인 불가 항목이 없습니다."
                  : isEnglish
                    ? "Save this document as a PDF or send it to the developer to update the site. After deployment, submit the public URL below to verify whether the work was applied."
                    : "이 문서를 PDF로 저장하거나 개발자에게 전달해 사이트 수정을 진행하세요. 수정 사항을 배포한 뒤 아래 자동검수 영역에 공개 URL을 제출하면 작업 반영 여부를 확인할 수 있습니다."}
            </p>
          </div>
        ) : null}

        <section className="surface work-order-overview">
          {(() => {
            const latestScoreAttempt = latestScoredVerificationAttempt;
            const latestScorePassCount =
              latestScoreAttempt?.itemResults.filter(
                (result) => result.status === "PASS",
              ).length ?? 0;
            const latestScoreFailCount =
              latestScoreAttempt?.itemResults.filter(
                (result) => result.status === "FAIL",
              ).length ?? 0;
            const latestScoreBlockedCount =
              latestScoreAttempt?.itemResults.filter(
                (result) => result.status === "BLOCKED",
              ).length ?? 0;
            const latestScoreNotApplicableCount =
              latestScoreAttempt?.itemResults.filter(
                (result) => result.status === "NOT_APPLICABLE",
              ).length ?? 0;
            const latestScoreVersion = verificationAttemptVersion(
              workOrder.version,
            );
            const scoreGoal = workOrderScoreGoal(workOrder.scoreBefore);
            const versionHistory =
              workOrder.versionHistory.length > 0
                ? workOrder.versionHistory
                : [
                    {
                      id: workOrder.id,
                      version: workOrder.version,
                      scoreBefore: workOrder.scoreBefore,
                      gradeBefore: workOrder.gradeBefore,
                      initialScan: workOrder.initialScan,
                    },
                  ];
            return latestScoreAttempt ? (
              <>
                <div className="work-order-score-comparison">
                  {versionHistory.map((entry) => (
                    <article
                      className={`work-order-score-card${
                        entry.version === workOrder.version ? " current" : ""
                      }`}
                      key={entry.id}
                    >
                      <span>
                        {workOrderVersionScoreLabel(entry.version, isEnglish)}
                      </span>
                      <strong>
                        {entry.scoreBefore ?? "—"}
                        {entry.gradeBefore ? (
                          <small> {entry.gradeBefore}</small>
                        ) : null}
                      </strong>
                      <small>
                        {workOrderVersionCompletedLabel(
                          entry.version,
                          isEnglish,
                        )}
                      </small>

                      <dl className="work-order-score-card-meta">
                        <div>
                          <dt>
                            {workOrderVersionMetaLabel(
                              entry.version,
                              "rules",
                              isEnglish,
                            )}
                          </dt>
                          <dd>{entry.initialScan.rulesVersion}</dd>
                        </div>
                        <div>
                          <dt>
                            {workOrderVersionMetaLabel(
                              entry.version,
                              "completedAt",
                              isEnglish,
                            )}
                          </dt>
                          <dd>
                            {formatKST(
                              entry.initialScan.completedAt,
                              isEnglish,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            {workOrderVersionMetaLabel(
                              entry.version,
                              "url",
                              isEnglish,
                            )}
                          </dt>
                          <dd>
                            <a
                              href={
                                entry.initialScan.targetUrl ??
                                workOrder.site.finalUrl ??
                                workOrder.site.baseUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {entry.initialScan.targetUrl ??
                                workOrder.site.finalUrl ??
                                workOrder.site.baseUrl}
                            </a>
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {!hasLaterVerificationResult ? (
                    <article className="work-order-score-card verification">
                      <span>
                        {workOrderVersionScoreLabel(
                          latestScoreVersion,
                          isEnglish,
                        )}
                      </span>
                      <strong>
                        {latestScoreAttempt.scoreAfter ?? "—"}
                        {latestScoreAttempt.gradeAfter ? (
                          <small> {latestScoreAttempt.gradeAfter}</small>
                        ) : null}
                      </strong>
                      <small>
                        {workOrderVersionCompletedLabel(
                          latestScoreVersion,
                          isEnglish,
                        )}
                      </small>

                      <dl className="work-order-score-card-meta">
                        <div>
                          <dt>
                            {isEnglish
                              ? "Verification status"
                              : String(latestScoreVersion) + "차 검수 상태"}
                          </dt>
                          <dd>
                            {isEnglish
                              ? latestScoreAttempt.status
                                  .replaceAll("_", " ")
                                  .toLowerCase()
                              : (verificationStatusLabels[
                                  latestScoreAttempt.status
                                ] ?? latestScoreAttempt.status)}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            {workOrderVersionMetaLabel(
                              latestScoreVersion,
                              "completedAt",
                              isEnglish,
                            )}
                          </dt>
                          <dd>
                            {formatKST(
                              latestScoreAttempt.completedAt ??
                                latestScoreAttempt.scan.completedAt,
                              isEnglish,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            {workOrderVersionMetaLabel(
                              latestScoreVersion,
                              "url",
                              isEnglish,
                            )}
                          </dt>
                          <dd>
                            <a
                              href={latestScoreAttempt.submittedUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {latestScoreAttempt.submittedUrl}
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt>
                            {isEnglish
                              ? "Item-level result"
                              : "항목별 자동검수 결과"}
                          </dt>
                          <dd>
                            {isEnglish
                              ? "Pass " +
                                latestScorePassCount +
                                " · Fail " +
                                latestScoreFailCount +
                                " · Blocked " +
                                latestScoreBlockedCount +
                                " · N/A " +
                                latestScoreNotApplicableCount
                              : "통과 " +
                                latestScorePassCount +
                                " · 실패 " +
                                latestScoreFailCount +
                                " · 확인 불가 " +
                                latestScoreBlockedCount +
                                " · 해당 없음 " +
                                latestScoreNotApplicableCount}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="work-order-score-range">
                  <span>
                    {workOrderVersionScoreLabel(workOrder.version, isEnglish)}
                  </span>
                  <strong>{workOrder.scoreBefore ?? "—"}</strong>
                  <small>
                    {workOrderVersionCompletedLabel(
                      workOrder.version,
                      isEnglish,
                    )}
                  </small>
                </div>
                <div className="work-order-arrow" aria-hidden="true">
                  →
                </div>
                <div className="work-order-score-range expected primary-target">
                  <span>{isEnglish ? "Target score" : "목표 점수"}</span>
                  <strong>
                    {formatGoalRange(
                      scoreGoal.finalMin,
                      scoreGoal.finalMax,
                      isEnglish,
                    )}
                  </strong>
                </div>

                <p className="work-order-target-note">
                  {isEnglish
                    ? "This work order is written to target the displayed score range and improve the remaining items. Actual scores may vary depending on deployment status, server responses, robots.txt, llms.txt, structured data, and AI bot accessibility."
                    : "이 작업지시서는 표시된 목표 점수 범위와 남은 항목 개선을 기준으로 작성되었습니다. 실제 점수는 배포 상태, 서버 응답, robots.txt, llms.txt, 구조화 데이터 반영 여부, AI 봇 접근성에 따라 달라질 수 있습니다."}
                </p>
                <dl>
                  <div>
                    <dt>
                      {workOrderVersionMetaLabel(
                        workOrder.version,
                        "rules",
                        isEnglish,
                      )}
                    </dt>
                    <dd>{workOrder.initialScan.rulesVersion}</dd>
                  </div>
                  <div>
                    <dt>
                      {workOrderVersionMetaLabel(
                        workOrder.version,
                        "completedAt",
                        isEnglish,
                      )}
                    </dt>
                    <dd>
                      {formatKST(workOrder.initialScan.completedAt, isEnglish)}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {workOrderVersionMetaLabel(
                        workOrder.version,
                        "url",
                        isEnglish,
                      )}
                    </dt>
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
              <h2>
                {isEnglish
                  ? "Verify after site improvements"
                  : "사이트 개선 후 검수진행"}
              </h2>
              <p>
                {isEnglish
                  ? "After the developer updates the site, run verification again against the same public site address."
                  : "개발자가 사이트를 수정한 후 사이트 주소를 바꾸지 않고 다시한번 검수를 진행합니다."}
              </p>
            </div>
            {workOrder.status === "VERIFYING" ? (
              <span className="work-order-verification-live">
                {isEnglish
                  ? "Automatic verification in progress"
                  : "자동검수 진행 중"}
              </span>
            ) : null}
          </div>

          {hasLaterVerificationResult ? (
            <div className="work-order-verification-notice">
              <p>
                {isEnglish
                  ? `The V${followUpWorkOrderVersion} work order has been issued. This is the previous work order. Open the V${followUpWorkOrderVersion} work order, review the remaining items, update and deploy the site, then run verification from that work order.`
                  : `V${followUpWorkOrderVersion} 수정 작업지시서가 발행되었습니다. 이 화면은 이전 작업지시서입니다. V${followUpWorkOrderVersion} 작업지시서를 열어 남은 수정 항목을 확인하고, 사이트를 수정·배포한 뒤 V${followUpWorkOrderVersion} 작업지시서 화면에서 검수시작을 진행해 주세요.`}
              </p>
              {followUpWorkOrderEntry ? (
                <Link
                  className="secondary work-order-revision-button"
                  to={`/${locale}/work-orders/${followUpWorkOrderEntry.id}`}
                >
                  {isEnglish
                    ? `Continue in V${followUpWorkOrderVersion} work order`
                    : `V${followUpWorkOrderVersion} 작업지시서에서 수정·검수 진행하기`}
                </Link>
              ) : null}
            </div>
          ) : isLatestVerificationConclusive ? (
            <p className="work-order-verification-notice">
              {hasRemainingVerificationItems
                ? isEnglish
                  ? "Verification is complete. The start button is disabled for this completed work order. Create a follow-up work order from the remaining items if additional improvement is needed."
                  : "2차 검수가 완료되어 이 작업지시서의 검수시작 버튼은 비활성화되었습니다. 추가 개선이 필요하면 남은 항목으로 후속 작업지시서를 만들어 진행해 주세요."
                : isEnglish
                  ? "Verification is complete. No additional verification is needed for this work order."
                  : "2차 검수가 완료되었습니다. 이 작업지시서에서 추가 검수는 필요하지 않습니다."}
            </p>
          ) : canSubmitVerification ? (
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
                      ? "Requesting verification..."
                      : "검수 요청 중..."
                    : verificationSubmitLabel}
                </button>
              </div>
              <small>
                {needsExtraVerificationPayment
                  ? isEnglish
                    ? `Version ${workOrder.version} and later verification requires one additional verification ticket.`
                    : `${workOrder.version}차 이상 작업지시서 검수는 추가 검수권 1회 결제 후 진행할 수 있습니다.`
                  : isEnglish
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

          {(() => {
            const latestAttempt = workOrder.verificationAttempts[0] ?? null;
            const hasVerificationNotice =
              message.startsWith("공개 URL") ||
              message.startsWith("The public URL") ||
              latestAttempt !== null;

            if (!hasVerificationNotice) {
              return null;
            }

            const isAttemptComplete =
              latestAttempt?.status === "PASSED" ||
              latestAttempt?.status === "FAILED" ||
              latestAttempt?.completedAt !== null;

            const isAttemptFailed =
              latestAttempt?.status === "FAILED" ||
              latestAttempt?.scan?.status === "FAILED" ||
              latestAttempt?.errorCode !== null ||
              latestAttempt?.scan?.errorCode !== null;

            const noticeClass = isAttemptFailed
              ? "work-order-message work-order-error"
              : "work-order-message work-order-success";

            const noticeText =
              workOrder.status === "VERIFYING"
                ? isEnglish
                  ? "The submitted URL is being checked."
                  : "현재 제출된 URL을 검사하고 있습니다."
                : isAttemptComplete
                  ? isAttemptFailed
                    ? isEnglish
                      ? "Verification could not be completed. Please review the history below."
                      : "검수를 완료하지 못했습니다. 아래 이력을 확인해 주세요."
                    : isEnglish
                      ? "Verification has been completed."
                      : "검수가 완료되었습니다."
                  : message;

            return (
              <p className={noticeClass} role="status">
                {noticeText}
              </p>
            );
          })()}

          {workOrder.status !== "DRAFT" &&
          workOrder.status !== "CANCELLED" &&
          !hasLaterVerificationResult &&
          isLatestVerificationConclusive &&
          hasRemainingVerificationItems ? (
            <div className="work-order-revision-panel" role="note">
              <div>
                <strong>
                  {isEnglish
                    ? "Create a follow-up from remaining items"
                    : "남은 항목으로 후속 작업지시서 만들기"}
                </strong>
                <p>
                  {isEnglish
                    ? "After a recheck, create a new work order only for the items that still failed or need confirmation."
                    : "재검수 후에도 실패하거나 확인이 필요한 항목만 모아 다음 작업지시서를 만듭니다."}
                </p>
              </div>
              <button
                className="secondary work-order-revision-button"
                type="button"
                onClick={handleRevise}
                disabled={working || workOrder.status === "VERIFYING"}
              >
                {isEnglish
                  ? "Create follow-up from remaining items"
                  : "남은 항목으로 후속 작업지시서 만들기"}
              </button>
            </div>
          ) : null}

          {workOrder.verificationAttempts.length > 0 ? (
            <div className="work-order-verification-history">
              <h3>
                {isEnglish ? "Verification request history" : "검수 요청 이력"}
              </h3>
              <div className="work-order-verification-tabs" role="tablist">
                {workOrder.verificationAttempts.map((attempt) => {
                  const selected = attempt.id === selectedVerificationAttemptId;

                  return (
                    <button
                      aria-selected={selected}
                      className={selected ? "selected" : ""}
                      key={attempt.id}
                      onClick={() =>
                        setSelectedVerificationAttemptId(attempt.id)
                      }
                      role="tab"
                      type="button"
                    >
                      <strong>
                        {isEnglish
                          ? `Verification ${verificationAttemptVersion(workOrder.version)}`
                          : `${verificationAttemptVersion(workOrder.version)}차 검수`}
                      </strong>
                      <span
                        className={`verification-attempt-status verification-attempt-status-${verificationStatusClass(
                          attempt.status,
                        )}`}
                      >
                        {isEnglish
                          ? attempt.status.replaceAll("_", " ").toLowerCase()
                          : (verificationStatusLabels[attempt.status] ??
                            attempt.status)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ol>
                {workOrder.verificationAttempts
                  .filter((attempt) =>
                    selectedVerificationAttemptId
                      ? attempt.id === selectedVerificationAttemptId
                      : attempt.id === workOrder.verificationAttempts[0]?.id,
                  )
                  .map((attempt) => {
                    const passCount = attempt.itemResults.filter(
                      (result) => result.status === "PASS",
                    ).length;
                    const failCount = attempt.itemResults.filter(
                      (result) => result.status === "FAIL",
                    ).length;
                    const blockedCount = attempt.itemResults.filter(
                      (result) => result.status === "BLOCKED",
                    ).length;
                    const notApplicableCount = attempt.itemResults.filter(
                      (result) => result.status === "NOT_APPLICABLE",
                    ).length;

                    return (
                      <li key={attempt.id}>
                        <div>
                          <strong>
                            {isEnglish
                              ? `Verification ${verificationAttemptVersion(workOrder.version)}`
                              : `${verificationAttemptVersion(workOrder.version)}차 검수`}
                          </strong>
                          <span
                            className={`verification-attempt-status verification-attempt-status-${verificationStatusClass(
                              attempt.status,
                            )}`}
                          >
                            {isEnglish
                              ? attempt.status
                                  .replaceAll("_", " ")
                                  .toLowerCase()
                              : (verificationStatusLabels[attempt.status] ??
                                attempt.status)}
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
                            <dt>
                              {isEnglish ? "Verification status" : "검사 상태"}
                            </dt>
                            <dd>
                              {isEnglish
                                ? attempt.scan.status
                                    .replaceAll("_", " ")
                                    .toLowerCase()
                                : (statusLabels[attempt.scan.status] ??
                                  attempt.scan.status)}
                            </dd>
                          </div>
                          <div>
                            <dt>
                              {isEnglish
                                ? "Score after verification"
                                : "검사 후 점수"}
                            </dt>
                            <dd>
                              {attempt.scoreAfter ?? "—"}{" "}
                              {attempt.gradeAfter ?? ""}
                            </dd>
                          </div>
                        </dl>

                        {attempt.itemResults.length > 0 ? (
                          <div className="verification-result-summary">
                            <strong>
                              {isEnglish
                                ? "Item-level automatic verification results"
                                : "항목별 자동검수 결과"}
                            </strong>
                            <div>
                              <span className="verification-count-pass">
                                {isEnglish ? "Pass" : "통과"} {passCount}
                              </span>
                              <span className="verification-count-fail">
                                {isEnglish ? "Fail" : "실패"} {failCount}
                              </span>
                              <span className="verification-count-blocked">
                                {isEnglish ? "Blocked" : "확인 불가"}{" "}
                                {blockedCount}
                              </span>
                              <span className="verification-count-na">
                                {isEnglish ? "Not applicable" : "해당 없음"}{" "}
                                {notApplicableCount}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        {attempt.itemResults.length > 0 ? (
                          <div className="verification-item-results">
                            {attempt.itemResults.map((result) => {
                              const item = workOrder.items.find(
                                (candidate) =>
                                  candidate.id === result.workOrderItemId,
                              );
                              const criterionResults = verificationCriteria(
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
                                          (isEnglish
                                            ? "Work item verification result"
                                            : "작업 항목 검수 결과")}
                                      </h4>
                                    </div>
                                    <b>
                                      {isEnglish
                                        ? result.status
                                            .replaceAll("_", " ")
                                            .toLowerCase()
                                        : (verificationItemStatusLabels[
                                            result.status
                                          ] ?? result.status)}
                                    </b>
                                  </header>

                                  {result.message ? (
                                    <p className="verification-item-message">
                                      {result.message}
                                    </p>
                                  ) : null}

                                  {criterionResults.length > 0 ? (
                                    <div className="verification-criteria-results">
                                      <strong>
                                        {isEnglish
                                          ? "Completion criteria decisions"
                                          : "완료 기준별 판정"}
                                      </strong>
                                      <ul>
                                        {criterionResults.map((criterion) => (
                                          <li
                                            className={`verification-criterion verification-criterion-${verificationStatusClass(
                                              criterion.status,
                                            )}`}
                                            key={criterion.code}
                                          >
                                            <div>
                                              <span>{criterion.code}</span>
                                              <b>
                                                {isEnglish
                                                  ? criterion.status
                                                      .replaceAll("_", " ")
                                                      .toLowerCase()
                                                  : (verificationItemStatusLabels[
                                                      criterion.status
                                                    ] ?? criterion.status)}
                                              </b>
                                            </div>
                                            <p>{criterion.label}</p>
                                            {criterion.message ? (
                                              <small>{criterion.message}</small>
                                            ) : null}
                                            <em>
                                              {criterion.required
                                                ? isEnglish
                                                  ? "Required"
                                                  : "필수"
                                                : isEnglish
                                                  ? "Recommended"
                                                  : "권장"}
                                              {" · "}
                                              {criterion.automated
                                                ? isEnglish
                                                  ? "Automatic decision"
                                                  : "자동 판정"
                                                : isEnglish
                                                  ? "Manual review"
                                                  : "수동 확인"}
                                            </em>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {result.evidence ? (
                                    <details>
                                      <summary>
                                        {isEnglish
                                          ? "View automatic verification evidence"
                                          : "자동검수 증거 보기"}
                                      </summary>
                                      <pre>{evidenceText(result.evidence)}</pre>
                                    </details>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        ) : attempt.status === "PASSED" ||
                          attempt.status === "REWORK_REQUIRED" ? (
                          <p className="work-order-verification-error">
                            {isEnglish
                              ? "No saved item-level verification results."
                              : "저장된 항목별 검수 결과가 없습니다."}
                          </p>
                        ) : null}

                        {attempt.errorCode ? (
                          <p className="work-order-verification-error">
                            {isEnglish ? "Error code" : "오류 코드"}:{" "}
                            {attempt.errorCode}
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
              <h2>
                {isEnglish
                  ? workOrder.version <= 1
                    ? "Improvement items found in the initial verification"
                    : `Remaining improvement items from version ${workOrder.version} verification`
                  : workOrder.version <= 1
                    ? "1차 검수에서 발견된 수정 항목"
                    : `${workOrder.version}차 검수에서 남은 수정 항목`}
              </h2>
              <p>
                {isEnglish
                  ? "Completion is verified against the deployed public URL, not the source code."
                  : "소스코드가 아니라 배포된 공개 URL에서 완료 여부를 확인합니다."}
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
                    <dt>{isEnglish ? "Initial finding" : "1차 판정"}</dt>
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
                        ? "View initial diagnostic evidence"
                        : "최초 검사 증거 보기"}
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
