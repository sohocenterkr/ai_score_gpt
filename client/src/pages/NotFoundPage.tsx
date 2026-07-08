import { Link, useLocation } from "react-router-dom";
import { defaultLocale } from "../../../shared/locales";

const notFoundCopy = {
  ko: {
    title: "페이지를 찾을 수 없습니다.",
    body: "지원하지 않는 언어 경로이거나 주소가 변경되었을 수 있습니다.",
    action: "기본 언어 홈으로 이동",
  },
  en: {
    title: "Page not found.",
    body: "The language path may not be supported, or the address may have changed.",
    action: "Go to home",
  },
} as const;

export function NotFoundPage() {
  const location = useLocation();
  const locale = location.pathname.startsWith("/en") ? "en" : defaultLocale;
  const copy = locale === "en" ? notFoundCopy.en : notFoundCopy.ko;

  return (
    <main className="not-found-page">
      <div>
        <p className="eyebrow">404</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <Link className="primary-link" to={`/${locale}`}>
          {copy.action}
        </Link>
      </div>
    </main>
  );
}
