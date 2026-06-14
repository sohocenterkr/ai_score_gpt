import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const { locale = "ko" } = useParams();
  const location = useLocation();

  if (state.status === "loading") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          로그인 상태를 확인하고 있습니다.
        </div>
      </section>
    );
  }

  if (state.status === "anonymous") {
    return (
      <Navigate
        to={`/${locale}/login`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
