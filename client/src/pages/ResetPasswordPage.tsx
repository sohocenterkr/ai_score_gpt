import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AuthApiError,
  resetPasswordRequest,
  validateResetTokenRequest,
} from "../auth/auth-api";
import "../password.css";

type TokenState = "checking" | "valid" | "invalid" | "error";

export function ResetPasswordPage() {
  const { locale = "ko" } = useParams();
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
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await resetPasswordRequest({ token, newPassword });
      navigate(`/${locale}/login`, {
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
        error instanceof AuthApiError
          ? error.message
          : "비밀번호 재설정 중 오류가 발생했습니다.",
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
            <p className="eyebrow">NEW PASSWORD</p>
            <h1>재설정 링크 확인</h1>
          </div>
          <div className="auth-form surface" role="status">
            재설정 링크가 유효한지 확인하고 있습니다.
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
            <p className="eyebrow">RESET LINK</p>
            <h1>사용할 수 없는 링크입니다</h1>
          </div>
          <div className="auth-form surface">
            <p className="auth-message auth-error" role="alert">
              재설정 링크가 올바르지 않거나 만료되었습니다.
            </p>
            <Link className="auth-submit" to={`/${locale}/forgot-password`}>
              재설정 링크 다시 요청
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
            <p className="eyebrow">RESET LINK</p>
            <h1>링크를 확인하지 못했습니다</h1>
          </div>
          <div className="auth-form surface">
            <p className="auth-message auth-error" role="alert">
              네트워크 상태를 확인한 뒤 페이지를 새로고침해 주세요.
            </p>
            <Link className="auth-submit" to={`/${locale}/forgot-password`}>
              재설정 링크 다시 요청
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
          <p className="eyebrow">NEW PASSWORD</p>
          <h1>새 비밀번호 설정</h1>
          <p>영문자와 숫자를 포함하여 10자 이상 입력해 주세요.</p>
        </div>

        <form className="auth-form surface" onSubmit={handleSubmit} noValidate>
          <label htmlFor="reset-password">새 비밀번호</label>
          <input
            id="reset-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="reset-password-confirm">새 비밀번호 확인</label>
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
            {submitting ? "변경 중..." : "비밀번호 재설정"}
          </button>

          <p className="auth-switch">
            <Link to={`/${locale}/forgot-password`}>재설정 링크 다시 요청</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
