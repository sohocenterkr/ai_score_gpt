import { Link, useParams } from "react-router-dom";

const CONTACT_EMAIL = "sohocenter.kr@gmail.com";

function checkoutMailto(plan: "basic" | "discount") {
  const isDiscount = plan === "discount";
  const subject = isDiscount
    ? "[Site AI Score] 할인 가격 USD 70 구매 신청"
    : "[Site AI Score] 기본 가격 USD 100 구매 신청";

  const body = [
    "Site AI Score 유료 산출물 구매를 신청합니다.",
    "",
    `신청 상품: ${isDiscount ? "할인 가격 USD 70" : "기본 가격 USD 100"}`,
    "제공 항목: 상세 진단 PDF 보고서 + 수정 작업지시서",
    "",
    "신청자명:",
    "가입 이메일:",
    "진단한 사이트명:",
    "진단한 사이트 URL:",
    "사업자/세금계산서 필요 여부:",
    "",
    isDiscount
      ? "개선 사례 활용 동의: 진단 전후 개선 사례를 Site AI Score의 서비스 소개와 개선 사례 자료로 활용하는 것에 동의합니다."
      : "개선 사례 활용 동의: 동의하지 않습니다.",
    "",
    "추가 요청사항:",
  ].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

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
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>개선 사례 활용 동의 없이 이용하는 기본 가격</li>
              </ul>
              <a className="primary checkout-price-action" href={checkoutMailto("basic")}>
                기본 가격 신청
              </a>
            </article>
            <article>
              <span>개선 사례 활용 동의 시</span>
              <strong>USD 70</strong>
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>진단 전후 개선 사례 활용에 동의하는 경우 적용 검토</li>
              </ul>
              <a
                className="primary checkout-price-action"
                href={checkoutMailto("discount")}
              >
                할인 가격 신청
              </a>
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
            온라인 결제 기능은 준비 중입니다. 현재는 아래 신청 버튼 또는
            카카오톡 오픈채팅으로 접수해 주세요. 신청 내용을 확인한 뒤 결제와
            산출물 제공 절차를 안내드립니다.
          </p>
          <div className="checkout-contact-actions">
            <a className="primary" href={checkoutMailto("basic")}>
              기본 가격 신청
            </a>
            <a className="primary" href={checkoutMailto("discount")}>
              할인 가격 신청
            </a>
            <a
              className="secondary"
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
