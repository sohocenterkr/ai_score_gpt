import { Link, useParams } from "react-router-dom";

const diagnosticAreas = [
  "검색·AI 봇 접근 가능 여부",
  "초기 HTML 핵심정보 포함 여부",
  "구조화 데이터와 화면 정보 일치",
  "요금·환불·고객지원 등 AI 답변 근거",
  "차별점·활용 사례 등 AI 추천 근거",
];

const serviceSteps = [
  [
    "01",
    "사이트 진단",
    "공개 URL을 기준으로 AI가 읽을 수 있는 내용을 검사합니다.",
  ],
  ["02", "수정 작업지시", "문제별 요구사항과 자동검수 완료 기준을 제공합니다."],
  ["03", "배포 결과 검수", "수정된 운영 URL을 같은 규칙으로 다시 검사합니다."],
];

const serviceStepsEn = [
  ["01", "Website diagnosis", "Check what AI can read from a public URL."],
  [
    "02",
    "Improvement work order",
    "Get issue-specific requirements and completion criteria.",
  ],
  [
    "03",
    "Deployment recheck",
    "Recheck the updated production URL with the same rules.",
  ],
];

const diagnosticAreasEn = [
  "Search and AI bot accessibility",
  "Key information in the initial HTML",
  "Consistency between structured data and visible content",
  "Answerability for expected customer questions",
  "Proof points that can support AI recommendations",
];

const serviceDetailSections = [
  {
    title: "무엇을 제공하나요?",
    body: "Site AI Score는 AI가 사이트를 읽고, 답하고, 추천할 수 있는 상태인지 점검합니다. 검색·AI 봇 접근 가능 여부, 초기 HTML 핵심정보, 구조화 데이터와 화면 정보 일치, 요금·환불·고객지원·개인정보 처리 같은 AI 답변 근거, 차별점·활용 사례 같은 AI 추천 근거를 함께 확인합니다.",
  },
  {
    title: "이런 분께 적합합니다",
    body: "AI 검색에서 자사 사이트가 잘 발견되고 설명되기를 원하는 소상공인, SaaS 운영자, 병원·학원·로컬 매장 운영자, 마케팅 대행사, 웹 개발팀이 사용할 수 있습니다. 신규 사이트 공개 전 AI 친화도 점검, 기존 사이트의 구조화 데이터 보강, 고객 질문에 대한 AI 답변 품질 개선, 수정 전후 비교 검수에 활용할 수 있습니다.",
  },
  {
    title: "요금과 무료·유료 범위",
    body: "간편진단은 무료로 제공될 수 있으며, 계정당 무료 진단 개수에는 제한이 있을 수 있습니다. 상세 진단 PDF 보고서, 수정 작업지시서, 개선 후 비교 자료는 유료 산출물로 제공될 수 있습니다. 결제 금액, 할인 조건, 국내·해외 결제 가능 여부는 요금/결제 안내 화면에서 확인합니다.",
  },
  {
    title: "개인정보와 입력자료 처리",
    body: "사용자가 입력한 사이트명, 대표 URL, 진단 대상 URL, 진단 점수와 주요 발견 사항은 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 원본 HTML은 저장하지 않고 해시와 구조화된 검사 증거를 보관하는 것을 원칙으로 하며, 상세 보고서와 작업지시서 자료는 별도 동의 없이 공개하지 않습니다.",
  },
  {
    title: "고객지원과 문의",
    body: "문의는 카카오톡 오픈채팅, 이메일, 전화로 접수할 수 있습니다. 공식 문의 채널은 카카오톡 오픈채팅, 이메일 sohocenter.kr@gmail.com, 전화 070-4513-4093입니다. 서비스 오류, 결제, 상세 보고서, 작업지시서, 재검수 관련 문의를 지원합니다.",
  },
  {
    title: "차별점과 신뢰 근거",
    body: "Site AI Score는 단순한 점수 표시보다 진단 증거, 수정 요구사항, 완료 판정 기준, 재검수 흐름을 함께 제공합니다. 기술 준비 50점과 AI 답변 준비 콘텐츠 50점을 나누어 보면서도, 작업지시서에서는 초기 HTML과 구조화 데이터 같은 기술 게이트를 우선 처리하도록 안내합니다.",
  },
];

const serviceDetailSectionsEn = [
  {
    title: "What does Site AI Score provide?",
    body: "Site AI Score checks whether AI systems can access, read, answer from, and recommend a website. It reviews AI bot access, initial HTML content, structured data consistency, pricing and support information, privacy handling, differentiation, and use cases.",
  },
  {
    title: "Who is it for?",
    body: "It is useful for SaaS teams, local businesses, agencies, marketing teams, and developers who want their official site to be easier for AI search systems to understand and cite.",
  },
  {
    title: "Pricing and paid scope",
    body: "Simple diagnostics may be provided for free. Detailed diagnostic PDF reports, improvement work orders, and before-and-after comparison materials may be provided as paid deliverables. Final pricing and available payment methods are shown on the pricing page.",
  },
  {
    title: "Privacy and submitted data",
    body: "Site names, URLs, diagnostic scores, and major findings may be stored to provide the service and retain history. Raw HTML is not stored; hashes and structured evidence are retained. Detailed reports and work orders are not publicly disclosed without separate consent.",
  },
  {
    title: "Support and contact",
    body: "Support requests can be sent through KakaoTalk open chat, email at sohocenter.kr@gmail.com, or phone at 070-4513-4093. We support service errors, payments, reports, work orders, and rechecks.",
  },
  {
    title: "Differentiation and proof",
    body: "Site AI Score connects diagnostic evidence, work-order requirements, completion criteria, and rechecks. The score separates technical readiness and AI answer-readiness, while the work order prioritizes technical gates such as initial HTML and structured data.",
  },
];

const faqItems = [
  [
    "Site AI Score는 무엇을 진단하나요?",
    "공개 URL의 AI 봇 접근성, 초기 HTML 본문, H1과 내부 링크, 구조화 데이터, 요금·고객지원·개인정보 같은 AI 답변 준비 콘텐츠를 함께 진단합니다.",
  ],
  [
    "무료 간편진단과 유료 산출물의 차이는 무엇인가요?",
    "무료 간편진단은 점수와 개선 필요 항목 개수 요약을 제공합니다. 상세 진단 PDF 보고서와 수정 작업지시서는 결제 후 제공되는 유료 산출물입니다.",
  ],
  [
    "수정 작업지시서에는 무엇이 포함되나요?",
    "기술 설정, 초기 HTML, canonical, JSON-LD, 콘텐츠 보강, 개인정보와 문의 정책, 재검수 완료 기준을 개발자가 실행하기 쉬운 작업 항목으로 정리합니다.",
  ],
  [
    "입력한 사이트 정보와 진단 결과는 어떻게 처리되나요?",
    "사이트명, URL, 진단 점수와 주요 발견 사항은 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 상세 보고서와 작업지시서 자료는 별도 동의 없이 공개하지 않습니다.",
  ],
];

const faqItemsEn = [
  [
    "What does Site AI Score diagnose?",
    "It diagnoses AI bot access, initial HTML body text, H1 and internal links, structured data, and answer-readiness content such as pricing, support, and privacy information.",
  ],
  [
    "What is the difference between the free scan and paid deliverables?",
    "The free scan shows the score and a summary count of improvement items. Detailed PDF reports and improvement work orders are paid deliverables.",
  ],
  [
    "What is included in an improvement work order?",
    "It converts technical settings, initial HTML, canonical, JSON-LD, content, privacy, contact policy, and recheck criteria into actionable work items.",
  ],
  [
    "How is submitted site data handled?",
    "Site names, URLs, scores, and key findings may be stored for service delivery. Detailed reports and work orders are not publicly disclosed without separate consent.",
  ],
];

export function HomePage() {
  const { locale = "ko" } = useParams();
  const isEnglish = locale === "en";
  const activeLocale = isEnglish ? "en" : "ko";
  const activeSteps = isEnglish ? serviceStepsEn : serviceSteps;
  const activeDiagnosticAreas = isEnglish ? diagnosticAreasEn : diagnosticAreas;
  const activeDetailSections = isEnglish
    ? serviceDetailSectionsEn
    : serviceDetailSections;
  const activeFaqItems = isEnglish ? faqItemsEn : faqItems;

  const organizationName = isEnglish ? "SOHO Center" : "소호센터";
  const homeJsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://siteaiscore.com/#organization",
      name: organizationName,
      alternateName: "SOHO Center",
      url: `https://siteaiscore.com/${activeLocale}`,
      logo: "https://siteaiscore.com/favicon.ico",
      email: "sohocenter.kr@gmail.com",
      telephone: "+82-70-4513-4093",
      sameAs: ["https://open.kakao.com/me/sohocenter"],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+82-70-4513-4093",
        email: "sohocenter.kr@gmail.com",
        url: "https://open.kakao.com/me/sohocenter",
        contactType: "customer support",
        availableLanguage: isEnglish ? ["en", "ko"] : ["ko", "en"],
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressRegion: isEnglish ? "Seoul" : "서울특별시",
        addressLocality: isEnglish ? "Gangdong-gu" : "강동구",
        streetAddress: isEnglish
          ? "202, 1522-10 Yangjae-daero, Gil-dong"
          : "양재대로 1522-10, 202호(길동)",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://siteaiscore.com/#website",
      name: "Site AI Score",
      url: `https://siteaiscore.com/${activeLocale}`,
      inLanguage: isEnglish ? "en" : "ko-KR",
      publisher: {
        "@id": "https://siteaiscore.com/#organization",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": "https://siteaiscore.com/#webapplication",
      name: "Site AI Score",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `https://siteaiscore.com/${activeLocale}`,
      description: isEnglish
        ? "Site AI Score is a web application that diagnoses AI search readiness, search engine accessibility, structured data, initial HTML content, and improvement direction."
        : "Site AI Score는 웹사이트의 AI 검색 친화도, 검색엔진 접근성, 구조화 데이터, 초기 HTML 콘텐츠, 개선 방향을 진단하는 웹 애플리케이션입니다.",
      provider: {
        "@id": "https://siteaiscore.com/#organization",
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: "100",
        availability: "https://schema.org/PreOrder",
        description: isEnglish
          ? "Simple diagnostics are free, while detailed reports and improvement work orders may be provided as paid deliverables."
          : "간편진단 실행은 무료로 제공되며, 상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다.",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": "https://siteaiscore.com/#faq",
      mainEntity: activeFaqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: homeJsonLd }}
      />
      <section className="hero-section full-bleed-section">
        <div className="content-container hero-content">
          <p className="eyebrow">AEO WEB QUALITY VERIFICATION</p>
          <h1>
            {isEnglish
              ? "See how well AI can understand your website."
              : "내 사이트를 AI가 얼마나 잘 이해하는지 확인하세요."}
          </h1>
          <p className="hero-description">
            {isEnglish
              ? "Run a public URL diagnostic, turn issues into a clear improvement work order, and recheck the updated site with the same criteria."
              : "공개 URL의 기술 준비 상태와 AI가 고객 질문에 답하기 위한 핵심 콘텐츠 부족 항목을 함께 진단합니다. 수정할 내용을 작업지시서로 정리하고, 배포 후 같은 기준으로 다시 검수합니다."}
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to={`/${activeLocale}/sites`}>
              {isEnglish ? "Start diagnosis" : "사이트 진단"}
            </Link>
          </div>
        </div>
      </section>

      <section className="full-bleed-section section-muted">
        <div className="content-container section-content">
          <div className="section-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>
              {isEnglish
                ? "From diagnosis to improvement verification in one flow"
                : "기술 진단부터 콘텐츠 보완 과제와 수정 검수까지"}
            </h2>
          </div>
          <div className="step-grid">
            {activeSteps.map(([number, title, description]) => (
              <article className="surface step-item" key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="full-bleed-section">
        <div className="content-container section-content">
          <div className="section-heading">
            <p className="eyebrow">DIAGNOSIS</p>
            <h2>
              {isEnglish
                ? "Core areas AI needs to read and understand your site"
                : "AI가 읽고, 답하고, 추천하기 위해 필요한 핵심 영역"}
            </h2>
          </div>
          <ul className="diagnostic-list">
            {activeDiagnosticAreas.map((area) => (
              <li key={area}>
                <span aria-hidden="true">✓</span>
                {area}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="full-bleed-section section-muted">
        <div className="content-container section-content">
          <div className="section-heading">
            <p className="eyebrow">OFFICIAL INFORMATION</p>
            <h2>
              {isEnglish
                ? "Information AI can cite from the official page"
                : "AI가 공식 페이지에서 인용할 수 있는 핵심 정보"}
            </h2>
          </div>
          <div className="step-grid">
            {activeDetailSections.map((section) => (
              <article className="surface step-item" key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="secondary-action" to={`/${activeLocale}/privacy`}>
              {isEnglish ? "Privacy Policy" : "개인정보처리방침"}
            </Link>
            <Link className="secondary-action" to={`/${activeLocale}/terms`}>
              {isEnglish ? "Terms" : "이용약관"}
            </Link>
            <Link className="secondary-action" to={`/${activeLocale}/checkout`}>
              {isEnglish ? "Pricing / Payment" : "요금/결제 안내"}
            </Link>
          </div>
        </div>
      </section>

      <section className="full-bleed-section">
        <div className="content-container section-content">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>
              {isEnglish ? "Frequently asked questions" : "자주 묻는 질문"}
            </h2>
          </div>
          <div className="step-grid">
            {activeFaqItems.map(([question, answer]) => (
              <article className="surface step-item" key={question}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="secondary-action" to={`/${activeLocale}/faq`}>
              {isEnglish ? "View full FAQ" : "FAQ 전체 보기"}
            </Link>
            <a
              className="secondary-action"
              href="https://open.kakao.com/me/sohocenter"
              target="_blank"
              rel="noreferrer"
            >
              {isEnglish ? "KakaoTalk contact" : "카카오톡 문의"}
            </a>
          </div>
        </div>
      </section>

      <section className="full-bleed-section section-dark">
        <div className="content-container section-content compare-section">
          <div>
            <p className="eyebrow eyebrow-light">BEFORE &amp; AFTER</p>
            <h2>
              {isEnglish
                ? "We show not only the score, but why it changed."
                : "점수만 보여주지 않고, 왜 AI 답변·추천 가능성이 달라지는지 설명합니다."}
            </h2>
          </div>
          <div
            className="score-comparison"
            aria-label={
              isEnglish ? "Before and after example" : "수정 전후 예시"
            }
          >
            <div>
              <span>{isEnglish ? "Before" : "수정 전"}</span>
              <strong>61</strong>
            </div>
            <span className="comparison-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <span>{isEnglish ? "After" : "수정 후"}</span>
              <strong>82</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
