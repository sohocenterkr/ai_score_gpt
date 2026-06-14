import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function formatKST(value: string | null): string {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DashboardPage() {
  const { locale = "ko" } = useParams();
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (state.status !== "authenticated") {
    return null;
  }

  async function handleLogout() {
    setMessage("");
    setSubmitting(true);

    try {
      await logout();
      navigate(`/${locale}/login`, { replace: true });
    } catch {
      setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section dashboard-section">
      <div className="content-container section-content">
        <div className="section-heading">
          <p className="eyebrow">DASHBOARD</p>
          <h1>{state.user.name}님, 반갑습니다.</h1>
          <p>인증 기반이 정상적으로 연결된 초기 대시보드입니다.</p>
        </div>

        <dl className="surface account-summary">
          <div>
            <dt>이메일</dt>
            <dd>{state.user.email}</dd>
          </div>
          <div>
            <dt>계정 상태</dt>
            <dd>{state.user.status}</dd>
          </div>
          <div>
            <dt>로그인 횟수</dt>
            <dd>{state.user.loginCount}</dd>
          </div>
          <div>
            <dt>최종 로그인(KST)</dt>
            <dd>{formatKST(state.user.lastLoginAt)}</dd>
          </div>
        </dl>

        {message ? (
          <p className="auth-message auth-error" role="alert">
            {message}
          </p>
        ) : null}

        <button
          className="secondary-action"
          type="button"
          onClick={handleLogout}
          disabled={submitting}
        >
          {submitting ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </section>
  );
}
