import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthApiError } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

type Locale = "ko" | "en";

const deleteAccountCopy = {
  ko: {
    confirmationValue: "회원탈퇴",
    serverConfirmationValue: "회원탈퇴",
    confirmationError: "확인 문구에 회원탈퇴를 정확히 입력해 주세요.",
    error: "회원탈퇴 처리 중 오류가 발생했습니다.",
    eyebrow: "ACCOUNT",
    title: "회원탈퇴",
    intro: "계정과 관련 데이터가 삭제되는 작업입니다.",
    warningTitle: "탈퇴 전 반드시 확인해 주세요.",
    warnings: [
      "탈퇴 전에 필요한 모든 자료를 먼저 다운로드해 주세요.",
      "탈퇴 후에는 같은 이메일 아이디로 다시 가입할 수 없습니다.",
      "탈퇴하면 등록한 사이트, 진단 결과, 작업지시서 등 계정 관련 데이터가 삭제됩니다.",
    ],
    currentPassword: "현재 비밀번호",
    confirmationLabel: "확인 문구",
    fieldGuide: "계속하려면 확인 문구에",
    fieldGuideSuffix: "를 입력해 주세요.",
    submitting: "탈퇴 처리 중...",
    submit: "회원탈퇴",
    backToSettings: "설정으로 돌아가기",
  },
  en: {
    confirmationValue: "DELETE",
    serverConfirmationValue: "회원탈퇴",
    confirmationError: "Please type DELETE exactly in the confirmation field.",
    error: "An error occurred while deleting your account.",
    eyebrow: "ACCOUNT",
    title: "Delete account",
    intro: "This will delete your account and related data.",
    warningTitle: "Please check before deleting your account.",
    warnings: [
      "Download any materials you need before deleting your account.",
      "After deletion, you cannot sign up again with the same email address.",
      "Your registered websites, diagnostic results, work orders, and related account data will be deleted.",
    ],
    currentPassword: "Current password",
    confirmationLabel: "Confirmation text",
    fieldGuide: "To continue, type",
    fieldGuideSuffix: "in the confirmation field.",
    submitting: "Deleting account...",
    submit: "Delete account",
    backToSettings: "Back to settings",
  },
} as const;

export function DeleteAccountPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale: Locale = locale === "en" ? "en" : "ko";
  const copy = deleteAccountCopy[normalizedLocale];
  const navigate = useNavigate();
  const { deleteAccount } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (confirmation.trim() !== copy.confirmationValue) {
      setMessage(copy.confirmationError);
      return;
    }

    setSubmitting(true);

    try {
      await deleteAccount({
        currentPassword,
        confirmation: copy.serverConfirmationValue,
      });
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
          <div className="auth-message auth-error" role="note">
            <strong>{copy.warningTitle}</strong>
            {copy.warnings.map((warning) => (
              <span key={warning}>
                <br />
                {warning}
              </span>
            ))}
          </div>

          <label htmlFor="delete-current-password">
            {copy.currentPassword}
          </label>
          <input
            id="delete-current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />

          <label htmlFor="delete-confirmation">{copy.confirmationLabel}</label>
          <input
            id="delete-confirmation"
            name="confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={copy.confirmationValue}
            required
          />
          <p className="field-guide">
            {copy.fieldGuide} <strong>{copy.confirmationValue}</strong>{" "}
            {copy.fieldGuideSuffix}
          </p>

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
