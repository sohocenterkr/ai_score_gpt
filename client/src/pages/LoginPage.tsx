import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AuthApiError } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

interface LoginLocationState {
  from?: string;
  notice?: string;
}

type Locale = "ko" | "en";

const loginCopy = {
  ko: {
    loading: "로그인 상태를 확인하고 있습니다.",
    error: "로그인 중 오류가 발생했습니다.",
    eyebrow: "SIGN IN",
    title: "로그인",
    intro: "가입한 이메일 주소와 비밀번호를 입력해 주세요.",
    email: "이메일",
    password: "비밀번호",
    forgotPassword: "비밀번호를 잊으셨나요?",
    submitting: "로그인 중...",
    submit: "로그인",
    google: "Google로 로그인",
    switchText: "아직 계정이 없으신가요?",
    signup: "회원가입",
  },
  en: {
    loading: "Checking your sign-in status.",
    error: "An error occurred while signing in.",
    eyebrow: "SIGN IN",
    title: "Log in",
    intro: "Enter the email address and password you used to sign up.",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot your password?",
    submitting: "Logging in...",
    submit: "Log in",
    google: "Log in with Google",
    switchText: "Don’t have an account yet?",
    signup: "Sign up",
  },
} as const;

export function LoginPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = loginCopy[normalizedLocale];
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notice = (location.state as LoginLocationState | null)?.notice;
  const authError = searchParams.get("authError")?.trim() ?? "";

  if (state.status === "loading") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          {copy.loading}
        </div>
      </section>
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={`/${normalizedLocale}`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate(`/${normalizedLocale}`, { replace: true });
    } catch (error) {
      setMessage(error instanceof AuthApiError ? error.message : copy.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          {notice ? (
            <p className="auth-message auth-success" role="status">
              {notice}
            </p>
          ) : null}

          {authError ? (
            <p className="auth-message auth-error" role="alert">
              {authError}
            </p>
          ) : null}

          <label htmlFor="login-email">{copy.email}</label>
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

          <label htmlFor="login-password">{copy.password}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <div className="auth-inline-link">
            <Link to={`/${normalizedLocale}/forgot-password`}>
              {copy.forgotPassword}
            </Link>
          </div>

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? copy.submitting : copy.submit}
          </button>

          <button
            className="auth-submit"
            type="button"
            onClick={() => {
              window.location.href = `/api/auth/google/start?mode=login&locale=${encodeURIComponent(
                normalizedLocale,
              )}`;
            }}
          >
            {copy.google}
          </button>

          <p className="auth-switch">
            {copy.switchText}{" "}
            <Link to={`/${normalizedLocale}/signup`}>{copy.signup}</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
