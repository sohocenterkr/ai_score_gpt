import { useParams } from "react-router-dom";

const guideContent = {
  ko: {
    eyebrow: "GUIDE",
    title: "이용가이드",
    sections: [
      {
        heading: "1. 회원가입",
        paragraphs: [
          "이메일 또는 Google 계정으로 회원가입합니다. 이메일 가입의 경우 인증 메일 확인 후 로그인할 수 있으며, Google 계정은 Google 인증 절차를 통해 로그인합니다.",
        ],
      },
      {
        heading: "2. 사이트 등록",
        paragraphs: [
          "진단하려는 사이트명과 대표 URL을 입력합니다. 가능한 한 실제 운영 중인 공개 URL을 입력하는 것이 좋습니다.",
        ],
      },
      {
        heading: "3. 무료 간편진단 실행",
        paragraphs: [
          "간편진단은 사이트의 AI 검색 친화도, 구조화 데이터, 초기 HTML 콘텐츠, 접근성, 링크 구조 등을 빠르게 점검합니다.",
          "무료 간편진단은 계정당 최대 10개 사이트까지 제공됩니다. 10개를 초과하는 사이트 진단이 필요한 경우 별도 문의 바랍니다.",
        ],
      },
      {
        heading: "4. 진단 결과 확인",
        paragraphs: [
          "점수, 등급, 주요 발견 사항, 개선 방향을 확인합니다. 점수는 참고 지표이며 검색 결과 노출이나 AI 인용을 보장하지 않습니다.",
        ],
      },
      {
        heading: "5. 보고서와 작업지시서",
        paragraphs: [
          "상세 진단 PDF 보고서와 수정 작업지시서는 유료 산출물로 제공됩니다. 결제 완료 후 해당 진단 결과에 대한 접근 권한이 열립니다.",
          "기본 상품은 상세 산출물 제공을 목적으로 하며, 사례 할인 상품은 적용 전 점수와 개선 후 점수 등 제한된 전후 비교 결과 공개에 동의하는 경우 선택할 수 있습니다.",
        ],
      },
      {
        heading: "6. 결제",
        paragraphs: [
          "해외 결제는 Polar를 통해 USD 기준으로 제공될 수 있습니다. 국내 결제는 PortOne 등 국내 결제 서비스를 통해 제공될 수 있으며, 실제 결제 가능 수단은 결제 화면 안내를 기준으로 합니다.",
        ],
      },
      {
        heading: "7. 개선 후 재진단",
        paragraphs: [
          "사이트를 수정한 뒤 다시 진단하면 1차, 2차, 3차처럼 회차별 점수 변화를 확인할 수 있습니다.",
        ],
      },
      {
        heading: "8. 문의",
        paragraphs: [
          "오류가 발생하거나 이용 방법이 궁금한 경우 카카오톡 오픈채팅 또는 이메일로 문의할 수 있습니다.",
        ],
      },
    ],
  },
  en: {
    eyebrow: "GUIDE",
    title: "User Guide",
    sections: [
      {
        heading: "1. Create an Account",
        paragraphs: [
          "You can sign up with an email address or a Google account. Email sign-up requires email verification, while Google sign-in uses Google's authentication flow.",
        ],
      },
      {
        heading: "2. Register a Website",
        paragraphs: [
          "Enter the website name and main URL you want to diagnose. We recommend using a publicly accessible production URL.",
        ],
      },
      {
        heading: "3. Run a Free Simple Diagnostic",
        paragraphs: [
          "The simple diagnostic checks AI search readiness, structured data, initial HTML content, accessibility, and link structure.",
          "Free simple diagnostics are available for up to 10 websites per account. If you need to diagnose more than 10 websites, please contact us separately.",
        ],
      },
      {
        heading: "4. Review Diagnostic Results",
        paragraphs: [
          "Review the score, grade, key findings, and improvement guidance. Scores are reference indicators and do not guarantee search exposure or AI citations.",
        ],
      },
      {
        heading: "5. Reports and Work Orders",
        paragraphs: [
          "Detailed diagnostic PDF reports and improvement work orders are paid digital deliverables. After payment, access is granted for the relevant website scan.",
          "The standard product provides detailed deliverables. The case study discount product may be selected when you agree to limited public sharing of before-and-after comparison results, such as the initial score and improved score.",
        ],
      },
      {
        heading: "6. Payment",
        paragraphs: [
          "International payments may be offered in USD through Polar. Domestic payments may be offered through domestic payment services such as PortOne. Available payment methods follow the checkout page.",
        ],
      },
      {
        heading: "7. Re-diagnose After Improvements",
        paragraphs: [
          "After improving your website, you can run another diagnostic and compare score changes across the first, second, and third diagnostic rounds.",
        ],
      },
      {
        heading: "8. Contact",
        paragraphs: [
          "If an error occurs or you need help using the service, contact us through KakaoTalk open chat or email.",
        ],
      },
    ],
  },
};

export function GuidePage() {
  const { locale } = useParams();
  const content = locale === "en" ? guideContent.en : guideContent.ko;

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
