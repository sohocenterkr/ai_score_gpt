import { useParams } from "react-router-dom";

const faqContent = {
  ko: [
    {
      question: "이 사이트는 어떤 서비스인가요?",
      answer:
        "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해될 수 있는지 진단하고, 개선 방향과 작업지시서를 제공하는 서비스입니다.",
    },
    {
      question: "누구를 위한 서비스인가요?",
      answer:
        "자영업자, 스타트업, 기업 홈페이지 운영자, 마케팅 담당자, 웹 제작사처럼 사이트의 AI 검색 친화도를 개선하려는 사용자를 위한 서비스입니다.",
    },
    {
      question: "처음 이용하려면 어떻게 해야 하나요?",
      answer:
        "회원가입 후 사이트명과 대표 URL을 등록하고 간편진단을 실행하면 됩니다. 이메일 또는 Google 계정으로 가입할 수 있습니다.",
    },
    {
      question: "무료로 이용할 수 있나요?",
      answer:
        "무료 간편진단은 계정당 최대 10개 사이트까지 제공됩니다. 10개를 초과하는 사이트 진단이 필요한 경우 별도 문의 바랍니다.",
    },
    {
      question: "Google 계정으로 로그인할 수 있나요?",
      answer:
        "네. Google 계정으로 회원가입하거나 로그인할 수 있습니다. 동일 이메일로 가입한 계정이 있는 경우 서비스 이용 이력을 유지하기 위해 이메일 기준으로 계정이 연결될 수 있습니다.",
    },
    {
      question: "유료 요금제는 어떻게 되나요?",
      answer:
        "상세 진단 PDF 보고서와 수정 작업지시서는 유료 산출물입니다. 해외 결제 기준 기본 가격은 USD 100이며, 개선 사례 활용에 동의하는 경우 USD 70 할인 상품을 선택할 수 있습니다. 국내 가격과 결제 가능 여부는 결제 화면 안내를 기준으로 합니다.",
    },
    {
      question: "결제는 어떤 방식으로 가능한가요?",
      answer:
        "해외 결제는 Polar를 통한 USD 결제를 지원합니다. 국내 결제는 PortOne 등 국내 결제 서비스를 통해 제공될 수 있으며, 실제 결제 가능 수단은 결제 화면에서 확인할 수 있습니다.",
    },
    {
      question: "사례 할인 상품을 선택하면 어떤 정보가 공개되나요?",
      answer:
        "사례 할인 상품은 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과 공개에 동의하는 조건의 할인 상품입니다. 상세 보고서 전체, 수정 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터, 내부 분석 자료는 공개하지 않고 서비스 개선과 품질 향상을 위해 내부에서만 활용합니다.",
    },
    {
      question: "환불이나 취소는 가능한가요?",
      answer:
        "디지털 산출물이 생성되거나 접근 권한이 열린 경우 환불이 제한될 수 있습니다. 환불 가능 여부는 결제 화면, 결제 서비스 정책, 별도 안내를 기준으로 합니다.",
    },
    {
      question: "모바일에서도 사용할 수 있나요?",
      answer:
        "네. Site AI Score는 모바일에서도 사용할 수 있도록 구성되어 있습니다.",
    },
    {
      question: "비밀번호를 잊어버리면 어떻게 하나요?",
      answer:
        "로그인 화면의 비밀번호 재설정 기능을 이용해 등록한 이메일로 재설정 링크를 받을 수 있습니다. Google 계정으로 가입한 경우 Google 로그인을 이용하거나, 이메일 기준으로 비밀번호 설정 절차를 진행할 수 있습니다.",
    },
    {
      question: "개인정보는 안전하게 보호되나요?",
      answer:
        "서비스 제공에 필요한 정보만 처리하며, 비밀번호는 해시 형태로 저장됩니다. 결제수단 정보는 결제 제공자가 처리하며 Site AI Score는 카드번호를 저장하지 않습니다. 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.",
    },
    {
      question: "입력한 데이터는 저장되나요?",
      answer:
        "사이트명, URL, 진단 결과 점수, 주요 발견 사항은 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 상세 보고서와 작업지시서 관련 자료는 별도 동의 없이 공개하지 않으며, 서비스 개선과 품질 향상을 위해 내부적으로만 활용합니다.",
    },
    {
      question: "오류가 발생하면 어떻게 하나요?",
      answer:
        "오류 화면이 표시되거나 진단이 실패하면 문의 연락처로 상황을 알려 주세요. 확인 후 필요한 지원을 제공합니다.",
    },
    {
      question: "문의는 어디로 하면 되나요?",
      answer:
        "카카오톡 오픈채팅 https://open.kakao.com/me/sohocenter 또는 이메일 sohocenter.kr@gmail.com 으로 문의할 수 있습니다.",
    },
  ],
  en: [
    {
      question: "What is Site AI Score?",
      answer:
        "Site AI Score diagnoses whether a website can be understood by AI search systems and search engines, and provides improvement guidance and work orders.",
    },
    {
      question: "Who is this service for?",
      answer:
        "It is for small business owners, startups, company website operators, marketers, and web agencies that want to improve a site's AI search readiness.",
    },
    {
      question: "How do I get started?",
      answer:
        "Create an account, register a website name and main URL, and run a simple diagnostic. You can sign up with an email address or a Google account.",
    },
    {
      question: "Can I use it for free?",
      answer:
        "Free simple diagnostics are available for up to 10 websites per account. If you need to diagnose more than 10 websites, please contact us separately.",
    },
    {
      question: "Can I sign in with Google?",
      answer:
        "Yes. You can sign up or sign in with a Google account. If an account with the same email already exists, the service may link the account based on the email address to preserve service history.",
    },
    {
      question: "What are the paid prices?",
      answer:
        "Detailed diagnostic PDF reports and improvement work orders are paid digital deliverables. The standard international price is USD 100. A USD 70 case study discount may be selected when you agree to limited public sharing of before-and-after comparison results.",
    },
    {
      question: "How can I pay?",
      answer:
        "International USD payments are supported through Polar. Domestic payments may be offered through domestic payment services such as PortOne. Available payment methods are shown on the checkout page.",
    },
    {
      question: "What is publicly shared with the case study discount?",
      answer:
        "The case study discount includes consent to publicly share limited before-and-after comparison results, such as the initial score and improved score. Full reports, work orders, detailed issue lists, source evidence, scan data, and internal analysis materials are not publicly disclosed and are used internally for service improvement and quality enhancement.",
    },
    {
      question: "Are refunds available?",
      answer:
        "Because the deliverables are digital, refunds may be limited once materials have been generated or access has been granted. Refund eligibility follows the checkout page, payment provider policy, and separate notices.",
    },
    {
      question: "Can I use it on mobile?",
      answer:
        "Yes. Site AI Score is designed to be usable on mobile devices.",
    },
    {
      question: "What if I forget my password?",
      answer:
        "Use the password reset feature on the login page to receive a reset link by email. If you signed up with Google, you can use Google sign-in or set a password based on your email account flow.",
    },
    {
      question: "Is my personal information protected?",
      answer:
        "We process only the information necessary to provide the service. Passwords are stored as hashes. Payment method details are processed by the payment provider, and Site AI Score does not store card numbers. Please see the Privacy Policy for details.",
    },
    {
      question: "Is my submitted data stored?",
      answer:
        "Website names, URLs, diagnostic scores, and key findings may be stored to provide the service and maintain user history. Detailed reports and work order materials are not publicly disclosed without separate consent and are used internally for service improvement and quality enhancement.",
    },
    {
      question: "What should I do if an error occurs?",
      answer:
        "If you see an error screen or a diagnostic fails, contact us with the situation. We will review it and provide support as needed.",
    },
    {
      question: "How can I contact you?",
      answer:
        "You can contact us through KakaoTalk open chat at https://open.kakao.com/me/sohocenter or by email at sohocenter.kr@gmail.com.",
    },
  ],
};

export function FaqPage() {
  const { locale } = useParams();
  const faqs = locale === "en" ? faqContent.en : faqContent.ko;
  const title = locale === "en" ? "Frequently Asked Questions" : "자주 묻는 질문";

  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  });

  return (
    <section className="full-bleed-section legal-section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />
      <div className="content-container legal-content">
        <p className="eyebrow">FAQ</p>
        <h1>{title}</h1>

        <div className="surface legal-card faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
