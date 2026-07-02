import { useEffect, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";
import { isSupportedLocale } from "../../../shared/locales";
import { useAuth } from "../auth/AuthContext";
import { NotFoundPage } from "../pages/NotFoundPage";

export function LocaleLayout() {
  const { locale } = useParams();
  const { state } = useAuth();
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState("");
  const isSuperAdmin =
    state.status === "authenticated" &&
    state.user.role === "SUPER_ADMIN" &&
    state.user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com";

  useEffect(() => {
    const main = document.querySelector("main");

    if (!main) {
      setPageTitle("");
      return;
    }

    const updatePageTitle = () => {
      const title =
        main
          .querySelector("h1")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      setPageTitle(title);
    };

    setPageTitle("");
    updatePageTitle();

    const observer = new MutationObserver(updatePageTitle);
    observer.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [location.pathname]);

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
          {pageTitle ? (
            <span className="header-page-title" title={pageTitle}>
              {pageTitle}
            </span>
          ) : (
            <span className="header-page-title" aria-hidden="true" />
          )}
          <nav className="header-nav" aria-label="주요 메뉴">
            {state.status === "authenticated" ? (
              <>
                <Link to={`/${locale}/sites`}>대시보드</Link>
                {isSuperAdmin ? (
                  <Link to={`/${locale}/admin`}>관리자</Link>
                ) : null}
                <Link to={`/${locale}/settings`}>설정</Link>
              </>
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
