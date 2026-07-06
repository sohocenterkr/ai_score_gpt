import { Link, useParams } from "react-router-dom";

const diagnosticAreas = [
  "검색·AI 봇 접근 가능 여부",
  "초기 HTML 핵심정보 포함 여부",
  "구조화 데이터와 화면 정보 일치",
  "예상 고객 질문의 답변 가능성",
];

const serviceSteps = [
  ["01", "사이트 진단", "공개 URL을 기준으로 AI가 읽을 수 있는 내용을 검사합니다."],
  ["02", "수정 작업지시", "문제별 요구사항과 자동검수 완료 기준을 제공합니다."],
  ["03", "배포 결과 검수", "수정된 운영 URL을 같은 규칙으로 다시 검사합니다."],
];

const serviceStepsEn = [
  ["01", "Website diagnosis", "Check what AI can read from a public URL."],
  ["02", "Improvement work order", "Get issue-specific requirements and completion criteria."],
  ["03", "Deployment recheck", "Recheck the updated production URL with the same rules."],
];

const diagnosticAreasEn = [
  "Search and AI bot accessibility",
  "Key information in the initial HTML",
  "Consistency between structured data and visible content",
  "Answerability for expected customer questions",
];

export function HomePage() {
  const { locale = "ko" } = useParams();
  const isEnglish = locale === "en";
  const activeLocale = isEnglish ? "en" : "ko";
  const activeSteps = isEnglish ? serviceStepsEn : serviceSteps;
  const activeDiagnosticAreas = isEnglish ? diagnosticAreasEn : diagnosticAreas;

  const homeJsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: isEnglish ? "SOHO Center" : "소호센터",
      alternateName: "SOHO Center",
      url: `https://siteaiscore.com/${activeLocale}`,
      logo: "https://siteaiscore.com/favicon.ico",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+82-70-4513-4093",
        contactType: "customer support",
        availableLanguage: isEnglish ? ["en", "ko"] : ["ko"],
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressRegion: isEnglish ? "Seoul" : "서울특별시",
        addressLocality: isEnglish ? "Gangdong-gu" : "강동구",
        streetAddress: isEnglish ? "202, 1522-10 Yangjae-daero, Gil-dong" : "양재대로 1522-10, 202호(길동)",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Site AI Score",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `https://siteaiscore.com/${activeLocale}`,
      description: isEnglish
        ? "Site AI Score is a web application that diagnoses AI search readiness, search engine accessibility, structured data, initial HTML content, and improvement direction."
        : "Site AI Score는 웹사이트의 AI 검색 친화도, 검색엔진 접근성, 구조화 데이터, 초기 HTML 콘텐츠, 개선 방향을 진단하는 웹 애플리케이션입니다.",
      provider: {
        "@type": "Organization",
        name: isEnglish ? "SOHO Center" : "소호센터",
        url: `https://siteaiscore.com/${activeLocale}`,
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
          <h1>{isEnglish ? "See how well AI can understand your website." : "내 사이트를 AI가 얼마나 잘 이해하는지 확인하세요."}</h1>
          <p className="hero-description">
            {isEnglish ? "Run a public URL diagnostic, turn issues into a clear improvement work order, and recheck the updated site with the same criteria." : "공개 URL을 진단하고, 무엇을 고쳐야 하는지 작업지시서로 정리하며, 수정 후에는 같은 기준으로 개선 결과를 다시 측정합니다."}
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
            <h2>{isEnglish ? "From diagnosis to improvement verification in one flow" : "진단부터 수정 검수까지 한 흐름으로"}</h2>
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
            <h2>{isEnglish ? "Core areas AI needs to read and understand your site" : "AI가 사이트를 읽고 이해하는 데 필요한 핵심 영역"}</h2>
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

      <section className="full-bleed-section section-dark">
        <div className="content-container section-content compare-section">
          <div>
            <p className="eyebrow eyebrow-light">BEFORE &amp; AFTER</p>
            <h2>{isEnglish ? "We show not only the score, but why it changed." : "점수만 보여주지 않고, 왜 달라졌는지 증명합니다."}</h2>
          </div>
          <div className="score-comparison" aria-label={isEnglish ? "Before and after example" : "수정 전후 예시"}>
            <div>
              <span>{isEnglish ? "Before" : "수정 전"}</span>
              <strong>61</strong>
            </div>
            <span className="comparison-arrow" aria-hidden="true">→</span>
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
