import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthApiError, forgotPasswordRequest } from "../auth/auth-api";
import "../password.css";

type Locale = "ko" | "en";

const forgotPasswordCopy = {
  ko: {
    error: "재설정 요청 중 오류가 발생했습니다.",
    eyebrow: "RESET PASSWORD",
    title: "비밀번호 찾기",
    intro: "가입한 이메일 주소로 30분 동안 유효한 일회용 링크를 보냅니다.",
    email: "이메일",
    submitting: "요청 중...",
    submit: "재설정 링크 요청",
    backToLogin: "로그인으로 돌아가기",
  },
  en: {
    error: "An error occurred while requesting the reset link.",
    eyebrow: "RESET PASSWORD",
    title: "Forgot password",
    intro:
      "We will send a one-time link valid for 30 minutes to your registered email address.",
    email: "Email",
    submitting: "Requesting...",
    submit: "Request reset link",
    backToLogin: "Back to login",
  },
} as const;

export function ForgotPasswordPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = forgotPasswordCopy[normalizedLocale];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await forgotPasswordRequest(email);
      setMessage(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : copy.error,
      );
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
          <label htmlFor="forgot-email">{copy.email}</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {message ? (
            <p className="auth-message auth-success" role="status">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="auth-message auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? copy.submitting : copy.submit}
          </button>

          <p className="auth-switch">
            <Link to={`/${normalizedLocale}/login`}>{copy.backToLogin}</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
