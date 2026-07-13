import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "../components/Reveal";

const RADAR_AXIS_COUNT = 5;
const RADAR_CENTER = 100;
const RADAR_RADIUS = 74;
const RADAR_BEFORE = [52, 68, 45, 58, 72];
const RADAR_AFTER = [92, 96, 88, 90, 95];

function radarPoint(index: number, percent: number) {
  const angle = (Math.PI * 2 * index) / RADAR_AXIS_COUNT - Math.PI / 2;
  const radius = (percent / 100) * RADAR_RADIUS;
  return {
    x: RADAR_CENTER + radius * Math.cos(angle),
    y: RADAR_CENTER + radius * Math.sin(angle),
  };
}

function radarPolygon(values: number[]): string {
  return values
    .map((value, index) => {
      const point = radarPoint(index, value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

const RADAR_LABEL_PERCENT = 122;
const RADAR_LABEL_LAYOUT: { anchor: "start" | "middle" | "end"; dy: number }[] = [
  { anchor: "middle", dy: -8 },
  { anchor: "start", dy: 2 },
  { anchor: "start", dy: 16 },
  { anchor: "end", dy: 16 },
  { anchor: "end", dy: 2 },
];

const radarAxisLabels = [
  "검색·봇",
  "초기 HTML",
  "구조화 데이터",
  "답변 근거",
  "추천 근거",
];

const radarAxisLabelsEn = [
  "Bot access",
  "Initial HTML",
  "Structured data",
  "Answer basis",
  "Recommend basis",
];

const diagnosticIcons = [
  <Fragment key="access">
    <circle cx="8.3" cy="8.3" r="5.3" />
    <line x1="12.4" y1="12.4" x2="17" y2="17" />
  </Fragment>,
  <Fragment key="html">
    <path d="M7.5 5.5L3 10l4.5 4.5" />
    <path d="M12.5 5.5L17 10l-4.5 4.5" />
  </Fragment>,
  <Fragment key="structured">
    <rect x="3" y="3" width="8.5" height="8.5" rx="1.4" />
    <rect x="8.5" y="8.5" width="8.5" height="8.5" rx="1.4" />
  </Fragment>,
  <Fragment key="answers">
    <rect x="4.5" y="2.5" width="11" height="15" rx="1.4" />
    <line x1="7.2" y1="7" x2="12.8" y2="7" />
    <line x1="7.2" y1="10.5" x2="12.8" y2="10.5" />
    <line x1="7.2" y1="14" x2="11" y2="14" />
  </Fragment>,
  <path
    key="recommend"
    fill="currentColor"
    stroke="none"
    d="M10 2.2l2.24 4.9 5.26.58-3.92 3.7 1.1 5.24L10 13.98l-4.68 2.64 1.1-5.24-3.92-3.7 5.26-.58L10 2.2z"
  />,
];

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
  ["02", "수정 작업지시", "문제별 요구사항과 완료 판정 기준을 제공합니다."],
  [
    "03",
    "수정 후 사이트 재진단",
    "수정된 운영 URL을 같은 기준으로 다시 진단합니다.",
  ],
  [
    "04",
    "필요시 다음 작업지시서 발행",
    "재진단 후 남은 개선 항목이 있으면 다음 차수 작업지시서를 발행합니다.",
  ],
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
    "Post-update diagnosis",
    "Run the next diagnostic on the updated production URL with the same rules.",
  ],
  [
    "04",
    "Create the next work order if needed",
    "If the next diagnostic finds remaining issues, create the next work order for those items.",
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
    body: "AI 검색에서 자사 사이트가 잘 발견되고 설명되기를 원하는 소상공인, SaaS 운영자, 병원·학원·로컬 매장 운영자, 마케팅 대행사, 웹 개발팀이 사용할 수 있습니다. 신규 사이트 공개 전 AI 친화도 점검, 기존 사이트의 구조화 데이터 보강, 고객 질문에 대한 AI 답변 품질 개선, 수정 전후 비교 진단에 활용할 수 있습니다.",
  },
  {
    title: "요금과 무료·유료 범위",
    body: "간편진단은 계정당 최대 10개 사이트까지 무료로 제공됩니다. 상세 진단 PDF 보고서, 수정 작업지시서, 개선 후 비교 자료는 결제 후 제공됩니다. 결제 금액, 할인 조건, 국내·해외 결제 가능 여부는 요금/결제 안내 화면에서 확인합니다.",
  },
  {
    title: "개인정보와 입력자료 처리",
    body: "사용자가 입력한 사이트명, 대표 URL, 진단 대상 URL, 진단 점수와 주요 발견 사항은 고객지원과 서비스 품질 향상을 위해 저장될 수 있습니다. 원본 HTML은 저장하지 않고 해시와 구조화된 검사 증거를 보관하는 것을 원칙으로 하며, 상세 보고서와 작업지시서 자료는 별도 동의 없이 공개하지 않습니다.",
  },
  {
    title: "고객지원과 문의",
    body: "카카오톡 오픈채팅, 이메일 sohocenter.kr@gmail.com, 전화 070-4513-4093으로 문의할 수 있습니다. 서비스 오류, 결제, 상세 보고서, 작업지시서, 재진단 관련 문의를 지원합니다.",
  },
  {
    title: "차별점과 신뢰 근거",
    body: "Site AI Score는 단순한 점수 표시보다 진단 증거, 수정 요구사항, 완료 판정 기준, 차수별 재진단 흐름을 함께 제공합니다. 기술 준비 50점과 AI 답변 준비 콘텐츠 50점을 나누어 보면서도, 작업지시서에서는 초기 HTML과 구조화 데이터 같은 기술 게이트를 우선 처리하도록 안내합니다.",
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
    body: "Simple diagnostics are free for up to 10 websites per account. Detailed diagnostic PDF reports, improvement work orders, and before-and-after comparison materials are provided after payment. Final pricing, discounts, and available payment methods are shown on the pricing page.",
  },
  {
    title: "Privacy and submitted data",
    body: "Site names, URLs, diagnostic scores, and major findings may be stored for customer support and service quality improvement. Raw HTML is not stored; hashes and structured evidence are retained. Detailed reports and work orders are not publicly disclosed without separate consent.",
  },
  {
    title: "Support and contact",
    body: "Contact us through KakaoTalk open chat, email at sohocenter.kr@gmail.com, or phone at 070-4513-4093. We support questions about service errors, payments, detailed reports, work orders, and rechecks.",
  },
  {
    title: "Differentiation and proof",
    body: "Site AI Score connects diagnostic evidence, work-order requirements, completion criteria, and rechecks. The score separates technical readiness and AI answer-readiness, while the work order prioritizes technical gates such as initial HTML and structured data.",
  },
];

const usageScenarios = [
  {
    title: "바이브코딩으로 사이트를 만드는 경우",
    body: "작업지시서 PDF 파일을 AI에게 주시고, 작업지시서에 따라 사이트를 수정해 달라고 요청하세요.",
  },
  {
    title: "사이트 제작회사에 외주로 제작하는 경우",
    body: "작업지시서 PDF 파일을 외주회사에 전달하고 견적을 받으세요. 이 작업지시서 없이 그냥 제작을 의뢰하는 경우와 제작 비용에 큰 차이가 있을 수 있습니다.",
  },
];

const usageScenariosEn = [
  {
    title: "Building your site with AI (“vibe coding”)",
    body: "Give the work order PDF to your AI coding assistant and ask it to update the site according to the work order.",
  },
  {
    title: "Outsourcing to a web development agency",
    body: "Share the work order PDF with the agency and request a quote. Costs can differ significantly compared to requesting work without this work order.",
  },
];

const faqItems = [
  [
    "Site AI Score는 무엇을 진단하나요?",
    "공개 URL의 AI 봇 접근성, 초기 HTML 본문, H1과 내부 링크, 구조화 데이터, 요금·고객지원·개인정보 같은 AI 답변 준비 콘텐츠를 함께 진단합니다.",
  ],
  [
    "무료 간편진단과 유료 산출물의 차이는 무엇인가요?",
    "무료 간편진단은 점수와 개선 필요 항목 개수 요약을 제공합니다. 상세 진단 PDF 보고서와 수정 작업지시서는 결제 후 제공됩니다.",
  ],
  [
    "수정 작업지시서에는 무엇이 포함되나요?",
    "기술 설정, 초기 HTML, canonical, JSON-LD, 콘텐츠 보강 등을 개발자가 바로 사이트를 개선할 수 있도록 일목요연하게 정리하여 제공합니다.",
  ],
  [
    "SearchAction이 없으면 AI 인식에 불리한가요?",
    "SearchAction은 실제 내부 검색 기능이 있는 사이트에서 검색 진입점을 설명하는 보조 신호입니다. 상품·문서가 많은 사이트에는 도움이 될 수 있지만, 내부 검색 기능이 없는 랜딩페이지나 허브 사이트에는 허위로 추가하지 않는 것이 맞습니다.",
  ],
  [
    "입력한 사이트 정보와 진단 결과는 어떻게 처리되나요?",
    "사이트명, URL, 진단 점수와 주요 발견 사항은 고객지원과 서비스 품질 향상을 위해 저장될 수 있습니다. 상세 보고서와 작업지시서 자료는 별도 동의 없이 공개하지 않습니다.",
  ],
  [
    "환불이나 취소는 가능한가요?",
    "상세 보고서나 작업지시서 등 디지털 산출물이 생성되거나 접근 권한이 열린 뒤에는 환불이 제한될 수 있습니다. 자세한 기준은 결제 화면과 이용약관에서 확인합니다.",
  ],
  [
    "모바일에서도 사용할 수 있나요?",
    "네. Site AI Score는 모바일에서도 사이트 등록, 진단 결과 확인, 작업지시서 확인 등 주요 기능을 사용할 수 있도록 구성되어 있습니다.",
  ],
];

const faqItemsEn = [
  [
    "What does Site AI Score diagnose?",
    "It diagnoses AI bot access, initial HTML body text, H1 and internal links, structured data, and answer-readiness content such as pricing, support, and privacy information.",
  ],
  [
    "What is the difference between the free scan and paid deliverables?",
    "The free scan shows the score and a summary count of improvement items. Detailed PDF reports and improvement work orders are provided after payment.",
  ],
  [
    "What is included in an improvement work order?",
    "It clearly organizes technical settings, initial HTML, canonical URLs, JSON-LD, and content improvements so developers can improve the site right away.",
  ],
  [
    "Does missing SearchAction hurt AI recognition?",
    "SearchAction is a supporting signal for sites that have a real internal search feature. It can help content-heavy product or documentation sites, but landing pages and hub sites without internal search should not add a fake SearchAction.",
  ],
  [
    "How is submitted site data handled?",
    "Site names, URLs, scores, and key findings may be stored for customer support and service quality improvement. Detailed reports and work orders are not publicly disclosed without separate consent.",
  ],
  [
    "Are refunds or cancellations available?",
    "Refunds may be limited after digital deliverables such as detailed reports or work orders are generated or access has been granted. Please review the checkout page and Terms for details.",
  ],
  [
    "Can I use it on mobile?",
    "Yes. Site AI Score is designed so key features such as website registration, result review, and work order review can be used on mobile.",
  ],
];

export function HomePage() {
  const { locale = "ko" } = useParams();
  const isEnglish = locale === "en";
  const activeLocale = isEnglish ? "en" : "ko";
  const activeSteps = isEnglish ? serviceStepsEn : serviceSteps;
  const activeDiagnosticAreas = isEnglish ? diagnosticAreasEn : diagnosticAreas;
  const activeRadarLabels = isEnglish ? radarAxisLabelsEn : radarAxisLabels;
  const activeDetailSections = isEnglish
    ? serviceDetailSectionsEn
    : serviceDetailSections;
  const activeUsageScenarios = isEnglish ? usageScenariosEn : usageScenarios;
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
          ? "Simple diagnostics are free for up to 10 websites per account. Detailed reports and improvement work orders are provided after payment."
          : "간편진단은 계정당 최대 10개 사이트까지 무료로 제공되며, 상세 보고서와 수정 작업지시서는 결제 후 제공됩니다.",
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
        <div className="content-container hero-grid">
          <div className="hero-content">
            <p className="eyebrow">AEO WEBSITE DIAGNOSTICS</p>
            <h1>
              {isEnglish
                ? "See how well AI can understand your website."
                : "내 사이트를 AI가 얼마나 잘 이해하는지 확인하세요."}
            </h1>
            <p className="hero-description">
              {isEnglish
                ? "Run a public URL diagnostic, turn issues into a clear improvement work order, and start the next diagnostic after the updated site is deployed. If issues remain, create the next work order from that diagnostic report."
                : "공개 URL의 기술 준비 상태와 AI가 고객 질문에 답하기 위한 핵심 콘텐츠 부족 항목을 함께 진단합니다. 수정할 내용을 작업지시서로 정리하고, 배포 후 같은 기준으로 다음 차수 진단을 진행합니다. 남은 항목이 있으면 다음 작업지시서를 발행할 수 있습니다."}
            </p>
            <div className="hero-actions">
              <Link className="primary-action" to={`/${activeLocale}/sites`}>
                {isEnglish ? "Start diagnosis" : "사이트 진단"}
              </Link>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-score-card">
              <div className="hero-score-card-header">
                <span>
                  {isEnglish ? "AI Readiness Score" : "AI 진단 결과"}
                </span>
                <strong>91</strong>
                <em>+30</em>
              </div>
              <svg className="hero-radar" viewBox="-60 -25 320 280">
                <polygon
                  points={radarPolygon([100, 100, 100, 100, 100])}
                  className="hero-radar-ring"
                />
                <polygon
                  points={radarPolygon([66, 66, 66, 66, 66])}
                  className="hero-radar-ring"
                />
                <polygon
                  points={radarPolygon([33, 33, 33, 33, 33])}
                  className="hero-radar-ring"
                />
                {Array.from({ length: RADAR_AXIS_COUNT }).map((_, index) => {
                  const point = radarPoint(index, 100);
                  return (
                    <line
                      key={index}
                      x1={RADAR_CENTER}
                      y1={RADAR_CENTER}
                      x2={point.x}
                      y2={point.y}
                      className="hero-radar-axis"
                    />
                  );
                })}
                <polygon
                  points={radarPolygon(RADAR_BEFORE)}
                  className="hero-radar-before"
                />
                <polygon
                  points={radarPolygon(RADAR_AFTER)}
                  className="hero-radar-after"
                />
                {RADAR_AFTER.map((value, index) => {
                  const point = radarPoint(index, value);
                  return (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r={3.4}
                      className="hero-radar-dot"
                    />
                  );
                })}
                {activeRadarLabels.map((label, index) => {
                  const point = radarPoint(index, RADAR_LABEL_PERCENT);
                  const layout = RADAR_LABEL_LAYOUT[index];
                  return (
                    <text
                      key={label}
                      x={point.x}
                      y={point.y}
                      dy={layout.dy}
                      textAnchor={layout.anchor}
                      className="hero-radar-label"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
              <div className="hero-score-legend">
                <span>{isEnglish ? "Before 61" : "수정 전 61"}</span>
                <span>{isEnglish ? "After 91" : "수정 후 91"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="full-bleed-section section-muted">
          <div className="content-container section-content">
            <div className="section-heading">
              <p className="eyebrow">HOW IT WORKS</p>
              <h2>
                {isEnglish
                  ? "From diagnosis to site improvement and re-diagnosis"
                  : "사이트 진단부터 수정 작업지시서와 재진단까지"}
              </h2>
            </div>
            <div className="process-grid">
              {activeSteps.map(([number, title, description], index) => (
                <Fragment key={number}>
                  <article className="surface step-item process-step">
                    <span className="step-number">{number}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                  {index < activeSteps.length - 1 ? (
                    <span className="process-connector" aria-hidden="true" />
                  ) : null}
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
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
              {activeDiagnosticAreas.map((area, index) => (
                <li key={area}>
                  <span aria-hidden="true">
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {diagnosticIcons[index]}
                    </svg>
                  </span>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      <Reveal>
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
              <Link
                className="secondary-action action-privacy"
                to={`/${activeLocale}/privacy`}
              >
                <span aria-hidden="true">🔒</span>
                {isEnglish ? "Privacy Policy" : "개인정보처리방침"}
              </Link>
              <Link
                className="secondary-action action-terms"
                to={`/${activeLocale}/terms`}
              >
                <span aria-hidden="true">📄</span>
                {isEnglish ? "Terms" : "이용약관"}
              </Link>
              <Link
                className="secondary-action action-pricing"
                to={`/${activeLocale}/checkout`}
              >
                <span aria-hidden="true">💳</span>
                {isEnglish ? "Pricing / Payment" : "요금/결제 안내"}
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="full-bleed-section">
          <div className="content-container section-content">
            <div className="section-heading">
              <p className="eyebrow">HOW TO USE</p>
              <h2>
                {isEnglish
                  ? "Here's how to use it"
                  : "이렇게 활용하세요"}
              </h2>
            </div>
            <div className="step-grid usage-grid">
              {activeUsageScenarios.map((scenario) => (
                <article className="surface step-item" key={scenario.title}>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
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
              <Link
                className="secondary-action action-faq"
                to={`/${activeLocale}/faq`}
              >
                <span aria-hidden="true">❓</span>
                {isEnglish ? "View full FAQ" : "FAQ 전체 보기"}
              </Link>
              <a
                className="secondary-action action-kakao"
                href="https://open.kakao.com/me/sohocenter"
                target="_blank"
                rel="noreferrer"
              >
                <span aria-hidden="true">💬</span>
                {isEnglish ? "KakaoTalk contact" : "카카오톡 문의"}
              </a>
              <a
                className="secondary-action action-email"
                href="mailto:sohocenter.kr@gmail.com"
              >
                <span aria-hidden="true">✉️</span>
                {isEnglish ? "Email contact" : "이메일 문의"}
              </a>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
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
                <strong>91</strong>
              </div>
            </div>
          </div>
        </section>
      </Reveal>
    </>
  );
}
