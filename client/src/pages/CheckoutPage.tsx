import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as PortOne from "@portone/browser-sdk/v2";
import {
  completePaymentOrderRequest,
  createPaymentOrderRequest,
  type PaymentPlan,
} from "../billing/payment-api";

type PortOnePaymentFailure = {
  code?: string;
  message?: string;
};

function isPortOnePaymentFailure(
  response: unknown,
): response is PortOnePaymentFailure {
  return (
    typeof response === "object" &&
    response !== null &&
    "code" in response
  );
}

function checkoutRedirectUrl(
  locale: string,
  scanId: string,
  orderId: string,
): string {
  const url = new URL(window.location.href);
  url.pathname = `/${locale}/checkout`;
  url.search = "";
  url.searchParams.set("scanId", scanId);
  url.searchParams.set("paymentOrderId", orderId);
  return url.toString();
}

type CheckoutMessage = {
  tone: "info" | "success" | "error";
  text: string;
};

const domesticPrices: Record<PaymentPlan, string> = {
  BASIC: "165,000원 (VAT 포함)",
  CASE_STUDY_DISCOUNT: "110,000원 (VAT 포함)",
};

function planLabel(plan: PaymentPlan): string {
  return plan === "CASE_STUDY_DISCOUNT"
    ? "개선 사례 활용 동의 할인"
    : "기본 가격";
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function CheckoutPage() {
  const { locale = "ko" } = useParams();
  const [searchParams] = useSearchParams();
  const scanId = searchParams.get("scanId")?.trim() ?? "";
  const redirectedPaymentOrderId =
    searchParams.get("paymentOrderId")?.trim() ?? "";
  const redirectedPaymentId =
    searchParams.get("paymentId")?.trim() ?? "";
  const redirectedErrorMessage =
    searchParams.get("message")?.trim() ?? "";
  const [submittingPlan, setSubmittingPlan] =
    useState<PaymentPlan | null>(null);
  const [message, setMessage] = useState<CheckoutMessage | null>(null);
  const [payerName, setPayerName] = useState("Site AI Score 고객");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhoneNumber, setPayerPhoneNumber] = useState("");
  const redirectHandledRef = useRef(false);

  const hasScanId = useMemo(() => scanId.length > 0, [scanId]);

  useEffect(() => {
    if (redirectHandledRef.current) {
      return;
    }

    if (redirectedErrorMessage) {
      redirectHandledRef.current = true;
      setMessage({
        tone: "error",
        text: redirectedErrorMessage,
      });
      return;
    }

    if (!redirectedPaymentOrderId || !redirectedPaymentId) {
      return;
    }

    redirectHandledRef.current = true;
    setSubmittingPlan("BASIC");
    completePaymentOrderRequest({
      paymentOrderId: redirectedPaymentOrderId,
      providerPaymentId: redirectedPaymentId,
    })
      .then(() => {
        setMessage({
          tone: "success",
          text: "결제가 확인되어 상세 진단 보고서와 수정 작업지시서 접근 권한이 열렸습니다. 진단 결과 화면으로 돌아가 산출물을 이용해 주세요.",
        });
      })
      .catch((error: unknown) => {
        setMessage({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "결제 완료 검증을 처리하지 못했습니다.",
        });
      })
      .finally(() => {
        setSubmittingPlan(null);
      });
  }, [
    redirectedErrorMessage,
    redirectedPaymentId,
    redirectedPaymentOrderId,
  ]);

  async function handleCreateDomesticOrder(plan: PaymentPlan) {
    if (!hasScanId) {
      setMessage({
        tone: "error",
        text: "결제할 진단 결과가 연결되지 않았습니다. 진단 결과 화면의 결제하기 버튼으로 다시 이동해 주세요.",
      });
      return;
    }

    const normalizedPayerName = payerName.trim();
    const normalizedPayerEmail = payerEmail.trim();
    const normalizedPayerPhoneNumber = normalizePhoneNumber(payerPhoneNumber);

    if (!normalizedPayerName) {
      setMessage({ tone: "error", text: "결제자 이름을 입력해 주세요." });
      return;
    }

    if (!isValidEmail(normalizedPayerEmail)) {
      setMessage({ tone: "error", text: "결제자 이메일을 정확히 입력해 주세요." });
      return;
    }

    if (normalizedPayerPhoneNumber.length < 10) {
      setMessage({ tone: "error", text: "결제자 휴대폰번호를 정확히 입력해 주세요." });
      return;
    }

    setSubmittingPlan(plan);
    setMessage(null);

    try {
      const result = await createPaymentOrderRequest({
        scanId,
        plan,
      });

      const portone = result.portone;

      if (!portone) {
        throw new Error("국내 결제 정보를 불러오지 못했습니다.");
      }

      if (!portone.configured) {
        setMessage({
          tone: "info",
          text: `${planLabel(plan)} ${domesticPrices[plan]} 결제 주문이 생성되었습니다. Vercel/Replit 환경변수에 PORTONE_STORE_ID와 PORTONE_CHANNEL_KEY를 넣으면 결제창이 열립니다.`,
        });
        return;
      }

      if (!portone.storeId || !portone.channelKey) {
        setMessage({
          tone: "error",
          text: "PortOne 결제 설정을 확인하지 못했습니다.",
        });
        return;
      }

      const paymentResponse = await PortOne.requestPayment({
        storeId: portone.storeId,
        channelKey: portone.channelKey,
        paymentId: portone.paymentId,
        orderName: "Site AI Score 진단 보고서",
        totalAmount: portone.totalAmount,
        currency: "CURRENCY_KRW",
        payMethod: portone.payMethod,
        customer: {
          fullName: normalizedPayerName,
          email: normalizedPayerEmail,
          phoneNumber: normalizedPayerPhoneNumber,
        },
        redirectUrl: checkoutRedirectUrl(
          locale,
          scanId,
          result.paymentOrder.id,
        ),
      });

      if (isPortOnePaymentFailure(paymentResponse)) {
        setMessage({
          tone: "error",
          text:
            paymentResponse.message ??
            "결제가 완료되지 않았습니다.",
        });
        return;
      }

      await completePaymentOrderRequest({
        paymentOrderId: result.paymentOrder.id,
        providerPaymentId: portone.paymentId,
      });

      setMessage({
        tone: "success",
        text: "결제가 확인되어 상세 진단 보고서와 수정 작업지시서 접근 권한이 열렸습니다. 진단 결과 화면으로 돌아가 산출물을 이용해 주세요.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "결제 주문을 생성하지 못했습니다.",
      });
    } finally {
      setSubmittingPlan(null);
    }
  }
  async function handleCreatePolarOrder(plan: PaymentPlan) {
    if (!hasScanId) {
      setMessage({ tone: "error", text: "결제할 진단 결과가 연결되지 않았습니다." });
      return;
    }

    setSubmittingPlan(plan);
    setMessage(null);

    try {
      const result = await createPaymentOrderRequest({ scanId, plan, provider: "POLAR" });
      const polar = result.polar;

      if (!polar) throw new Error("해외 결제 정보를 불러오지 못했습니다.");

      if (!polar.configured) {
        setMessage({ tone: "info", text: "Polar 결제 설정을 확인해 주세요." });
        return;
      }

      if (!polar.checkoutUrl) {
        throw new Error("Polar 결제창 URL을 생성하지 못했습니다.");
      }

      window.location.assign(polar.checkoutUrl);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "해외 결제 주문을 생성하지 못했습니다.",
      });
    } finally {
      setSubmittingPlan(null);
    }
  }


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
            <p className="eyebrow">국내 결제</p>
            <h2>PortOne + KG이니시스 결제</h2>
            <p>
              국내 고객은 원화 결제, 국내 카드전표, 세금계산서 대응을 기준으로
              PortOne 결제 흐름을 준비합니다. 결제 성공 후에는 상세 PDF 보고서와
              수정 작업지시서 접근 권한이 자동으로 열리도록 연결합니다.
            </p>
          </div>

          {!hasScanId ? (
            <p className="checkout-payment-note" role="alert">
              결제할 진단 결과가 연결되지 않았습니다. 진단 결과 화면에서
              결제하기 버튼을 눌러 주세요.
            </p>
          ) : null}

          {message ? (
            <p
              className="checkout-payment-note"
              role={message.tone === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}

          <div
            className="checkout-payment-note"
            style={{ display: "grid", gap: "0.75rem" }}
          >
            <strong>결제자 정보</strong>
            <span>
              KG이니시스 결제창 호출을 위해 이름, 이메일, 휴대폰번호가 필요합니다.
            </span>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              결제자 이름
              <input
                type="text"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                placeholder="홍길동"
                autoComplete="name"
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              결제자 이메일
              <input
                type="email"
                value={payerEmail}
                onChange={(event) => setPayerEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              휴대폰번호
              <input
                type="tel"
                value={payerPhoneNumber}
                onChange={(event) => setPayerPhoneNumber(event.target.value)}
                placeholder="01012345678"
                autoComplete="tel"
              />
            </label>
          </div>
          
          <div className="checkout-price-grid">
            <article>
              <span>기본 가격</span>
              <strong>165,000원 (VAT 포함)</strong>
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>
                  진단 결과와 리포트는 서비스 개선과 품질 향상을 위해
                  내부적으로 활용될 수 있습니다.
                </li>
                <li>
                  회사명·사이트명과 점수 향상 사례를 공개 마케팅 사례로
                  활용하는 동의는 포함하지 않는 기본 가격입니다.
                </li>
              </ul>
              <button
                className="primary checkout-price-action"
                type="button"
                disabled={!hasScanId || submittingPlan !== null}
                onClick={() => void handleCreateDomesticOrder("BASIC")}
              >
                {submittingPlan === "BASIC"
                  ? "결제창을 여는 중입니다... 잠시만 기다려 주세요.."
                  : "국내 결제 준비"}
              </button>
            </article>
            <article>
              <span>개선 사례 활용 동의 시</span>
              <strong>110,000원 (VAT 포함)</strong>
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>
                  진단 결과와 리포트는 서비스 개선과 품질 향상을 위해
                  내부적으로 활용될 수 있습니다.
                </li>
                <li>
                  진단 전후 점수가 향상된 사실을 회사명·사이트명과 함께
                  공개하는 데 동의하는 경우 적용됩니다.
                </li>
                <li>
                  리포트 전체, 상세 문제 목록, 원문 증거는 별도 동의 없이
                  공개하지 않습니다.
                </li>
              </ul>
              <button
                className="primary checkout-price-action"
                type="button"
                disabled={!hasScanId || submittingPlan !== null}
                onClick={() =>
                  void handleCreateDomesticOrder(
                    "CASE_STUDY_DISCOUNT",
                  )
                }
              >
                {submittingPlan === "CASE_STUDY_DISCOUNT"
                  ? "결제창을 여는 중입니다... 잠시만 기다려 주세요.."
                  : "국내 결제 준비"}
              </button>
            </article>
          </div>
        </section>

        <section className="legal-card surface checkout-pricing-card">
          <div>
            <p className="eyebrow">해외 결제</p>
            <h2>Polar 해외 결제</h2>
            <p>
              해외 고객은 Polar를 통해 USD 결제를 진행할 수 있습니다. 단,
              결제 성공 후 유료 권한을 여는 로직은 국내 결제와 동일한
              paid_entitlements 구조를 사용합니다.
            </p>
          </div>

          <div className="checkout-price-grid">
            <article>
              <span>기본 가격</span>
              <strong>USD 100</strong>
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>
                  진단 결과와 리포트는 서비스 개선과 품질 향상을 위해
                  내부적으로 활용될 수 있습니다.
                </li>
                <li>해외 카드와 글로벌 SaaS 결제 방식 지원</li>
                <li>
                  회사명·사이트명과 점수 향상 사례를 공개 마케팅 사례로
                  활용하는 동의는 포함하지 않는 기본 가격입니다.
                </li>
              </ul>
                <button
                  className="primary checkout-price-action"
                  type="button"
                  disabled={!hasScanId || submittingPlan !== null}
                  onClick={() => void handleCreatePolarOrder("BASIC")}
                >
                  {submittingPlan === "BASIC"
                    ? "결제창을 여는 중입니다... 잠시만 기다려 주세요.."
                    : "Polar 결제"}
                </button>
            </article>
            <article>
              <span>개선 사례 활용 동의 시</span>
              <strong>USD 70</strong>
              <ul className="checkout-price-list">
                <li>상세 진단 PDF 보고서와 수정 작업지시서 제공</li>
                <li>
                  진단 결과와 리포트는 서비스 개선과 품질 향상을 위해
                  내부적으로 활용될 수 있습니다.
                </li>
                <li>
                  진단 전후 점수가 향상된 사실을 회사명·사이트명과 함께
                  공개하는 데 동의하는 경우 적용됩니다.
                </li>
                <li>
                  리포트 전체, 상세 문제 목록, 원문 증거는 별도 동의 없이
                  공개하지 않습니다.
                </li>
              </ul>
                <button
                  className="primary checkout-price-action"
                  type="button"
                  disabled={!hasScanId || submittingPlan !== null}
                  onClick={() =>
                    void handleCreatePolarOrder("CASE_STUDY_DISCOUNT")
                  }
                >
                  {submittingPlan === "CASE_STUDY_DISCOUNT"
                    ? "결제창을 여는 중입니다... 잠시만 기다려 주세요.."
                    : "Polar 결제"}
                </button>
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
          <h2>결제 연동 진행 상태</h2>
          <p>
            현재 단계에서는 국내 결제 주문 생성 API와 checkout 화면 연결을 먼저
            적용합니다. 다음 단계에서 PortOne 브라우저 결제창 호출, 결제 검증,
            웹훅 처리, paid_entitlements 자동 생성까지 연결합니다.
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
