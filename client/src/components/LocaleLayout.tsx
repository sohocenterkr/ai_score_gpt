import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { isSupportedLocale } from "../../../shared/locales";
import { useAuth } from "../auth/AuthContext";
import { NoticePopup } from "./NoticePopup";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RouteMeta } from "./RouteMeta";

const layoutCopy = {
  ko: {
    homeAria: "Site AI Score 홈",
    navAria: "주요 메뉴",
    dashboard: "대시보드",
    admin: "관리자",
    settings: "설정",
    login: "로그인",
    footerTagline: "AI 친화도 진단·작업지시·독립 검수 플랫폼",
    company: "소호센터 | 대표 : 김은식 | 개인정보보호 책임자 : 김천식",
    address: "주소 : 서울시 강동구 양재대로 1522-10, 202호(길동)",
    registration: "사업자등록번호 : 232-02-03802 | 전화번호 : 070-4513-4093",
    kakao: "문의연락: 카카오톡 오픈채팅",
    emailContact: "이메일 문의: sohocenter.kr@gmail.com",
    footerAria: "푸터 메뉴",
    terms: "이용약관",
    privacy: "개인정보처리방침",
    guide: "이용가이드",
    faq: "FAQ",
    checkout: "요금/결제 안내",
  },
  en: {
    homeAria: "Site AI Score home",
    navAria: "Main menu",
    dashboard: "Dashboard",
    admin: "Admin",
    settings: "Settings",
    login: "Log in",
    footerTagline:
      "AI readiness diagnostics, work orders, and independent review",
    company:
      "SOHO Center | Representative: Eunsik Kim | Privacy Officer: Cheonsik Kim",
    address: "Address: 202, 1522-10 Yangjae-daero, Gangdong-gu, Seoul, Korea",
    registration: "Business Registration No. 232-02-03802 | Tel. 070-4513-4093",
    kakao: "Contact: KakaoTalk open chat",
    emailContact: "Email: sohocenter.kr@gmail.com",
    footerAria: "Footer menu",
    terms: "Terms",
    privacy: "Privacy Policy",
    guide: "Guide",
    faq: "FAQ",
    checkout: "Pricing / Payment",
  },
};

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
        main.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ??
        "";
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

  const copy = locale === "en" ? layoutCopy.en : layoutCopy.ko;

  return (
    <div className="app-shell">
      <RouteMeta />
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to={`/${locale}`} aria-label={copy.homeAria}>
            <span className="brand-mark" aria-hidden="true">
              AI
            </span>
            <span>Site AI Score</span>
          </Link>
          {pageTitle ? (
            <span className="header-page-title" title={pageTitle}>
              {pageTitle}
            </span>
          ) : (
            <span className="header-page-title" aria-hidden="true" />
          )}
          <nav className="header-nav" aria-label={copy.navAria}>
            {state.status === "authenticated" ? (
              <>
                <Link to={`/${locale}/sites`}>{copy.dashboard}</Link>
                {isSuperAdmin ? (
                  <Link to={`/${locale}/admin`}>{copy.admin}</Link>
                ) : null}
                <Link to={`/${locale}/settings`}>{copy.settings}</Link>
              </>
            ) : (
              <Link to={`/${locale}/login`}>{copy.login}</Link>
            )}
          </nav>
        </div>
      </header>
      <NoticePopup />
      <main>
        <Outlet context={{ locale }} />
      </main>
      <footer className="site-footer">
        <div className="footer-inner footer-rich">
          <div className="footer-brand-block">
            <strong>Site AI Score</strong>
            <span>{copy.footerTagline}</span>
            <span>{copy.company}</span>
            <span>{copy.address}</span>
            <span>{copy.registration}</span>
            <a
              href="https://open.kakao.com/me/sohocenter"
              target="_blank"
              rel="noreferrer"
            >
              {copy.kakao}
            </a>
            <a href="mailto:sohocenter.kr@gmail.com">{copy.emailContact}</a>
          </div>
          <nav className="footer-links" aria-label={copy.footerAria}>
            <Link to={`/${locale}/terms`}>{copy.terms}</Link>
            <Link to={`/${locale}/privacy`}>{copy.privacy}</Link>
            <Link to={`/${locale}/guide`}>{copy.guide}</Link>
            <Link to={`/${locale}/faq`}>{copy.faq}</Link>
            <Link to={`/${locale}/checkout`}>{copy.checkout}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
