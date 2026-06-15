import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
          <p>
            검사할 사이트를 등록하고, 진단·점수·작업지시서로 이어지는
            핵심 서비스 작업을 시작할 수 있습니다.
          </p>
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

        <div className="dashboard-actions">
          <Link className="secondary-action" to={`/${locale}/sites`}>
            사이트 관리
          </Link>
          <Link className="secondary-action" to={`/${locale}/change-password`}>
            비밀번호 변경
          </Link>
          <button
            className="secondary-action"
            type="button"
            onClick={handleLogout}
            disabled={submitting}
          >
            {submitting ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </section>
  );
}
