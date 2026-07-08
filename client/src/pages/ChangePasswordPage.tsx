import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthApiError, changePasswordRequest } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";
import "../password.css";

type Locale = "ko" | "en";

const changePasswordCopy = {
  ko: {
    mismatch: "새 비밀번호 확인이 일치하지 않습니다.",
    notice: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.",
    error: "비밀번호 변경 중 오류가 발생했습니다.",
    eyebrow: "SECURITY",
    title: "비밀번호 변경",
    intro: "변경 후에는 모든 기기에서 다시 로그인해야 합니다.",
    currentPassword: "현재 비밀번호",
    newPassword: "새 비밀번호",
    passwordConfirm: "새 비밀번호 확인",
    submitting: "변경 중...",
    submit: "비밀번호 변경",
    backToSettings: "설정으로 돌아가기",
  },
  en: {
    mismatch: "New password confirmation does not match.",
    notice:
      "Your password has been changed. Please log in with the new password.",
    error: "An error occurred while changing your password.",
    eyebrow: "SECURITY",
    title: "Change password",
    intro:
      "After changing your password, you must log in again on all devices.",
    currentPassword: "Current password",
    newPassword: "New password",
    passwordConfirm: "Confirm new password",
    submitting: "Changing...",
    submit: "Change password",
    backToSettings: "Back to settings",
  },
} as const;

export function ChangePasswordPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = changePasswordCopy[normalizedLocale];
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword !== passwordConfirm) {
      setMessage(copy.mismatch);
      return;
    }

    setSubmitting(true);

    try {
      await changePasswordRequest({ currentPassword, newPassword });
      await refresh();
      navigate(`/${normalizedLocale}/login`, {
        replace: true,
        state: {
          notice: copy.notice,
        },
      });
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
          <label htmlFor="current-password">{copy.currentPassword}</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />

          <label htmlFor="change-password">{copy.newPassword}</label>
          <input
            id="change-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="change-password-confirm">
            {copy.passwordConfirm}
          </label>
          <input
            id="change-password-confirm"
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
            <Link to={`/${normalizedLocale}/settings`}>
              {copy.backToSettings}
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
