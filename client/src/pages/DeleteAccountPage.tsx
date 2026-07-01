import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthApiError } from "../auth/auth-api";
import { useAuth } from "../auth/AuthContext";

export function DeleteAccountPage() {
  const { locale = "ko" } = useParams();
  const navigate = useNavigate();
  const { deleteAccount } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (confirmation.trim() !== "회원탈퇴") {
      setMessage("확인 문구에 회원탈퇴를 정확히 입력해 주세요.");
      return;
    }

    setSubmitting(true);

    try {
      await deleteAccount({ currentPassword, confirmation });
      navigate(`/${locale}`, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof AuthApiError
          ? error.message
          : "회원탈퇴 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">ACCOUNT</p>
          <h1>회원탈퇴</h1>
          <p>계정과 관련 데이터가 삭제되는 작업입니다.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <div className="auth-message auth-error" role="note">
            <strong>탈퇴 전 반드시 확인해 주세요.</strong>
            <br />
            탈퇴 전에 필요한 모든 자료를 먼저 다운로드해 주세요.
            <br />
            탈퇴 후에는 같은 이메일 아이디로 다시 가입할 수 없습니다.
            <br />
            탈퇴하면 등록한 사이트, 진단 결과, 작업지시서 등 계정 관련 데이터가 삭제됩니다.
          </div>

          <label htmlFor="delete-current-password">현재 비밀번호</label>
          <input
            id="delete-current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />

          <label htmlFor="delete-confirmation">확인 문구</label>
          <input
            id="delete-confirmation"
            name="confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="회원탈퇴"
            required
          />
          <p className="field-guide">
            계속하려면 확인 문구에 <strong>회원탈퇴</strong>를 입력해 주세요.
          </p>

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "탈퇴 처리 중..." : "회원탈퇴"}
          </button>

          <p className="auth-switch">
            <Link to={`/${locale}/settings`}>설정으로 돌아가기</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
