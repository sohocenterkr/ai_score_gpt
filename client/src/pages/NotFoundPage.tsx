import { Link } from "react-router-dom";
import { defaultLocale } from "../../../shared/locales";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div>
        <p className="eyebrow">404</p>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p>지원하지 않는 언어 경로이거나 주소가 변경되었을 수 있습니다.</p>
        <Link className="primary-link" to={`/${defaultLocale}`}>기본 언어 홈으로 이동</Link>
      </div>
    </main>
  );
}
