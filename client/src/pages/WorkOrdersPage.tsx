import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  listWorkOrdersRequest,
  WorkOrderApiError,
  type WorkOrderSummary,
} from "../work-orders/work-order-api";
import "../work-orders.css";

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  ISSUED: "발급",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업 중",
  SUBMITTED: "제출",
  VERIFYING: "검수 중",
  REWORK_REQUIRED: "재작업 필요",
  PASSED: "통과",
  CANCELLED: "취소",
};

function formatKST(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WorkOrdersPage() {
  const { locale = "ko" } = useParams();
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
          setErrorMessage(
            error instanceof WorkOrderApiError
              ? error.message
              : "작업지시서 목록을 불러오지 못했습니다.",
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
  }, []);

  return (
    <section className="full-bleed-section work-orders-section">
      <div className="content-container work-orders-content">
        <header className="work-orders-heading">
          <div>
            <p className="eyebrow">WORK ORDERS</p>
            <h1>수정 작업지시서</h1>
            <p>
              검사 문제를 개발자가 바로 작업할 수 있는 요구사항과 완료
              기준으로 정리합니다.
            </p>
          </div>
          <Link className="work-order-back" to={`/${locale}/sites`}>
            사이트 관리로
          </Link>
        </header>

        {errorMessage ? (
          <p className="work-order-message work-order-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loading ? (
          <div className="surface work-order-empty" role="status">
            작업지시서 목록을 불러오고 있습니다.
          </div>
        ) : null}

        {!loading && workOrders.length === 0 ? (
          <div className="surface work-order-empty">
            <h2>아직 작업지시서가 없습니다.</h2>
            <p>
              검사 결과의 주요 문제를 선택해 첫 작업지시서를 만들어
              주세요.
            </p>
            <Link to={`/${locale}/sites`}>검사 결과 찾기</Link>
          </div>
        ) : null}

        <div className="work-order-list">
          {workOrders.map((workOrder) => (
            <article className="surface work-order-summary-card" key={workOrder.id}>
              <div className="work-order-summary-top">
                <div>
                  <span>{workOrder.orderNumber}</span>
                  <h2>{workOrder.site.name}</h2>
                </div>
                <strong>
                  {statusLabels[workOrder.status] ?? workOrder.status}
                </strong>
              </div>
              <dl>
                <div>
                  <dt>버전</dt>
                  <dd>v{workOrder.version}</dd>
                </div>
                <div>
                  <dt>문제 항목</dt>
                  <dd>{workOrder.itemCount}개</dd>
                </div>
                <div>
                  <dt>현재 점수</dt>
                  <dd>{workOrder.scoreBefore ?? "미계산"}점</dd>
                </div>
                <div>
                  <dt>예상 범위</dt>
                  <dd>
                    {workOrder.expectedScoreMin}~
                    {workOrder.expectedScoreMax}점
                  </dd>
                </div>
              </dl>
              <div className="work-order-summary-footer">
                <span>{formatKST(workOrder.createdAt)}</span>
                <Link
                  to={`/${locale}/work-orders/${workOrder.id}`}
                >
                  작업지시서 보기
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
