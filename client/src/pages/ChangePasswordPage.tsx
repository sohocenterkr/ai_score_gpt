import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AuthApiError,
  changePasswordRequest,
} from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";
import "../password.css";

export function ChangePasswordPage() {
  const { locale = "ko" } = useParams();
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
      setMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);

    try {
      await changePasswordRequest({ currentPassword, newPassword });
      await refresh();
      navigate(`/${locale}/login`, {
        replace: true,
        state: {
          notice: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.",
        },
      });
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "비밀번호 변경 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">SECURITY</p>
          <h1>비밀번호 변경</h1>
          <p>변경 후에는 모든 기기에서 다시 로그인해야 합니다.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="current-password">현재 비밀번호</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />

          <label htmlFor="change-password">새 비밀번호</label>
          <input
            id="change-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="change-password-confirm">새 비밀번호 확인</label>
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
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </button>

          <p className="auth-switch">
            <Link to={`/${locale}/dashboard`}>대시보드로 돌아가기</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
