import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelWorkOrderRequest,
  getWorkOrderRequest,
  issueWorkOrderRequest,
  reviseWorkOrderRequest,
  workOrderExportUrl,
  WorkOrderApiError,
  type WorkOrderDetail,
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

export function WorkOrderPage() {
  const { locale = "ko", workOrderId = "" } = useParams();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] =
    useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

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
          <button className="secondary" type="button" disabled>
            PDF · 다음 단계
          </button>
        </div>

        <section className="work-order-items-section">
          <div className="work-order-section-heading">
            <div>
              <h2>문제별 수정 요구사항</h2>
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
                    <span>{item.isRequired ? "필수" : "일반"}</span>
                    <span>예상 {item.weight}점</span>
                  </div>
                </header>

                <dl className="work-order-item-meta">
                  <div>
                    <dt>대상 URL</dt>
                    <dd>{item.targetUrl}</dd>
                  </div>
                  <div>
                    <dt>현재 판정</dt>
                    <dd>{item.finding?.status ?? "원본 없음"}</dd>
                  </div>
                  <div>
                    <dt>중요도</dt>
                    <dd>{item.finding?.severity ?? "미확인"}</dd>
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
          예상 점수 범위는 선택한 규칙의 배점을 기준으로 계산한
          참고값입니다. 동일 규칙 버전과 검사 조건으로 재검사하더라도
          실제 상승 폭이나 AI 검색 노출은 보장되지 않습니다.
        </p>
      </div>
    </section>
  );
}
