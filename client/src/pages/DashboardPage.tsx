import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Locale = "ko" | "en";

const dashboardCopy = {
  ko: {
    eyebrow: "SETTINGS",
    title: "계정 설정",
    intro:
      "로그인 정보와 계정 보안 설정을 확인하고, 필요한 계정 작업을 진행할 수 있습니다.",
    email: "이메일",
    accountStatus: "계정 상태",
    loginCount: "로그인 횟수",
    lastLogin: "최종 로그인(KST)",
    noRecord: "기록 없음",
    siteDashboard: "사이트 대시보드",
    changePassword: "비밀번호 변경",
    deleteAccount: "회원탈퇴",
    logout: "로그아웃",
    loggingOut: "로그아웃 중...",
    logoutError: "로그아웃하지 못했습니다. 다시 시도해 주세요.",
    status: {
      ACTIVE: "활성",
      SUSPENDED: "정지",
      DELETED: "삭제됨",
      PENDING: "대기",
    },
  },
  en: {
    eyebrow: "SETTINGS",
    title: "Account Settings",
    intro:
      "Review your sign-in information and account security settings, and manage account actions.",
    email: "Email",
    accountStatus: "Account status",
    loginCount: "Login count",
    lastLogin: "Last login (KST)",
    noRecord: "No record",
    siteDashboard: "Site dashboard",
    changePassword: "Change password",
    deleteAccount: "Delete account",
    logout: "Log out",
    loggingOut: "Logging out...",
    logoutError: "Could not log out. Please try again.",
    status: {
      ACTIVE: "Active",
      SUSPENDED: "Suspended",
      DELETED: "Deleted",
      PENDING: "Pending",
    },
  },
} as const;

function formatKST(value: string | null, locale: Locale): string {
  if (!value) {
    return dashboardCopy[locale].noRecord;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(status: string, locale: Locale): string {
  const labels = dashboardCopy[locale].status as Record<string, string>;
  return labels[status] ?? status;
}

export function DashboardPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = dashboardCopy[normalizedLocale];
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
      navigate(`/${normalizedLocale}/login`, { replace: true });
    } catch {
      setMessage(copy.logoutError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section dashboard-section">
      <div className="content-container section-content">
        <div className="section-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <dl className="surface account-summary">
          <div>
            <dt>{copy.email}</dt>
            <dd>{state.user.email}</dd>
          </div>
          <div>
            <dt>{copy.accountStatus}</dt>
            <dd>{formatStatus(state.user.status, normalizedLocale)}</dd>
          </div>
          <div>
            <dt>{copy.loginCount}</dt>
            <dd>{state.user.loginCount}</dd>
          </div>
          <div>
            <dt>{copy.lastLogin}</dt>
            <dd>{formatKST(state.user.lastLoginAt, normalizedLocale)}</dd>
          </div>
        </dl>

        {message ? (
          <p className="auth-message auth-error" role="alert">
            {message}
          </p>
        ) : null}

        <div className="dashboard-actions">
          <Link className="secondary-action" to={`/${normalizedLocale}/sites`}>
            {copy.siteDashboard}
          </Link>
          <Link
            className="secondary-action"
            to={`/${normalizedLocale}/change-password`}
          >
            {copy.changePassword}
          </Link>
          <Link
            className="secondary-action"
            to={`/${normalizedLocale}/account/delete`}
          >
            {copy.deleteAccount}
          </Link>
          <button
            className="secondary-action"
            type="button"
            onClick={handleLogout}
            disabled={submitting}
          >
            {submitting ? copy.loggingOut : copy.logout}
          </button>
        </div>
      </div>
    </section>
  );
}
