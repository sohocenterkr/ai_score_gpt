import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AuthApiError,
  resetPasswordRequest,
  validateResetTokenRequest,
} from "../auth/auth-api";
import "../password.css";

type Locale = "ko" | "en";
type TokenState = "checking" | "valid" | "invalid" | "error";

const resetPasswordCopy = {
  ko: {
    passwordMismatch: "비밀번호 확인이 일치하지 않습니다.",
    resetError: "비밀번호 재설정 중 오류가 발생했습니다.",
    newPasswordEyebrow: "NEW PASSWORD",
    checkingTitle: "재설정 링크 확인",
    checkingBody: "재설정 링크가 유효한지 확인하고 있습니다.",
    resetLinkEyebrow: "RESET LINK",
    invalidTitle: "사용할 수 없는 링크입니다",
    invalidBody: "재설정 링크가 올바르지 않거나 만료되었습니다.",
    requestAgain: "재설정 링크 다시 요청",
    errorTitle: "링크를 확인하지 못했습니다",
    errorBody: "네트워크 상태를 확인한 뒤 페이지를 새로고침해 주세요.",
    title: "새 비밀번호 설정",
    intro: "영문자와 숫자를 포함하여 10자 이상 입력해 주세요.",
    newPassword: "새 비밀번호",
    passwordConfirm: "새 비밀번호 확인",
    submitting: "변경 중...",
    submit: "비밀번호 재설정",
  },
  en: {
    passwordMismatch: "Password confirmation does not match.",
    resetError: "An error occurred while resetting your password.",
    newPasswordEyebrow: "NEW PASSWORD",
    checkingTitle: "Checking reset link",
    checkingBody: "Checking whether the reset link is valid.",
    resetLinkEyebrow: "RESET LINK",
    invalidTitle: "This link cannot be used",
    invalidBody: "The reset link is invalid or has expired.",
    requestAgain: "Request another reset link",
    errorTitle: "Could not check the link",
    errorBody: "Please check your network connection and refresh the page.",
    title: "Set a new password",
    intro: "Use at least 10 characters including letters and numbers.",
    newPassword: "New password",
    passwordConfirm: "Confirm new password",
    submitting: "Changing...",
    submit: "Reset password",
  },
} as const;

export function ResetPasswordPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = resetPasswordCopy[normalizedLocale];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [tokenState, setTokenState] = useState<TokenState>(
    token ? "checking" : "invalid",
  );
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setTokenState("invalid");
      return;
    }

    setTokenState("checking");

    void validateResetTokenRequest(token)
      .then((response) => {
        if (!cancelled) {
          setTokenState(response.valid ? "valid" : "invalid");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTokenState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (tokenState !== "valid" || !token) {
      setTokenState("invalid");
      return;
    }

    if (newPassword !== passwordConfirm) {
      setMessage(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);

    try {
      const response = await resetPasswordRequest({ token, newPassword });
      navigate(`/${normalizedLocale}/login`, {
        replace: true,
        state: { notice: response.message },
      });
    } catch (error) {
      if (
        error instanceof AuthApiError &&
        error.code === "AUTH_RESET_TOKEN_INVALID"
      ) {
        setTokenState("invalid");
        return;
      }

      setMessage(
        error instanceof AuthApiError ? error.message : copy.resetError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenState === "checking") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container">
          <div className="auth-heading">
            <p className="eyebrow">{copy.newPasswordEyebrow}</p>
            <h1>{copy.checkingTitle}</h1>
          </div>
          <div className="auth-form surface" role="status">
            {copy.checkingBody}
          </div>
        </div>
      </section>
    );
  }

  if (tokenState === "invalid") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container">
          <div className="auth-heading">
            <p className="eyebrow">{copy.resetLinkEyebrow}</p>
            <h1>{copy.invalidTitle}</h1>
          </div>
          <div className="auth-form surface">
            <p className="auth-message auth-error" role="alert">
              {copy.invalidBody}
            </p>
            <Link
              className="auth-submit"
              to={`/${normalizedLocale}/forgot-password`}
            >
              {copy.requestAgain}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (tokenState === "error") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container">
          <div className="auth-heading">
            <p className="eyebrow">{copy.resetLinkEyebrow}</p>
            <h1>{copy.errorTitle}</h1>
          </div>
          <div className="auth-form surface">
            <p className="auth-message auth-error" role="alert">
              {copy.errorBody}
            </p>
            <Link
              className="auth-submit"
              to={`/${normalizedLocale}/forgot-password`}
            >
              {copy.requestAgain}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">{copy.newPasswordEyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="reset-password">{copy.newPassword}</label>
          <input
            id="reset-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="reset-password-confirm">{copy.passwordConfirm}</label>
          <input
            id="reset-password-confirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
          />

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? copy.submitting : copy.submit}
          </button>

          <p className="auth-switch">
            <Link to={`/${normalizedLocale}/forgot-password`}>
              {copy.requestAgain}
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
