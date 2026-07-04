import { useParams } from "react-router-dom";

const termsContent = {
  ko: {
    eyebrow: "TERMS",
    title: "이용약관",
    sections: [
      {
        heading: "제1조 목적",
        paragraphs: [
          "본 약관은 소호센터가 운영하는 Site AI Score 서비스의 이용 조건, 절차, 권리와 의무를 정하는 것을 목적으로 합니다.",
        ],
      },
      {
        heading: "제2조 서비스의 내용",
        paragraphs: [
          "Site AI Score는 웹사이트의 AI 검색 친화도, 검색엔진 접근성, 구조화 데이터, 콘텐츠 명확성, 진단 결과 등을 분석하고 개선 방향을 안내하는 서비스입니다.",
          "간편진단 실행은 무료로 제공될 수 있으며, 상세 진단 PDF 보고서, 수정 작업지시서, 개선 후 비교 자료 등 추가 산출물은 유료 결제 후 제공될 수 있습니다.",
        ],
      },
      {
        heading: "제3조 회원가입과 계정",
        paragraphs: [
          "사용자는 이메일 또는 Google 계정으로 회원가입하거나 로그인할 수 있습니다. 사용자는 본인의 정확한 정보를 제공해야 하며, 계정 관리 책임은 사용자에게 있습니다.",
          "동일한 이메일 주소로 이메일 계정과 Google 계정이 사용되는 경우, 서비스는 계정 중복을 방지하고 이용 이력을 유지하기 위해 해당 이메일 기준으로 계정을 연결하거나 확인할 수 있습니다.",
        ],
      },
      {
        heading: "제4조 무료 이용 범위",
        paragraphs: [
          "무료 간편진단은 계정당 최대 10개 사이트까지 제공됩니다. 10개를 초과하는 사이트 진단이 필요한 경우 별도 문의 바랍니다.",
          "서비스 남용, 자동화된 대량 요청, 타인의 사이트를 무단으로 반복 진단하는 행위는 제한될 수 있습니다.",
        ],
      },
      {
        heading: "제5조 유료 산출물과 결제",
        paragraphs: [
          "상세 진단 PDF 보고서, 수정 작업지시서, 개선 후 비교 자료 등은 유료 산출물로 제공될 수 있습니다. 유료 가격, 결제 수단, 제공 범위는 결제 화면에서 최종 안내됩니다.",
          "해외 결제는 Polar 등 외부 결제 서비스를 통해 처리될 수 있으며, 국내 결제는 PortOne 등 국내 결제 서비스를 통해 제공될 수 있습니다.",
        ],
      },
      {
        heading: "제6조 사례 할인과 자료 이용",
        paragraphs: [
          "개선 사례 활용 동의가 포함된 할인 상품을 선택한 경우, Site AI Score는 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과를 공개 사례로 활용할 수 있습니다.",
          "상세 보고서 전체, 수정 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터, 내부 분석 자료는 별도 동의 없이 공개하지 않으며, 서비스 개선과 품질 향상을 위한 내부 목적으로만 활용합니다.",
        ],
      },
      {
        heading: "제7조 환불 및 취소",
        paragraphs: [
          "디지털 산출물은 결제 후 생성되거나 접근 권한이 열린 경우 환불이 제한될 수 있습니다. 환불 가능 여부와 기준은 결제 화면, 결제 서비스 정책, 별도 안내를 기준으로 합니다.",
        ],
      },
      {
        heading: "제8조 금지 행위",
        paragraphs: [
          "사용자는 서비스의 정상 운영을 방해하거나, 타인의 권리를 침해하거나, 자동화 도구로 과도한 요청을 보내거나, 진단 결과를 오해를 유발하는 방식으로 사용할 수 없습니다.",
        ],
      },
      {
        heading: "제9조 면책",
        paragraphs: [
          "Site AI Score의 진단 결과는 웹사이트 개선을 위한 참고 자료입니다. 검색엔진 또는 AI 서비스의 노출, 인용, 순위 상승, 매출 증가를 보장하지 않습니다.",
        ],
      },
      {
        heading: "제10조 문의",
        paragraphs: [
          "서비스 이용과 관련한 문의는 카카오톡 오픈채팅 또는 회사 연락처를 통해 접수할 수 있습니다.",
        ],
      },
    ],
  },
  en: {
    eyebrow: "TERMS",
    title: "Terms of Service",
    sections: [
      {
        heading: "1. Purpose",
        paragraphs: [
          "These Terms set out the conditions, procedures, rights, and obligations for using Site AI Score, a service operated by SOHO Center.",
        ],
      },
      {
        heading: "2. Service Description",
        paragraphs: [
          "Site AI Score analyzes a website's AI search readiness, search engine accessibility, structured data, content clarity, and diagnostic results, and provides improvement guidance.",
          "Simple diagnostics may be provided free of charge. Detailed PDF reports, improvement work orders, and before-and-after comparison materials may be provided as paid digital deliverables.",
        ],
      },
      {
        heading: "3. Account Registration",
        paragraphs: [
          "Users may register or sign in with an email address or a Google account. Users must provide accurate information and are responsible for managing their own accounts.",
          "If the same email address is used for both email-based and Google-based access, the service may link or verify the account based on that email address to prevent duplicate accounts and preserve service history.",
        ],
      },
      {
        heading: "4. Free Usage Scope",
        paragraphs: [
          "Free simple diagnostics are available for up to 10 websites per account. If you need to diagnose more than 10 websites, please contact us separately.",
          "Abusive use, automated bulk requests, or repeated unauthorized diagnostics of third-party websites may be restricted.",
        ],
      },
      {
        heading: "5. Paid Deliverables and Payment",
        paragraphs: [
          "Detailed diagnostic PDF reports, improvement work orders, and post-improvement comparison materials may be provided as paid deliverables. Pricing, payment methods, and included deliverables are confirmed on the checkout page.",
          "International payments may be processed through external payment services such as Polar. Domestic payments may be provided through domestic payment services such as PortOne.",
        ],
      },
      {
        heading: "6. Case Study Discount and Data Use",
        paragraphs: [
          "If a user selects a discounted product that includes consent for case study use, Site AI Score may publicly share limited before-and-after comparison results, such as the initial score and the improved score.",
          "Full detailed reports, improvement work orders, detailed issue lists, source evidence, scan data, and internal analysis materials will not be publicly disclosed without separate consent and will be used internally for service improvement and quality enhancement.",
        ],
      },
      {
        heading: "7. Refunds and Cancellations",
        paragraphs: [
          "Because the deliverables are digital, refunds may be limited once materials have been generated or access has been granted. Refund eligibility and criteria follow the checkout page, payment provider policy, and separate notices.",
        ],
      },
      {
        heading: "8. Prohibited Conduct",
        paragraphs: [
          "Users must not disrupt normal service operation, infringe others' rights, send excessive automated requests, or use diagnostic results in a misleading manner.",
        ],
      },
      {
        heading: "9. Disclaimer",
        paragraphs: [
          "Site AI Score diagnostics are reference materials for website improvement. They do not guarantee search engine exposure, AI citations, ranking improvements, traffic growth, revenue, or advertising performance.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: [
          "Service inquiries may be submitted through KakaoTalk open chat or the company's contact information.",
        ],
      },
    ],
  },
};

export function TermsPage() {
  const { locale } = useParams();
  const content = locale === "en" ? termsContent.en : termsContent.ko;

  return (
    <section className="full-bleed-section legal-section">
      <div className="content-container legal-content">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>

        <div className="surface legal-card">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
