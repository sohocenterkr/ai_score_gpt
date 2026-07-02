import { Link, useParams } from "react-router-dom";

export function CheckoutPage() {
  const { locale = "ko" } = useParams();

  return (
    <section className="full-bleed-section legal-section">
      <div className="content-container legal-content">
        <header className="legal-card surface checkout-hero">
          <p className="eyebrow">PAYMENT GUIDE</p>
          <h1>요금/결제 안내</h1>
          <p>
            Site AI Score의 간편진단 결과 화면은 핵심 점수와 주요 문제 예시를
            제공합니다. 상세 진단 PDF 보고서와 수정 작업지시서는 유료 산출물로
            제공됩니다.
          </p>
        </header>

        <section className="legal-card surface checkout-pricing-card">
          <div>
            <p className="eyebrow">기본 상품</p>
            <h2>상세 진단 보고서 + 수정 작업지시서</h2>
            <p>
              현재 사이트 상태를 상세하게 진단하고, 실제 수정에 활용할 수 있는
              작업지시서를 함께 제공합니다.
            </p>
          </div>

          <div className="checkout-price-grid">
            <article>
              <span>기본 가격</span>
              <strong>USD 100</strong>
              <p>상세 진단 PDF 보고서와 수정 작업지시서 제공</p>
            </article>
            <article>
              <span>개선 사례 활용 동의 시</span>
              <strong>USD 70</strong>
              <p>진단 전후 개선 사례 활용에 동의하는 경우 적용 검토</p>
            </article>
          </div>
        </section>

        <section className="legal-card surface">
          <h2>제공 항목</h2>
          <div className="checkout-deliverable-grid">
            <article>
              <h3>상세 진단 PDF 보고서</h3>
              <ul>
                <li>전체 진단 항목</li>
                <li>수집 페이지의 측정 증거</li>
                <li>초기 HTML과 JavaScript 렌더링 비교</li>
                <li>주요 문제와 개선 방향</li>
              </ul>
            </article>

            <article>
              <h3>수정 작업지시서</h3>
              <ul>
                <li>작업 우선순위</li>
                <li>개발자 전달 문구</li>
                <li>완료 판정 기준</li>
                <li>회귀 방지 기준과 자동검수 기준</li>
              </ul>
            </article>

            <article>
              <h3>개선 후 추가 제공</h3>
              <ul>
                <li>AI 답변을 위한 추가 콘텐츠 제안</li>
                <li>운영자가 선택적으로 보완할 콘텐츠 제안</li>
                <li>개선 전후 비교를 위한 재진단 기준 안내</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="legal-card surface checkout-notice-card">
          <h2>결제 기능 준비 중</h2>
          <p>
            온라인 결제 기능은 준비 중입니다. 결제 기능 도입 전에는 카카오톡
            오픈채팅 또는 이메일로 문의해 주세요.
          </p>
          <div className="checkout-contact-actions">
            <a
              className="primary"
              href="https://open.kakao.com/me/sohocenter"
              target="_blank"
              rel="noreferrer"
            >
              카카오톡 문의
            </a>
            <a className="secondary" href="mailto:sohocenter.kr@gmail.com">
              이메일 문의
            </a>
            <Link className="secondary" to={`/${locale}/faq`}>
              FAQ 보기
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
