import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  listWorkOrdersRequest,
  WorkOrderApiError,
  type WorkOrderSummary,
} from "../work-orders/work-order-api";
import "../work-orders.css";

type Locale = "ko" | "en";

const statusLabels = {
  ko: {
    DRAFT: "초안",
    ISSUED: "발급",
    ASSIGNED: "배정",
    IN_PROGRESS: "작업 중",
    SUBMITTED: "제출",
    VERIFYING: "검수 중",
    REWORK_REQUIRED: "재작업 필요",
    PASSED: "통과",
    CANCELLED: "취소",
  },
  en: {
    DRAFT: "Draft",
    ISSUED: "Issued",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In progress",
    SUBMITTED: "Submitted",
    VERIFYING: "Verifying",
    REWORK_REQUIRED: "Rework required",
    PASSED: "Passed",
    CANCELLED: "Cancelled",
  },
} satisfies Record<Locale, Record<string, string>>;

const workOrdersCopy = {
  ko: {
    eyebrow: "WORK ORDERS",
    title: "수정 작업지시서",
    intro:
      "검사 문제를 개발자가 바로 작업할 수 있는 요구사항과 완료 기준으로 정리합니다.",
    backToSites: "사이트 관리로",
    loading: "작업지시서 목록을 불러오고 있습니다.",
    emptyTitle: "아직 작업지시서가 없습니다.",
    emptyDescription:
      "검사 결과의 주요 문제를 선택해 첫 작업지시서를 만들어 주세요.",
    findScanResult: "검사 결과 찾기",
    loadError: "작업지시서 목록을 불러오지 못했습니다.",
    version: "버전",
    issueItems: "문제 항목",
    itemCount: (count: number) => `${count}개`,
    currentScore: "현재 점수",
    notCalculated: "미계산",
    pointSuffix: "점",
    expectedRange: "개선 목표",
    viewWorkOrder: "작업지시서 보기",
  },
  en: {
    eyebrow: "WORK ORDERS",
    title: "Improvement Work Orders",
    intro:
      "Turn diagnostic issues into developer-ready requirements and completion criteria.",
    backToSites: "Back to site dashboard",
    loading: "Loading work orders.",
    emptyTitle: "No work orders yet.",
    emptyDescription:
      "Select key issues from a diagnostic result to create your first work order.",
    findScanResult: "Find diagnostic result",
    loadError: "Could not load the work order list.",
    version: "Version",
    issueItems: "Issue items",
    itemCount: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
    currentScore: "Current score",
    notCalculated: "Not calculated",
    pointSuffix: "points",
    expectedRange: "Improvement target",
    viewWorkOrder: "View work order",
  },
} as const;

function formatKST(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function workOrderGoalRange(scoreBefore: number | null | undefined) {
  const current = Math.max(0, Math.min(100, Math.round(scoreBefore ?? 0)));
  const min =
    current < 70 ? 70 : current < 80 ? 80 : current < 90 ? 90 : current;

  return {
    min: Math.max(80, Math.min(100, min)),
    max: 100,
  };
}

function translateWorkOrderError(message: string, locale: Locale): string {
  if (locale === "ko") return message;

  const exact: Record<string, string> = {
    "작업지시서 목록을 불러오지 못했습니다.":
      "Could not load the work order list.",
  };

  return exact[message] ?? message;
}

export function WorkOrdersPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = workOrdersCopy[normalizedLocale];
  const labels: Record<string, string> = statusLabels[normalizedLocale];
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void listWorkOrdersRequest()
      .then((items) => {
        if (!cancelled) {
          setWorkOrders(items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message =
            error instanceof WorkOrderApiError ? error.message : copy.loadError;
          setErrorMessage(translateWorkOrderError(message, normalizedLocale));
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
  }, [copy.loadError, normalizedLocale]);

  return (
    <section className="full-bleed-section work-orders-section">
      <div className="content-container work-orders-content">
        <header className="work-orders-heading">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
          <Link className="work-order-back" to={`/${normalizedLocale}/sites`}>
            {copy.backToSites}
          </Link>
        </header>

        {errorMessage ? (
          <p className="work-order-message work-order-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loading ? (
          <div className="surface work-order-empty" role="status">
            {copy.loading}
          </div>
        ) : null}

        {!loading && workOrders.length === 0 ? (
          <div className="surface work-order-empty">
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyDescription}</p>
            <Link to={`/${normalizedLocale}/sites`}>{copy.findScanResult}</Link>
          </div>
        ) : null}

        <div className="work-order-list">
          {workOrders.map((workOrder) => (
            <article
              className="surface work-order-summary-card"
              key={workOrder.id}
            >
              <div className="work-order-summary-top">
                <div>
                  <span>{workOrder.orderNumber}</span>
                  <h2>{workOrder.site.name}</h2>
                </div>
                <strong>{labels[workOrder.status] ?? workOrder.status}</strong>
              </div>
              <dl>
                <div>
                  <dt>{copy.version}</dt>
                  <dd>v{workOrder.version}</dd>
                </div>
                <div>
                  <dt>{copy.issueItems}</dt>
                  <dd>{copy.itemCount(workOrder.itemCount)}</dd>
                </div>
                <div>
                  <dt>{copy.currentScore}</dt>
                  <dd>
                    {workOrder.scoreBefore === null
                      ? copy.notCalculated
                      : `${workOrder.scoreBefore} ${copy.pointSuffix}`}
                  </dd>
                </div>
                <div>
                  <dt>{copy.expectedRange}</dt>
                  <dd>
                    {workOrderGoalRange(workOrder.scoreBefore).min}~
                    {workOrderGoalRange(workOrder.scoreBefore).max}{" "}
                    {copy.pointSuffix}
                  </dd>
                </div>
              </dl>
              <div className="work-order-summary-footer">
                <span>{formatKST(workOrder.createdAt, normalizedLocale)}</span>
                <Link to={`/${normalizedLocale}/work-orders/${workOrder.id}`}>
                  {copy.viewWorkOrder}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
