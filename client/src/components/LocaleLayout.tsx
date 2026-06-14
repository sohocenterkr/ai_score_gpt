import { Link, Outlet, useParams } from "react-router-dom";
import { isSupportedLocale } from "../../../shared/locales";
import { useAuth } from "../auth/AuthContext";
import { NotFoundPage } from "../pages/NotFoundPage";

export function LocaleLayout() {
  const { locale } = useParams();
  const { state } = useAuth();

  if (!isSupportedLocale(locale)) {
    return <NotFoundPage />;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to={`/${locale}`} aria-label="Site AI Score 홈">
            <span className="brand-mark" aria-hidden="true">AI</span>
            <span>Site AI Score</span>
          </Link>
          <nav className="header-nav" aria-label="주요 메뉴">
            <Link to={`/${locale}/system`}>시스템 확인</Link>
            {state.status === "authenticated" ? (
              <Link to={`/${locale}/dashboard`}>대시보드</Link>
            ) : (
              <Link to={`/${locale}/login`}>로그인</Link>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet context={{ locale }} />
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <strong>Site AI Score</strong>
          <span>AI 친화도 진단·작업지시·독립 검수 플랫폼</span>
        </div>
      </footer>
    </div>
  );
}
