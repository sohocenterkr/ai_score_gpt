import { useEffect, useState } from "react";

interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  environment: string;
  timestampKST: string;
  database: {
    status: "not_configured" | "connected" | "error";
    message?: string;
  };
}

type RequestState =
  | { status: "loading" }
  | { status: "success"; data: HealthResponse }
  | { status: "error"; message: string };

export function SystemPage() {
  const [state, setState] = useState<RequestState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { signal: controller.signal });
        const body = (await response.json()) as HealthResponse;
        if (!response.ok) {
          throw new Error("서버 상태를 정상적으로 확인하지 못했습니다.");
        }
        setState({ status: "success", data: body });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    void loadHealth();
    return () => controller.abort();
  }, []);

  return (
    <section className="full-bleed-section system-section">
      <div className="content-container section-content">
        <div className="section-heading">
          <p className="eyebrow">SYSTEM CHECK</p>
          <h1>프로젝트 기반 상태</h1>
          <p>서버, KST 시간, 데이터베이스 연결 준비 상태를 확인합니다.</p>
        </div>

        {state.status === "loading" ? (
          <div className="surface status-panel" role="status">상태를 확인하고 있습니다.</div>
        ) : null}

        {state.status === "error" ? (
          <div className="surface status-panel status-error" role="alert">{state.message}</div>
        ) : null}

        {state.status === "success" ? (
          <dl className="surface status-grid">
            <div><dt>서비스</dt><dd>{state.data.service}</dd></div>
            <div><dt>서버 상태</dt><dd>{state.data.status}</dd></div>
            <div><dt>실행 환경</dt><dd>{state.data.environment}</dd></div>
            <div><dt>KST 현재 시각</dt><dd>{state.data.timestampKST}</dd></div>
            <div><dt>데이터베이스</dt><dd>{state.data.database.status}</dd></div>
            {state.data.database.message ? (
              <div><dt>DB 안내</dt><dd>{state.data.database.message}</dd></div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
