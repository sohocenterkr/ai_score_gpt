import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AuthApiError,
  forgotPasswordRequest,
} from "../auth/auth-api";
import "../password.css";

export function ForgotPasswordPage() {
  const { locale = "ko" } = useParams();
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
          : "재설정 요청 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">RESET PASSWORD</p>
          <h1>비밀번호 찾기</h1>
          <p>가입한 이메일 주소로 30분 동안 유효한 일회용 링크를 보냅니다.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="forgot-email">이메일</label>
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
            {submitting ? "요청 중..." : "재설정 링크 요청"}
          </button>

          <p className="auth-switch">
            <Link to={`/${locale}/login`}>로그인으로 돌아가기</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
