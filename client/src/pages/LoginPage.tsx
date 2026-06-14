import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AuthApiError } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

interface LoginLocationState {
  from?: string;
}

export function LoginPage() {
  const { locale = "ko" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "loading") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          로그인 상태를 확인하고 있습니다.
        </div>
      </section>
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={`/${locale}/dashboard`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await login({ email, password });
      const destination =
        (location.state as LoginLocationState | null)?.from ??
        `/${locale}/dashboard`;
      navigate(destination, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "로그인 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">SIGN IN</p>
          <h1>로그인</h1>
          <p>가입한 이메일 주소와 비밀번호를 입력해 주세요.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>

          <p className="auth-switch">
            아직 계정이 없으신가요?{" "}
            <Link to={`/${locale}/signup`}>회원가입</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
