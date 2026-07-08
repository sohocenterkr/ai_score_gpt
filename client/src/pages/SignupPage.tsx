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

type Locale = "ko" | "en";

const signupCopy = {
  ko: {
    loading: "로그인 상태를 확인하고 있습니다.",
    checkingVerification: "이메일 인증을 확인하고 있습니다.",
    verified: "이메일 인증이 완료되었습니다. 홈으로 이동합니다.",
    verifyError: "이메일 인증을 완료하지 못했습니다.",
    consentError: "이용약관과 개인정보처리방침에 모두 동의해 주세요.",
    passwordMismatch: "비밀번호 확인이 일치하지 않습니다.",
    success:
      "회원가입이 완료되었습니다. 이메일 인증 링크를 누르면 자동으로 로그인됩니다.",
    submitError: "회원가입 중 오류가 발생했습니다.",
    eyebrow: "CREATE ACCOUNT",
    title: "회원가입",
    intro: "Google 계정 또는 이메일로 가입할 수 있습니다.",
    termsConsent: "이용약관에 동의합니다. (필수)",
    privacyConsent: "개인정보처리방침에 동의합니다. (필수)",
    google: "Google로 회원가입",
    emailSignup: "이메일로 회원가입",
    email: "이메일",
    name: "이름",
    password: "비밀번호",
    passwordGuide: "영문자와 숫자를 포함하여 10자 이상 입력해 주세요.",
    passwordConfirm: "비밀번호 확인",
    submitting: "가입 중...",
    submit: "회원가입",
    switchText: "이미 계정이 있으신가요?",
    login: "로그인",
  },
  en: {
    loading: "Checking your sign-in status.",
    checkingVerification: "Checking email verification.",
    verified: "Your email has been verified. Redirecting to the home page.",
    verifyError: "Could not complete email verification.",
    consentError: "Please agree to both the Terms and Privacy Policy.",
    passwordMismatch: "Password confirmation does not match.",
    success:
      "Sign-up is complete. Use the email verification link to sign in automatically.",
    submitError: "An error occurred while creating your account.",
    eyebrow: "CREATE ACCOUNT",
    title: "Sign up",
    intro: "Create an account with Google or email.",
    termsConsent: "I agree to the Terms. (required)",
    privacyConsent: "I agree to the Privacy Policy. (required)",
    google: "Sign up with Google",
    emailSignup: "Sign up with email",
    email: "Email",
    name: "Name",
    password: "Password",
    passwordGuide: "Use at least 10 characters including letters and numbers.",
    passwordConfirm: "Confirm password",
    submitting: "Signing up...",
    submit: "Sign up",
    switchText: "Already have an account?",
    login: "Log in",
  },
} as const;

export function SignupPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = signupCopy[normalizedLocale];
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

        setSuccessMessage(copy.verified);
        await refresh();

        if (!cancelled) {
          navigate(`/${normalizedLocale}`, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof AuthApiError ? error.message : copy.verifyError,
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
    copy.verifyError,
    copy.verified,
    emailFromVerificationLink,
    verificationIdFromLink,
    tokenFromVerificationLink,
    normalizedLocale,
    navigate,
    refresh,
  ]);

  if (state.status === "loading" || confirmingVerification) {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          {confirmingVerification ? copy.checkingVerification : copy.loading}
        </div>
      </section>
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={`/${normalizedLocale}`} replace />;
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
      setMessage(copy.consentError);
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
      normalizedLocale,
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
      setMessage(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        email,
        name,
        password,
        passwordConfirm,
        locale: normalizedLocale,
        termsAccepted: true,
        privacyAccepted: true,
      });

      setSuccessMessage(copy.success);
    } catch (error) {
      setMessage(
        error instanceof AuthApiError ? error.message : copy.submitError,
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
          <label className="consent-row">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                clearMessages();
              }}
            />
            <span>{copy.termsConsent}</span>
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
            <span>{copy.privacyConsent}</span>
          </label>

          <button
            className="auth-submit"
            type="button"
            onClick={handleGoogleSignup}
          >
            {copy.google}
          </button>

          <button
            className="auth-submit"
            type="button"
            onClick={handleEmailSignupOpen}
            aria-expanded={emailSignupOpen}
          >
            {copy.emailSignup}
          </button>

          {emailSignupOpen ? (
            <>
              <label htmlFor="signup-email">{copy.email}</label>
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

              <label htmlFor="signup-name">{copy.name}</label>
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

              <label htmlFor="signup-password">{copy.password}</label>
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
                required
              />
              <p className="field-guide">{copy.passwordGuide}</p>

              <label htmlFor="signup-password-confirm">
                {copy.passwordConfirm}
              </label>
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

              <button
                className="auth-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? copy.submitting : copy.submit}
              </button>
            </>
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

          {successMessage ? (
            <p className="auth-message auth-success" role="status">
              {successMessage}
            </p>
          ) : null}

          <p className="auth-switch">
            {copy.switchText}{" "}
            <Link to={`/${normalizedLocale}/login`}>{copy.login}</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
