import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AuthApiError,
  checkEmailVerificationStatusRequest,
  confirmEmailVerificationRequest,
  sendEmailVerificationRequest,
} from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";


const EMAIL_VERIFICATION_STORAGE_KEY =
  "site-ai-score:signup-email-verification";
const EMAIL_VERIFICATION_STORAGE_TTL_MS = 30 * 60 * 1_000;

interface StoredEmailVerification {
  email: string;
  verificationId: string;
  verified: boolean;
  token?: string;
  savedAt: number;
}

function normalizeEmailForVerification(value: string): string {
  return value.trim().toLowerCase();
}

function readStoredEmailVerification(): StoredEmailVerification | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(EMAIL_VERIFICATION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredEmailVerification>;

    if (
      typeof parsed.email !== "string" ||
      typeof parsed.verificationId !== "string" ||
      typeof parsed.verified !== "boolean" ||
      typeof parsed.savedAt !== "number"
    ) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > EMAIL_VERIFICATION_STORAGE_TTL_MS) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
      return null;
    }

    return {
      email: normalizeEmailForVerification(parsed.email),
      verificationId: parsed.verificationId,
      verified: parsed.verified,
      token: typeof parsed.token === "string" ? parsed.token : undefined,
      savedAt: parsed.savedAt,
    };
  } catch {
    window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
    return null;
  }
}

function saveStoredEmailVerification(
  email: string,
  verificationId: string,
  verified: boolean,
  token?: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    EMAIL_VERIFICATION_STORAGE_KEY,
    JSON.stringify({
      email: normalizeEmailForVerification(email),
      verificationId,
      verified,
      ...(token ? { token } : {}),
      savedAt: Date.now(),
    } satisfies StoredEmailVerification),
  );
}

function clearStoredEmailVerification() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
}

export function SignupPage() {
  const { locale = "ko" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, signup } = useAuth();
  const emailFromVerificationLink = searchParams.get("email")?.trim() ?? "";
  const verificationIdFromLink =
    searchParams.get("emailVerificationId")?.trim() ?? "";
  const tokenFromVerificationLink =
    searchParams.get("emailVerificationToken")?.trim() ?? "";
  const [email, setEmail] = useState(emailFromVerificationLink);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [emailVerificationId, setEmailVerificationId] = useState(
    verificationIdFromLink,
  );
  const [emailVerificationToken, setEmailVerificationToken] = useState(
    tokenFromVerificationLink,
  );
  const [emailVerificationVerified, setEmailVerificationVerified] = useState(
    Boolean(verificationIdFromLink && tokenFromVerificationLink),
  );
  const [verificationNotice, setVerificationNotice] = useState(
    tokenFromVerificationLink
      ? "이메일 인증 링크가 적용되었습니다. 나머지 정보를 입력해 주세요."
      : "",
  );
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyStoredVerification() {
      const stored = readStoredEmailVerification();

      if (!stored) {
        return;
      }

      const currentEmail = normalizeEmailForVerification(email);

      if (currentEmail && currentEmail !== stored.email) {
        return;
      }

      setEmail(stored.email);
      setEmailVerificationId(stored.verificationId);
      setEmailVerificationVerified(stored.verified);

      if (stored.verified) {
        setEmailVerificationToken(stored.token ?? "");
        setVerificationNotice(
          "이메일 인증이 완료되었습니다. 나머지 정보를 입력해 주세요.",
        );
      }
    }

    async function confirmLinkVerification() {
      if (!emailFromVerificationLink || !tokenFromVerificationLink) {
        applyStoredVerification();
        return;
      }

      if (!verificationIdFromLink) {
        setEmail(emailFromVerificationLink);
        setEmailVerificationToken(tokenFromVerificationLink);
        setEmailVerificationVerified(true);
        setVerificationNotice(
          "이메일 인증 링크가 적용되었습니다. 나머지 정보를 입력해 주세요.",
        );
        return;
      }

      try {
        const response = await confirmEmailVerificationRequest({
          email: emailFromVerificationLink,
          emailVerificationId: verificationIdFromLink,
          emailVerificationToken: tokenFromVerificationLink,
        });

        if (cancelled) {
          return;
        }

        if (response.verified) {
          saveStoredEmailVerification(
            emailFromVerificationLink,
            verificationIdFromLink,
            true,
            tokenFromVerificationLink,
          );
          setEmail(emailFromVerificationLink);
          setEmailVerificationId(verificationIdFromLink);
          setEmailVerificationToken(tokenFromVerificationLink);
          setEmailVerificationVerified(true);
          setVerificationNotice(
            "이메일 인증이 완료되었습니다. 원래 열어둔 회원가입 창에서도 계속 가입할 수 있습니다.",
          );
          return;
        }

        setVerificationNotice(response.message);
      } catch {
        if (!cancelled) {
          setVerificationNotice(
            "이메일 인증 상태를 확인하지 못했습니다. 원래 창에서 인증 완료 확인을 눌러 주세요.",
          );
        }
      }
    }

    void confirmLinkVerification();

    function handleStorage(event: StorageEvent) {
      if (event.key === EMAIL_VERIFICATION_STORAGE_KEY) {
        applyStoredVerification();
      }
    }

    function handleFocus() {
      applyStoredVerification();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    email,
    emailFromVerificationLink,
    verificationIdFromLink,
    tokenFromVerificationLink,
  ]);

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
    return <Navigate to={`/${locale}`} replace />;
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    clearStoredEmailVerification();
    setEmail(event.target.value);
    setEmailVerificationId("");
    setEmailVerificationToken("");
    setEmailVerificationVerified(false);
    setVerificationNotice("");
  }

  async function handleSendEmailVerification() {
    setMessage("");
    setVerificationNotice("");

    if (!email.trim()) {
      setMessage("인증받을 이메일 주소를 입력해 주세요.");
      return;
    }

    setVerificationSubmitting(true);

    try {
      clearStoredEmailVerification();
      setEmailVerificationId("");
      setEmailVerificationToken("");
      setEmailVerificationVerified(false);
      const response = await sendEmailVerificationRequest({ email, locale });

      if (response.verificationId) {
        const normalizedEmail = normalizeEmailForVerification(email);
        setEmail(normalizedEmail);
        setEmailVerificationId(response.verificationId);
        saveStoredEmailVerification(
          normalizedEmail,
          response.verificationId,
          false,
        );
      }

      setVerificationNotice(response.message);
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "인증 메일 발송 중 오류가 발생했습니다.",
      );
    } finally {
      setVerificationSubmitting(false);
    }
  }

  async function handleCheckEmailVerificationStatus() {
    setMessage("");

    if (!emailVerificationId) {
      setMessage("먼저 인증 메일을 받아 주세요.");
      return;
    }

    try {
      const response = await checkEmailVerificationStatusRequest({
        email,
        emailVerificationId,
      });

      if (response.verified) {
        saveStoredEmailVerification(email, emailVerificationId, true);
        setEmailVerificationToken("");
        setEmailVerificationVerified(true);
        setVerificationNotice(
          "이메일 인증이 완료되었습니다. 회원가입을 계속해 주세요.",
        );
        return;
      }

      setMessage(
        "아직 이메일 인증이 완료되지 않았습니다. 메일의 인증 링크를 먼저 눌러 주세요.",
      );
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "이메일 인증 상태를 확인하지 못했습니다.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!emailVerificationToken && !emailVerificationVerified) {
      setMessage("이메일 인증을 완료한 뒤 회원가입해 주세요.");
      return;
    }

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
        ...(emailVerificationToken
          ? { emailVerificationToken }
          : { emailVerificationId }),
        termsAccepted: true,
        privacyAccepted: true,
      });
      clearStoredEmailVerification();
      navigate(`/${locale}`, { replace: true });
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
            onChange={handleEmailChange}
            required
          />

          <button
            className="secondary-action email-verification-action"
            type="button"
            onClick={handleSendEmailVerification}
            disabled={verificationSubmitting || submitting}
          >
            {verificationSubmitting ? "인증 메일 발송 중..." : "인증 메일 받기"}
          </button>
          <p className="field-guide email-verification-guide">
            메일의 인증 링크를 누른 뒤 이 화면에서 인증 완료를 확인할 수 있습니다.
          </p>

          {emailVerificationId && !emailVerificationVerified ? (
            <button
              className="secondary-action email-verification-action"
              type="button"
              onClick={handleCheckEmailVerificationStatus}
              disabled={verificationSubmitting || submitting}
            >
              인증 완료 확인
            </button>
          ) : null}

          {verificationNotice ? (
            <p className="auth-message auth-success" role="status">
              {verificationNotice}
            </p>
          ) : null}

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
