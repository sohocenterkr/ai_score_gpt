import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AuthApiError } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

export function SignupPage() {
  const { locale = "ko" } = useParams();
  const navigate = useNavigate();
  const { state, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
    return <Navigate to={`/${locale}/sites`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setMessage("이용약관과 개인정보처리방침에 모두 동의해 주세요.");
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        email,
        name,
        password,
        passwordConfirm,
        termsAccepted: true,
        privacyAccepted: true,
      });
      navigate(`/${locale}/sites`, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "회원가입 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h1>회원가입</h1>
          <p>로그인 아이디는 이메일 주소입니다.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="signup-email">이메일</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="signup-name">이름</label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="password-guide"
            required
          />
          <p id="password-guide" className="field-guide">
            영문자와 숫자를 포함하여 10자 이상 입력해 주세요.
          </p>

          <label htmlFor="signup-password-confirm">비밀번호 확인</label>
          <input
            id="signup-password-confirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
          />

          <label className="consent-row">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>이용약관에 동의합니다. (필수)</span>
          </label>

          <label className="consent-row">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
            />
            <span>개인정보처리방침에 동의합니다. (필수)</span>
          </label>

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "가입 중..." : "회원가입"}
          </button>

          <p className="auth-switch">
            이미 계정이 있으신가요?{" "}
            <Link to={`/${locale}/login`}>로그인</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
