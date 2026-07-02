import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AuthApiError,
  confirmEmailVerificationRequest,
} from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

export function SignupPage() {
  const { locale = "ko" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, signup, refresh } = useAuth();

  const authErrorFromQuery = searchParams.get("authError")?.trim() ?? "";
  const emailFromVerificationLink = searchParams.get("email")?.trim() ?? "";
  const verificationIdFromLink =
    searchParams.get("emailVerificationId")?.trim() ?? "";
  const tokenFromVerificationLink =
    searchParams.get("emailVerificationToken")?.trim() ?? "";

  const [emailSignupOpen, setEmailSignupOpen] = useState(false);
  const [email, setEmail] = useState(emailFromVerificationLink);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingVerification, setConfirmingVerification] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function confirmEmailVerification() {
      if (
        !emailFromVerificationLink ||
        !verificationIdFromLink ||
        !tokenFromVerificationLink
      ) {
        return;
      }

      setConfirmingVerification(true);
      setMessage("");
      setSuccessMessage("");

      try {
        const response = await confirmEmailVerificationRequest({
          email: emailFromVerificationLink,
          emailVerificationId: verificationIdFromLink,
          emailVerificationToken: tokenFromVerificationLink,
        });

        if (cancelled) {
          return;
        }

        if (!response.verified) {
          setMessage(response.message);
          return;
        }

        setSuccessMessage("이메일 인증이 완료되었습니다. 홈으로 이동합니다.");
        await refresh();

        if (!cancelled) {
          navigate(`/${locale}`, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof AuthApiError
              ? error.message
              : "이메일 인증을 완료하지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setConfirmingVerification(false);
        }
      }
    }

    void confirmEmailVerification();

    return () => {
      cancelled = true;
    };
  }, [
    emailFromVerificationLink,
    verificationIdFromLink,
    tokenFromVerificationLink,
    locale,
    navigate,
    refresh,
  ]);

  if (state.status === "loading" || confirmingVerification) {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          {confirmingVerification
            ? "이메일 인증을 확인하고 있습니다."
            : "로그인 상태를 확인하고 있습니다."}
        </div>
      </section>
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={`/${locale}`} replace />;
  }

  function clearMessages() {
    setMessage("");
    setSuccessMessage("");
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    clearMessages();
  }

  function validateConsent(): boolean {
    if (!termsAccepted || !privacyAccepted) {
      setMessage("이용약관과 개인정보처리방침에 모두 동의해 주세요.");
      return false;
    }

    return true;
  }

  function handleGoogleSignup() {
    clearMessages();

    if (!validateConsent()) {
      return;
    }

    window.location.href = `/api/auth/google/start?mode=signup&locale=${encodeURIComponent(
      locale,
    )}`;
  }

  function handleEmailSignupOpen() {
    clearMessages();

    if (!validateConsent()) {
      return;
    }

    setEmailSignupOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!validateConsent()) {
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        email,
        name,
        password,
        passwordConfirm,
        locale,
        termsAccepted: true,
        privacyAccepted: true,
      });

      setSuccessMessage(
        "회원가입이 완료되었습니다. 이메일 인증 링크를 누르면 자동으로 로그인됩니다.",
      );
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
          <p>Google 계정 또는 이메일로 가입할 수 있습니다.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label className="consent-row">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                clearMessages();
              }}
            />
            <span>이용약관에 동의합니다. (필수)</span>
          </label>

          <label className="consent-row">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => {
                setPrivacyAccepted(event.target.checked);
                clearMessages();
              }}
            />
            <span>개인정보처리방침에 동의합니다. (필수)</span>
          </label>

          <button
            className="auth-submit"
            type="button"
            onClick={handleGoogleSignup}
          >
            Google로 회원가입
          </button>

          <button
            className="auth-submit"
            type="button"
            onClick={handleEmailSignupOpen}
            aria-expanded={emailSignupOpen}
          >
            이메일로 회원가입
          </button>

          {emailSignupOpen ? (
            <>
              <label htmlFor="signup-email">이메일</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={handleEmailChange}
                required
              />

              <label htmlFor="signup-name">이름</label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearMessages();
                }}
                required
              />

              <label htmlFor="signup-password">비밀번호</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearMessages();
                }}
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
                onChange={(event) => {
                  setPasswordConfirm(event.target.value);
                  clearMessages();
                }}
                required
              />
            </>
          ) : null}

          {successMessage ? (
            <p className="auth-message auth-success" role="status">
              {successMessage}
            </p>
          ) : null}

          {authErrorFromQuery ? (
            <p className="auth-message auth-error" role="alert">
              {authErrorFromQuery}
            </p>
          ) : null}

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          {emailSignupOpen ? (
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? "가입 중..." : "회원가입"}
            </button>
          ) : null}

          <p className="auth-switch">
            이미 계정이 있으신가요?{" "}
            <Link to={`/${locale}/login`}>로그인</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
