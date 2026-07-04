import { useParams } from "react-router-dom";

const privacyContent = {
  ko: {
    eyebrow: "PRIVACY",
    title: "개인정보처리방침",
    sections: [
      {
        heading: "1. 개인정보 처리 목적",
        paragraphs: [
          "소호센터는 Site AI Score 회원가입, 로그인, 진단 결과 제공, 유료 산출물 접근 권한 관리, 고객 문의 응대, 서비스 개선 및 보안 관리를 위해 개인정보를 처리합니다.",
        ],
      },
      {
        heading: "2. 처리하는 개인정보 항목",
        paragraphs: [
          "회원가입 및 로그인 과정에서 이름, 이메일, 비밀번호 해시, Google 계정 인증 정보, 이메일 인증 여부, 약관 및 개인정보처리방침 동의 여부가 처리될 수 있습니다.",
          "결제 과정에서는 결제 주문 식별자, 결제 제공자, 결제 상태, 결제 금액, 통화, 결제 완료 시각, 유료 권한 정보가 처리될 수 있습니다. 실제 카드번호 등 결제수단 정보는 결제 제공자가 처리하며 Site AI Score는 저장하지 않습니다.",
        ],
      },
      {
        heading: "3. 입력 데이터와 진단 데이터",
        paragraphs: [
          "사용자가 입력한 사이트명, 대표 URL, 진단 대상 URL, 진단 결과 점수, 주요 발견 사항, 생성된 보고서와 작업지시서 관련 데이터는 서비스 제공과 이력 확인을 위해 저장될 수 있습니다.",
          "상세 보고서, 수정 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터, 내부 분석 자료는 별도 동의 없이 공개하지 않으며, 서비스 개선과 품질 향상을 위한 내부 목적으로만 활용합니다.",
        ],
      },
      {
        heading: "4. 사례 할인 상품의 공개 범위",
        paragraphs: [
          "개선 사례 활용 동의가 포함된 할인 상품을 선택한 경우, 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과가 공개 사례로 활용될 수 있습니다.",
          "상세 보고서 전체, 수정 작업지시서, 상세 문제 목록, 원문 증거, 스캔 데이터, 내부 분석 자료는 공개하지 않습니다.",
        ],
      },
      {
        heading: "5. 보관 및 삭제",
        paragraphs: [
          "회원이 탈퇴하면 관련 계정 정보는 삭제됩니다. 다만 부정 가입 방지, 법령상 보관 의무, 결제 및 분쟁 대응을 위해 필요한 최소 정보는 관련 기준에 따라 보관될 수 있습니다.",
        ],
      },
      {
        heading: "6. 제3자 제공",
        paragraphs: [
          "소호센터는 법령에 근거가 있거나 사용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.",
        ],
      },
      {
        heading: "7. 외부 서비스 이용",
        paragraphs: [
          "서비스 운영 과정에서 Google 인증, 이메일 발송, 결제, 호스팅, 데이터베이스, 분석 및 보안 관리를 위한 외부 서비스가 사용될 수 있습니다. 각 외부 서비스는 해당 기능 제공에 필요한 범위 내에서만 활용됩니다.",
        ],
      },
      {
        heading: "8. 개인정보 보호 책임자",
        paragraphs: [
          "개인정보보호 책임자: 김천식 / 문의 연락처: 070-4513-4093",
        ],
      },
      {
        heading: "9. 문의",
        paragraphs: [
          "개인정보 처리와 관련한 문의는 카카오톡 오픈채팅 또는 회사 연락처로 접수할 수 있습니다.",
        ],
      },
    ],
  },
  en: {
    eyebrow: "PRIVACY",
    title: "Privacy Policy",
    sections: [
      {
        heading: "1. Purpose of Processing Personal Information",
        paragraphs: [
          "SOHO Center processes personal information to provide Site AI Score account registration, sign-in, diagnostic results, paid deliverable access control, customer support, service improvement, and security management.",
        ],
      },
      {
        heading: "2. Personal Information We Process",
        paragraphs: [
          "During registration and sign-in, we may process name, email address, password hash, Google account authentication information, email verification status, and consent status for the Terms and Privacy Policy.",
          "During payment, we may process payment order identifiers, payment provider, payment status, amount, currency, payment completion time, and paid entitlement information. Actual card numbers and payment method details are processed by the payment provider and are not stored by Site AI Score.",
        ],
      },
      {
        heading: "3. Input Data and Diagnostic Data",
        paragraphs: [
          "Website names, main URLs, target URLs, diagnostic scores, key findings, and data related to generated reports and work orders may be stored to provide the service and maintain user history.",
          "Detailed reports, improvement work orders, detailed issue lists, source evidence, scan data, and internal analysis materials will not be publicly disclosed without separate consent and will be used internally for service improvement and quality enhancement.",
        ],
      },
      {
        heading: "4. Public Scope for Case Study Discount Products",
        paragraphs: [
          "If a user selects a discounted product that includes consent for case study use, limited before-and-after comparison results, such as the initial score and improved score, may be used as a public case study.",
          "Full detailed reports, improvement work orders, detailed issue lists, source evidence, scan data, and internal analysis materials will not be publicly disclosed.",
        ],
      },
      {
        heading: "5. Retention and Deletion",
        paragraphs: [
          "When a member deletes their account, related account information is deleted. However, minimal information required for abuse prevention, legal retention duties, payment records, or dispute handling may be retained according to applicable standards.",
        ],
      },
      {
        heading: "6. Third-Party Disclosure",
        paragraphs: [
          "SOHO Center does not provide personal information to third parties unless required by law or with the user's consent.",
        ],
      },
      {
        heading: "7. External Services",
        paragraphs: [
          "External services may be used for Google authentication, email delivery, payment, hosting, database operation, analytics, and security management. Each service is used only within the scope necessary to provide the relevant function.",
        ],
      },
      {
        heading: "8. Privacy Officer",
        paragraphs: [
          "Privacy Officer: Cheonsik Kim / Contact: 070-4513-4093",
        ],
      },
      {
        heading: "9. Contact",
        paragraphs: [
          "Privacy-related inquiries may be submitted through KakaoTalk open chat or the company's contact information.",
        ],
      },
    ],
  },
};

export function PrivacyPage() {
  const { locale } = useParams();
  const content = locale === "en" ? privacyContent.en : privacyContent.ko;

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
