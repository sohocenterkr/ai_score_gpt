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
    typeof response === "object" && response !== null && "code" in response
  );
}

function checkoutRedirectUrl(input: {
  locale: string;
  scanId?: string;
  workOrderId?: string;
  orderId: string;
  plan: PaymentPlan;
  returnTo?: string;
}): string {
  const url = new URL(window.location.href);
  url.pathname = `/${input.locale}/checkout`;
  url.search = "";

  if (input.scanId) {
    url.searchParams.set("scanId", input.scanId);
  }

  if (input.workOrderId) {
    url.searchParams.set("workOrderId", input.workOrderId);
  }

  url.searchParams.set("plan", input.plan);
  url.searchParams.set("paymentOrderId", input.orderId);

  if (input.returnTo) {
    url.searchParams.set("returnTo", input.returnTo);
  }

  return url.toString();
}

function paymentPlanFromQuery(value: string | null): PaymentPlan {
  if (value === "CASE_STUDY_DISCOUNT" || value === "EXTRA_VERIFICATION") {
    return value;
  }

  return "BASIC";
}

function safeCheckoutReturnPath(value: string, locale: string): string | null {
  const trimmed = value.trim();

  if (!trimmed.startsWith(`/${locale}/`)) {
    return null;
  }

  return trimmed;
}

type CheckoutMessage = {
  tone: "info" | "success" | "error";
  text: string;
};

const checkoutCopy = {
  ko: {
    eyebrow: "PAYMENT GUIDE",
    title: "요금/결제 안내",
    hero: "Site AI Score의 간편진단 결과 화면은 핵심 점수와 주요 문제 예시를 제공합니다. 무료 간편진단은 계정당 최대 10개 사이트까지 제공되며, 10개를 초과하는 사이트 진단이 필요한 경우 별도 문의 바랍니다. 상세 진단 PDF 보고서와 수정 작업지시서는 유료 산출물로 제공됩니다.",
    noScanTitle: "아직 결제할 진단 결과가 연결되지 않았습니다.",
    noScanBody:
      "아직 간편진단을 하지 않은 경우 결제가 진행되지 않습니다. 먼저 본인 사이트에 대한 무료 간편진단을 실행하고 점수와 주요 문제를 확인한 뒤, 상세 진단 PDF 보고서와 수정 작업지시서 구매 여부를 판단해 주세요.",
    noScanAction: "간편진단 시작하기",
    domesticEyebrow: "국내 결제",
    domesticTitle: "PortOne + KG이니시스 결제",
    domesticBody:
      "국내 고객은 원화 결제, 국내 카드전표, 세금계산서 대응을 기준으로 PortOne 결제 흐름을 준비합니다. 결제 성공 후에는 상세 PDF 보고서와 수정 작업지시서 접근 권한이 자동으로 열리도록 연결합니다.",
    missingScan:
      "결제할 진단 결과가 연결되지 않았습니다. 진단 결과 화면에서 결제하기 버튼을 눌러 주세요.",
    payerInfoTitle: "결제자 정보",
    payerInfoBody:
      "KG이니시스 결제창 호출을 위해 이름, 이메일, 휴대폰번호가 필요합니다.",
    payerName: "결제자 이름",
    payerNamePlaceholder: "홍길동",
    payerEmail: "결제자 이메일",
    payerEmailPlaceholder: "name@example.com",
    payerPhone: "휴대폰번호",
    payerPhonePlaceholder: "01012345678",
    basicPriceLabel: "기본 가격",
    domesticBasicPrice: "165,000원 (VAT 포함)",
    caseStudyLabel: "개선 사례 활용 동의 시",
    domesticCasePrice: "110,000원 (VAT 포함)",
    deliverableShort: "상세 진단 PDF 보고서와 수정 작업지시서 제공",
    internalUse:
      "진단 결과, 리포트, 작업지시서와 스캔 데이터는 서비스 개선과 품질 향상을 위해 내부적으로 활용될 수 있습니다.",
    basicNoCase:
      "적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과를 공개하는 동의는 포함하지 않는 기본 가격입니다.",
    caseScope:
      "공개 범위는 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과로 한정됩니다.",
    nonDisclosure:
      "상세 보고서 전체, 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터와 내부 분석 자료는 공개하지 않습니다.",
    domesticButton: "국내 결제 준비",
    extraVerificationTitle: "추가 검수권 1회 결제",
    extraVerificationBody:
      "3차 이상 작업지시서 검수는 추가 검수권 결제 후 진행할 수 있습니다. 결제 1건은 해당 작업지시서의 검수 1회에 사용됩니다.",
    extraVerificationLabel: "추가 검수권 1회",
    domesticExtraVerificationPrice: "33,000원 (VAT 포함)",
    extraVerificationItem: "해당 작업지시서 자동검수 1회",
    extraVerificationButton: "결제 후 검수 진행",
    loading: "결제창을 여는 중입니다... 잠시만 기다려 주세요..",
    globalPayment: "해외 카드와 글로벌 SaaS 결제 방식 지원",
    polarEyebrow: "해외 결제",
    polarTitle: "Polar 해외 결제",
    polarBody:
      "해외 고객은 Polar를 통해 USD 결제를 진행할 수 있습니다. 결제 성공 후 유료 권한을 여는 로직은 국내 결제와 동일한 paid_entitlements 구조를 사용합니다.",
    polarButton: "Polar 결제",
    deliverablesTitle: "제공 항목",
    reportTitle: "상세 진단 PDF 보고서",
    reportItems: [
      "전체 진단 항목",
      "수집 페이지의 측정 증거",
      "초기 HTML과 JavaScript 렌더링 비교",
      "주요 문제와 개선 방향",
    ],
    workOrderTitle: "수정 작업지시서",
    workOrderItems: [
      "작업 우선순위",
      "개발자 전달 문구",
      "완료 판정 기준",
      "회귀 방지 기준과 자동검수 기준",
    ],
    improvementTitle: "개선 후 추가 제공",
    improvementItems: [
      "AI 답변을 위한 추가 콘텐츠 제안",
      "운영자가 선택적으로 보완할 콘텐츠 제안",
      "개선 전후 비교를 위한 재진단 기준 안내",
    ],
    noticeTitle: "결제 전 확인 사항",
    noticeBody:
      "상세 진단 PDF 보고서와 수정 작업지시서는 결제 완료 후 해당 진단 결과에 대한 접근 권한이 열립니다. 사례 할인 상품은 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과 공개에 동의하는 경우 선택할 수 있습니다. 상세 보고서 전체, 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터와 내부 분석 자료는 공개하지 않습니다.",
    kakao: "카카오톡 문의",
    email: "이메일 문의",
    faq: "FAQ 보기",
  },
  en: {
    eyebrow: "PAYMENT GUIDE",
    title: "Pricing and Payment",
    hero: "The simple diagnostic result page provides the core score and examples of key issues. Free simple diagnostics are available for up to 10 websites per account. If you need to diagnose more than 10 websites, please contact us separately. Detailed diagnostic PDF reports and improvement work orders are paid digital deliverables.",
    noScanTitle: "No diagnostic result is connected for payment yet.",
    noScanBody:
      "Payment cannot proceed if you have not run a simple diagnostic yet. Please run a free diagnostic for your own website first, review the score and key issues, and then decide whether to purchase the detailed diagnostic PDF report and improvement work order.",
    noScanAction: "Start free diagnostic",
    domesticEyebrow: "Domestic Payment",
    domesticTitle: "PortOne + KG Inicis Payment",
    domesticBody:
      "Domestic Korean payments are prepared for KRW payment, domestic card receipts, and tax invoice support through PortOne. After successful payment, access to the detailed PDF report and improvement work order is granted automatically.",
    missingScan:
      "No diagnostic result is connected for payment. Please use the payment button from the diagnostic result page.",
    payerInfoTitle: "Payer Information",
    payerInfoBody:
      "Name, email, and mobile phone number are required to open the KG Inicis payment window.",
    payerName: "Payer name",
    payerNamePlaceholder: "John Doe",
    payerEmail: "Payer email",
    payerEmailPlaceholder: "name@example.com",
    payerPhone: "Mobile phone number",
    payerPhonePlaceholder: "01012345678",
    basicPriceLabel: "Standard price",
    domesticBasicPrice: "KRW 165,000 including VAT",
    caseStudyLabel: "With case study consent",
    domesticCasePrice: "KRW 110,000 including VAT",
    deliverableShort:
      "Detailed diagnostic PDF report and improvement work order",
    internalUse:
      "Diagnostic results, reports, work orders, and scan data may be used internally for service improvement and quality enhancement.",
    basicNoCase:
      "This standard price does not include consent to publicly share limited before-and-after comparison results such as the initial score and improved score.",
    caseScope:
      "The public scope is limited to before-and-after comparison results such as the initial score and improved score.",
    nonDisclosure:
      "Full detailed reports, work orders, detailed issue lists, source evidence, scan data, and internal analysis materials will not be publicly disclosed.",
    domesticButton: "Prepare domestic payment",
    extraVerificationTitle: "Additional Verification Ticket",
    extraVerificationBody:
      "Version 3 and later work order verification requires an additional verification ticket. One payment grants one verification run for the connected work order.",
    extraVerificationLabel: "One additional verification",
    domesticExtraVerificationPrice: "KRW 33,000 including VAT",
    extraVerificationItem: "One automatic verification for this work order",
    extraVerificationButton: "Pay to verify",
    loading: "Opening the payment window... Please wait.",
    globalPayment: "Supports international cards and global SaaS payment flow",
    polarEyebrow: "International Payment",
    polarTitle: "Polar International Payment",
    polarBody:
      "International customers can pay in USD through Polar. After successful payment, paid access is granted using the same paid_entitlements structure as domestic payments.",
    polarButton: "Pay with Polar",
    deliverablesTitle: "Deliverables",
    reportTitle: "Detailed Diagnostic PDF Report",
    reportItems: [
      "Full diagnostic items",
      "Measurement evidence from collected pages",
      "Initial HTML and JavaScript rendering comparison",
      "Key issues and improvement direction",
    ],
    workOrderTitle: "Improvement Work Order",
    workOrderItems: [
      "Work priorities",
      "Developer handoff instructions",
      "Completion criteria",
      "Regression prevention and automated review criteria",
    ],
    improvementTitle: "Additional Post-Improvement Guidance",
    improvementItems: [
      "Additional content suggestions for AI answers",
      "Optional content improvements for the website operator",
      "Re-diagnostic criteria for before-and-after comparison",
    ],
    noticeTitle: "Before Payment",
    noticeBody:
      "Access to the detailed diagnostic PDF report and improvement work order is granted after payment for the connected diagnostic result. The case study discount may be selected only when you agree to limited public sharing of before-and-after comparison results such as the initial score and improved score. Full detailed reports, work orders, detailed issue lists, source evidence, scan data, and internal analysis materials will not be publicly disclosed.",
    kakao: "KakaoTalk inquiry",
    email: "Email inquiry",
    faq: "View FAQ",
  },
} as const;

const domesticPrices: Record<PaymentPlan, string> = {
  BASIC: "165,000원 (VAT 포함)",
  CASE_STUDY_DISCOUNT: "110,000원 (VAT 포함)",
  EXTRA_VERIFICATION: "33,000원 (VAT 포함)",
};

function planLabel(plan: PaymentPlan): string {
  if (plan === "EXTRA_VERIFICATION") {
    return "추가 검수권 1회";
  }

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
  const isEnglish = locale === "en";
  const [searchParams] = useSearchParams();
  const scanId = searchParams.get("scanId")?.trim() ?? "";
  const workOrderId = searchParams.get("workOrderId")?.trim() ?? "";
  const requestedPlan = paymentPlanFromQuery(searchParams.get("plan"));
  const returnTo = searchParams.get("returnTo")?.trim() ?? "";
  const redirectedPaymentOrderId =
    searchParams.get("paymentOrderId")?.trim() ?? "";
  const redirectedPaymentId = searchParams.get("paymentId")?.trim() ?? "";
  const redirectedErrorMessage = searchParams.get("message")?.trim() ?? "";
  const [submittingPlan, setSubmittingPlan] = useState<PaymentPlan | null>(
    null,
  );
  const [message, setMessage] = useState<CheckoutMessage | null>(null);
  const [payerName, setPayerName] = useState("Site AI Score 고객");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhoneNumber, setPayerPhoneNumber] = useState("");
  const redirectHandledRef = useRef(false);

  const hasScanId = useMemo(() => scanId.length > 0, [scanId]);
  const hasWorkOrderId = useMemo(() => workOrderId.length > 0, [workOrderId]);
  const isExtraVerificationCheckout = requestedPlan === "EXTRA_VERIFICATION";
  const canCreatePayment = isExtraVerificationCheckout
    ? hasWorkOrderId
    : hasScanId;
  const safeReturnTo = safeCheckoutReturnPath(returnTo, locale);
  const copy = locale === "en" ? checkoutCopy.en : checkoutCopy.ko;

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
    setSubmittingPlan(requestedPlan);
    completePaymentOrderRequest({
      paymentOrderId: redirectedPaymentOrderId,
      providerPaymentId: redirectedPaymentId,
    })
      .then(() => {
        if (isExtraVerificationCheckout && safeReturnTo) {
          setMessage({
            tone: "success",
            text:
              locale === "en"
                ? "Payment has been confirmed. Returning to the work order."
                : "결제가 확인되었습니다. 작업지시서 화면으로 돌아갑니다.",
          });
          window.setTimeout(() => {
            window.location.assign(`${safeReturnTo}?payment=completed`);
          }, 600);
          return;
        }

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
    requestedPlan,
    isExtraVerificationCheckout,
    safeReturnTo,
    locale,
  ]);

  async function handleCreateDomesticOrder(plan: PaymentPlan) {
    if (plan === "EXTRA_VERIFICATION" && !hasWorkOrderId) {
      setMessage({
        tone: "error",
        text: "결제할 작업지시서가 연결되지 않았습니다. 작업지시서 화면에서 다시 이동해 주세요.",
      });
      return;
    }

    if (plan !== "EXTRA_VERIFICATION" && !hasScanId) {
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
      setMessage({
        tone: "error",
        text: "결제자 이메일을 정확히 입력해 주세요.",
      });
      return;
    }

    if (normalizedPayerPhoneNumber.length < 10) {
      setMessage({
        tone: "error",
        text: "결제자 휴대폰번호를 정확히 입력해 주세요.",
      });
      return;
    }

    setSubmittingPlan(plan);
    setMessage(null);

    try {
      const result = await createPaymentOrderRequest({
        scanId: plan === "EXTRA_VERIFICATION" ? undefined : scanId,
        workOrderId: plan === "EXTRA_VERIFICATION" ? workOrderId : undefined,
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
        orderName: portone.orderName,
        totalAmount: portone.totalAmount,
        currency: "CURRENCY_KRW",
        payMethod: portone.payMethod,
        customer: {
          fullName: normalizedPayerName,
          email: normalizedPayerEmail,
          phoneNumber: normalizedPayerPhoneNumber,
        },
        redirectUrl: checkoutRedirectUrl({
          locale,
          scanId: plan === "EXTRA_VERIFICATION" ? undefined : scanId,
          workOrderId: plan === "EXTRA_VERIFICATION" ? workOrderId : undefined,
          orderId: result.paymentOrder.id,
          plan,
          returnTo: safeReturnTo ?? undefined,
        }),
      });

      if (isPortOnePaymentFailure(paymentResponse)) {
        setMessage({
          tone: "error",
          text: paymentResponse.message ?? "결제가 완료되지 않았습니다.",
        });
        return;
      }

      await completePaymentOrderRequest({
        paymentOrderId: result.paymentOrder.id,
        providerPaymentId: portone.paymentId,
      });

      if (plan === "EXTRA_VERIFICATION" && safeReturnTo) {
        setMessage({
          tone: "success",
          text:
            locale === "en"
              ? "Payment has been confirmed. Returning to the work order."
              : "결제가 확인되었습니다. 작업지시서 화면으로 돌아갑니다.",
        });
        window.setTimeout(() => {
          window.location.assign(`${safeReturnTo}?payment=completed`);
        }, 600);
        return;
      }

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
      setMessage({
        tone: "error",
        text: "결제할 진단 결과가 연결되지 않았습니다.",
      });
      return;
    }

    setSubmittingPlan(plan);
    setMessage(null);

    try {
      const result = await createPaymentOrderRequest({
        scanId,
        plan,
        provider: "POLAR",
      });
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
        text:
          error instanceof Error
            ? error.message
            : "해외 결제 주문을 생성하지 못했습니다.",
      });
    } finally {
      setSubmittingPlan(null);
    }
  }

  return (
    <section className="full-bleed-section legal-section">
      <div className="content-container legal-content">
        <header className="legal-card surface checkout-hero">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.hero}</p>
        </header>

        {!canCreatePayment ? (
          <section className="legal-card surface checkout-notice-card">
            <h2>
              {isExtraVerificationCheckout
                ? isEnglish
                  ? "No work order is connected for payment."
                  : "결제할 작업지시서가 연결되지 않았습니다."
                : copy.noScanTitle}
            </h2>
            <p>
              {isExtraVerificationCheckout
                ? isEnglish
                  ? "Please return to the work order page and use the payment button again."
                  : "작업지시서 화면에서 결제 후 검수 버튼을 다시 눌러 주세요."
                : copy.noScanBody}
            </p>
            <div className="checkout-contact-actions">
              <Link
                className="primary"
                to={
                  isExtraVerificationCheckout
                    ? `/${locale}/work-orders`
                    : `/${locale}/sites`
                }
              >
                {isExtraVerificationCheckout
                  ? isEnglish
                    ? "Back to work orders"
                    : "작업지시서 목록으로"
                  : copy.noScanAction}
              </Link>
              <Link className="secondary" to={`/${locale}/guide`}>
                {locale === "en" ? "Read guide" : "이용가이드 보기"}
              </Link>
            </div>
          </section>
        ) : null}

        {/* 공통 결제 메시지 */}
        {locale !== "en" || isExtraVerificationCheckout ? (
          <section className="legal-card surface checkout-pricing-card">
            <div>
              <p className="eyebrow">{copy.domesticEyebrow}</p>
              <h2>
                {isExtraVerificationCheckout
                  ? copy.extraVerificationTitle
                  : copy.domesticTitle}
              </h2>
              <p>
                {isExtraVerificationCheckout
                  ? copy.extraVerificationBody
                  : copy.domesticBody}
              </p>
            </div>
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
              <strong>{copy.payerInfoTitle}</strong>
              <span>{copy.payerInfoBody}</span>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                {copy.payerName}
                <input
                  type="text"
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder={copy.payerNamePlaceholder}
                  autoComplete="name"
                />
              </label>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                {copy.payerEmail}
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(event) => setPayerEmail(event.target.value)}
                  placeholder={copy.payerEmailPlaceholder}
                  autoComplete="email"
                />
              </label>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                {copy.payerPhone}
                <input
                  type="tel"
                  value={payerPhoneNumber}
                  onChange={(event) => setPayerPhoneNumber(event.target.value)}
                  placeholder={copy.payerPhonePlaceholder}
                  autoComplete="tel"
                />
              </label>
            </div>

            <div className="checkout-price-grid">
              {isExtraVerificationCheckout ? (
                <article>
                  <span>{copy.extraVerificationLabel}</span>
                  <strong>{copy.domesticExtraVerificationPrice}</strong>
                  <ul className="checkout-price-list">
                    <li>{copy.extraVerificationItem}</li>
                    <li>{copy.internalUse}</li>
                  </ul>
                  <button
                    className="primary checkout-price-action"
                    type="button"
                    disabled={!hasWorkOrderId || submittingPlan !== null}
                    onClick={() =>
                      void handleCreateDomesticOrder("EXTRA_VERIFICATION")
                    }
                  >
                    {submittingPlan === "EXTRA_VERIFICATION"
                      ? copy.loading
                      : copy.extraVerificationButton}
                  </button>
                </article>
              ) : (
                <>
                  <article>
                    <span>{copy.basicPriceLabel}</span>
                    <strong>{copy.domesticBasicPrice}</strong>
                    <ul className="checkout-price-list">
                      <li>{copy.deliverableShort}</li>
                      <li>{copy.internalUse}</li>
                      <li>{copy.basicNoCase}</li>
                    </ul>
                    <button
                      className="primary checkout-price-action"
                      type="button"
                      disabled={!hasScanId || submittingPlan !== null}
                      onClick={() => void handleCreateDomesticOrder("BASIC")}
                    >
                      {submittingPlan === "BASIC"
                        ? copy.loading
                        : copy.domesticButton}
                    </button>
                  </article>

                  <article>
                    <span>{copy.caseStudyLabel}</span>
                    <strong>{copy.domesticCasePrice}</strong>
                    <ul className="checkout-price-list">
                      <li>{copy.deliverableShort}</li>
                      <li>{copy.internalUse}</li>
                      <li>{copy.caseScope}</li>
                      <li>{copy.nonDisclosure}</li>
                    </ul>
                    <button
                      className="primary checkout-price-action"
                      type="button"
                      disabled={!hasScanId || submittingPlan !== null}
                      onClick={() =>
                        void handleCreateDomesticOrder("CASE_STUDY_DISCOUNT")
                      }
                    >
                      {submittingPlan === "CASE_STUDY_DISCOUNT"
                        ? copy.loading
                        : copy.domesticButton}
                    </button>
                  </article>
                </>
              )}
            </div>
          </section>
        ) : null}

        {locale === "en" && !isExtraVerificationCheckout ? (
          <section className="legal-card surface checkout-pricing-card">
            <div>
              <p className="eyebrow">{copy.polarEyebrow}</p>
              <h2>{copy.polarTitle}</h2>
              <p>{copy.polarBody}</p>
            </div>

            <div className="checkout-price-grid">
              <article>
                <span>{copy.basicPriceLabel}</span>
                <strong>USD 100</strong>
                <ul className="checkout-price-list">
                  <li>{copy.deliverableShort}</li>
                  <li>{copy.internalUse}</li>
                  <li>{copy.globalPayment}</li>
                  <li>{copy.basicNoCase}</li>
                </ul>
                <button
                  className="primary checkout-price-action"
                  type="button"
                  disabled={!hasScanId || submittingPlan !== null}
                  onClick={() => void handleCreatePolarOrder("BASIC")}
                >
                  {submittingPlan === "BASIC" ? copy.loading : copy.polarButton}
                </button>
              </article>

              <article>
                <span>{copy.caseStudyLabel}</span>
                <strong>USD 70</strong>
                <ul className="checkout-price-list">
                  <li>{copy.deliverableShort}</li>
                  <li>{copy.internalUse}</li>
                  <li>{copy.caseScope}</li>
                  <li>{copy.nonDisclosure}</li>
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
                    ? copy.loading
                    : copy.polarButton}
                </button>
              </article>
            </div>
          </section>
        ) : null}

        <section className="legal-card surface">
          <h2>{copy.deliverablesTitle}</h2>
          <div className="checkout-deliverable-grid">
            <article>
              <h3>{copy.reportTitle}</h3>
              <ul>
                {copy.reportItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article>
              <h3>{copy.workOrderTitle}</h3>
              <ul>
                {copy.workOrderItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article>
              <h3>{copy.improvementTitle}</h3>
              <ul>
                {copy.improvementItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="legal-card surface checkout-notice-card">
          <h2>{copy.noticeTitle}</h2>
          <p>{copy.noticeBody}</p>
          <div className="checkout-contact-actions">
            <a
              className="primary"
              href="https://open.kakao.com/me/sohocenter"
              target="_blank"
              rel="noreferrer"
            >
              {copy.kakao}
            </a>
            <a className="secondary" href="mailto:sohocenter.kr@gmail.com">
              {copy.email}
            </a>
            <Link className="secondary" to={`/${locale}/faq`}>
              {copy.faq}
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
