const fs = require("node:fs");
const path = require("node:path");

const distDir = path.resolve("dist/public");
const sourceIndexPath = path.join(distDir, "index.html");

if (!fs.existsSync(sourceIndexPath)) {
  throw new Error(`index.html not found: ${sourceIndexPath}`);
}

const sourceHtml = fs.readFileSync(sourceIndexPath, "utf8");

const siteOrigin = "https://siteaiscore.com";
const officialContactUrl = "https://open.kakao.com/me/sohocenter";
const supportEmail = "sohocenter.kr@gmail.com";
const supportPhone = "+82-70-4513-4093";

const organizationJsonLd = {
  "@type": "Organization",
  "@id": `${siteOrigin}/#organization`,
  name: "소호센터",
  alternateName: "SOHO Center",
  url: `${siteOrigin}/ko`,
  logo: `${siteOrigin}/favicon.ico`,
  email: supportEmail,
  telephone: supportPhone,
  sameAs: [officialContactUrl],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: supportPhone,
      email: supportEmail,
      url: officialContactUrl,
      availableLanguage: ["ko", "en"],
    },
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressRegion: "서울특별시",
    addressLocality: "강동구",
    streetAddress: "양재대로 1522-10, 202호(길동)",
  },
};

const webSiteJsonLd = {
  "@type": "WebSite",
  "@id": `${siteOrigin}/#website`,
  name: "Site AI Score",
  url: `${siteOrigin}/ko`,
  inLanguage: "ko-KR",
  publisher: {
    "@id": `${siteOrigin}/#organization`,
  },
};

const webApplicationJsonLd = {
  "@type": "WebApplication",
  "@id": `${siteOrigin}/#webapplication`,
  name: "Site AI Score",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${siteOrigin}/ko`,
  description:
    "Site AI Score는 공개 URL의 AI 검색 접근성, 초기 HTML, 구조화 데이터, 핵심 콘텐츠, 상세 진단 보고서와 수정 작업지시서를 제공하는 AEO 진단 웹 애플리케이션입니다.",
  provider: {
    "@id": `${siteOrigin}/#organization`,
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
    price: "100",
    availability: "https://schema.org/PreOrder",
    description:
      "간편진단은 무료로 제공되며, 상세 진단 PDF 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다.",
  },
};

const homeFaqItems = [
  [
    "Site AI Score는 무엇을 진단하나요?",
    "공개 URL의 AI 봇 접근성, 초기 HTML 본문, H1과 내부 링크, 구조화 데이터, 요금·고객지원·개인정보 같은 AI 답변 준비 콘텐츠를 함께 진단합니다.",
  ],
  [
    "무료 간편진단과 유료 산출물의 차이는 무엇인가요?",
    "무료 간편진단은 점수와 개선 필요 항목 개수 요약을 제공합니다. 상세 진단 PDF 보고서와 수정 작업지시서는 결제 후 제공되는 유료 산출물입니다.",
  ],
  [
    "수정 작업지시서는 무엇을 제공하나요?",
    "기술 설정, 초기 HTML, canonical, JSON-LD, 콘텐츠 보강, 개인정보와 문의 정책, 재검수 완료 기준을 개발자가 실행하기 쉬운 작업 항목으로 정리합니다.",
  ],
];

const homeFaqJsonLd = {
  "@type": "FAQPage",
  "@id": `${siteOrigin}/#faq`,
  mainEntity: homeFaqItems.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

const homePageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationJsonLd,
    webSiteJsonLd,
    webApplicationJsonLd,
    homeFaqJsonLd,
  ],
};

const faqItems = [
  [
    "이 사이트는 어떤 서비스인가요?",
    "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해될 수 있는지 진단하고, 개선 방향을 제안하는 서비스입니다.",
  ],
  [
    "누구를 위한 서비스인가요?",
    "자영업자, 스타트업, 기업 홈페이지 운영자, 마케팅 담당자, 웹 제작사처럼 사이트의 AI 검색 친화도를 개선하려는 사용자를 위한 서비스입니다.",
  ],
  [
    "처음 이용하려면 어떻게 해야 하나요?",
    "회원가입 후 사이트명과 대표 URL을 등록하고 간편진단을 실행하면 됩니다.",
  ],
  [
    "회원가입이 필요한가요?",
    "진단 이력 관리와 결과 확인을 위해 회원가입이 필요합니다. 이메일 또는 Google 계정으로 가입할 수 있습니다.",
  ],
  [
    "무료로 이용할 수 있나요?",
    "간편진단 실행은 무료로 제공됩니다. 계정당 무료 진단 개수에는 제한이 있을 수 있으며, 이미 진단한 사이트는 정책에 따라 재진단할 수 있습니다.",
  ],
  [
    "유료 요금제는 어떻게 되나요?",
    "상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다. 최종 가격, 할인 조건, 결제 가능 여부는 요금/결제 안내에서 확인합니다.",
  ],
  [
    "결제는 어떤 방식으로 가능한가요?",
    "결제 가능 국가, 결제 수단, 국내·해외 결제 지원 여부는 요금/결제 안내 화면에서 확인할 수 있습니다.",
  ],
  [
    "환불이나 취소는 가능한가요?",
    "결제 기능과 디지털 산출물 제공 범위에 따라 환불·취소 기준이 달라질 수 있으므로 요금/결제 안내와 이용약관을 함께 확인해야 합니다.",
  ],
  [
    "모바일에서도 사용할 수 있나요?",
    "네. Site AI Score는 모바일에서도 사용할 수 있도록 구성되어 있습니다.",
  ],
  [
    "비밀번호를 잊어버리면 어떻게 하나요?",
    "로그인 화면의 비밀번호 재설정 기능을 이용해 등록한 이메일로 재설정 링크를 받을 수 있습니다.",
  ],
  [
    "개인정보는 안전하게 보호되나요?",
    "서비스 제공에 필요한 정보만 처리하며, 비밀번호는 해시 형태로 저장됩니다. 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.",
  ],
  [
    "입력한 데이터는 저장되나요?",
    "사이트명, URL, 진단 결과 점수와 주요 증거는 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 자세한 기준은 개인정보처리방침에서 확인합니다.",
  ],
  [
    "오류가 발생하면 어떻게 하나요?",
    "오류 화면이 표시되거나 진단이 실패하면 문의 연락처로 상황을 알려 주세요. 확인 후 필요한 지원을 제공합니다.",
  ],
  [
    "문의는 어디로 하면 되나요?",
    "카카오톡 오픈채팅 https://open.kakao.com/me/sohocenter 또는 이메일 sohocenter.kr@gmail.com 으로 문의할 수 있습니다.",
  ],
  [
    "이용약관과 개인정보처리방침은 어디에서 확인하나요?",
    "사이트 하단 Footer의 이용약관과 개인정보처리방침 링크에서 확인할 수 있습니다.",
  ],
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

const englishOrganizationJsonLd = {
  "@type": "Organization",
  "@id": `${siteOrigin}/#organization`,
  name: "SOHO Center",
  alternateName: "소호센터",
  url: `${siteOrigin}/en`,
  logo: `${siteOrigin}/favicon.ico`,
  email: supportEmail,
  telephone: supportPhone,
  sameAs: [officialContactUrl],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: supportPhone,
      email: supportEmail,
      url: officialContactUrl,
      availableLanguage: ["en", "ko"],
    },
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressRegion: "Seoul",
    addressLocality: "Gangdong-gu",
    streetAddress: "Room 202, 1522-10 Yangjae-daero, Gangdong-gu",
  },
};

const englishWebSiteJsonLd = {
  "@type": "WebSite",
  "@id": `${siteOrigin}/#website`,
  name: "Site AI Score",
  url: `${siteOrigin}/en`,
  inLanguage: "en",
  publisher: { "@id": `${siteOrigin}/#organization` },
};

const englishWebApplicationJsonLd = {
  "@type": "WebApplication",
  "@id": `${siteOrigin}/#webapplication`,
  name: "Site AI Score",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${siteOrigin}/en`,
  description:
    "Site AI Score is an AEO diagnostic web application that checks public URLs for AI search accessibility, initial HTML, structured data, core content, detailed diagnostic PDF reports, and improvement work orders.",
  provider: { "@id": `${siteOrigin}/#organization` },
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
    price: "100",
    availability: "https://schema.org/PreOrder",
    description:
      "Simple diagnostics may be provided for free, while detailed diagnostic PDF reports and improvement work orders may be paid deliverables.",
  },
};

const englishHomeFaqItems = [
  [
    "What does Site AI Score diagnose?",
    "It checks AI bot accessibility, initial HTML body content, H1 and internal links, structured data, and content that helps AI answer questions about pricing, support, privacy, and service scope.",
  ],
  [
    "What is the difference between the free diagnostic and paid deliverables?",
    "The free simple diagnostic provides a score and a summary count of improvement items. Detailed diagnostic PDF reports and improvement work orders are paid deliverables provided after payment.",
  ],
  [
    "What does an improvement work order include?",
    "It organizes technical settings, initial HTML, canonical URLs, JSON-LD, content improvements, privacy and contact policies, and recheck acceptance criteria into developer-ready tasks.",
  ],
];

const englishHomePageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    englishOrganizationJsonLd,
    englishWebSiteJsonLd,
    englishWebApplicationJsonLd,
    {
      "@type": "FAQPage",
      "@id": `${siteOrigin}/en#faq`,
      mainEntity: englishHomeFaqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

const englishFaqItems = [
  [
    "What is Site AI Score?",
    "Site AI Score diagnoses whether a website can be understood by AI search systems and search engines, and provides improvement guidance and work orders.",
  ],
  [
    "Who is this service for?",
    "It is for small business owners, startups, company website operators, marketers, and web agencies that want to improve a site's AI search readiness.",
  ],
  [
    "How do I get started?",
    "Create an account, register a website name and main URL, and run a simple diagnostic. You can sign up with an email address or a Google account.",
  ],
  [
    "Can I use it for free?",
    "Free simple diagnostics are available for up to 10 websites per account. If you need to diagnose more than 10 websites, please contact us separately.",
  ],
  [
    "Can I sign in with Google?",
    "Yes. You can sign up or sign in with a Google account. If an account with the same email already exists, the service may link the account based on the email address to preserve service history.",
  ],
  [
    "What are the paid prices?",
    "Detailed diagnostic PDF reports and improvement work orders are paid digital deliverables. The standard international price is USD 100. A USD 70 case study discount may be selected when you agree to limited public sharing of before-and-after comparison results.",
  ],
  [
    "How can I pay?",
    "International USD payments are supported through Polar. Domestic payments may be offered through domestic payment services such as PortOne. Available payment methods are shown on the checkout page.",
  ],
  [
    "What is publicly shared with the case study discount?",
    "The case study discount includes consent to publicly share limited before-and-after comparison results, such as the initial score and improved score. Full reports, work orders, detailed issue lists, source evidence, scan data, and internal analysis materials are not publicly disclosed and are used internally for service improvement and quality enhancement.",
  ],
  [
    "Are refunds available?",
    "Because the deliverables are digital, refunds may be limited once materials have been generated or access has been granted. Refund eligibility follows the checkout page, payment provider policy, and separate notices.",
  ],
  [
    "Can I use it on mobile?",
    "Yes. Site AI Score is designed to be usable on mobile devices.",
  ],
  [
    "What if I forget my password?",
    "Use the password reset feature on the login page to receive a reset link by email. If you signed up with Google, you can use Google sign-in or set a password based on your email account flow.",
  ],
  [
    "Is my personal information protected?",
    "We process only the information necessary to provide the service. Passwords are stored as hashes. Payment method details are processed by the payment provider, and Site AI Score does not store card numbers. Please see the Privacy Policy for details.",
  ],
  [
    "Is my submitted data stored?",
    "Website names, URLs, diagnostic scores, and key findings may be stored to provide the service and maintain user history. Detailed reports and work order materials are not publicly disclosed without separate consent and are used internally for service improvement and quality enhancement.",
  ],
  [
    "What should I do if an error occurs?",
    "If you see an error screen or a diagnostic fails, contact us with the situation. We will review it and provide support as needed.",
  ],
  [
    "How can I contact you?",
    "You can contact us through KakaoTalk open chat at https://open.kakao.com/me/sohocenter or by email at sohocenter.kr@gmail.com.",
  ],
];

const englishFaqJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    englishOrganizationJsonLd,
    englishWebSiteJsonLd,
    {
      "@type": "FAQPage",
      "@id": `${siteOrigin}/en/faq#faq`,
      mainEntity: englishFaqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

function renderEnglishFallback(title, lead, sections) {
  return `      <main class="static-fallback" lang="en">
        <section>
          <p>AEO WEB QUALITY VERIFICATION</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(lead)}</p>
          <p>
            <a href="/en/sites">Start diagnosis</a> ·
            <a href="/en/checkout">Pricing / Payment</a> ·
            <a href="/en/guide">User Guide</a>
          </p>
        </section>
${sections
  .map(
    (section) => `        <section>
          <h2>${escapeHtml(section.heading)}</h2>
${section.paragraphs.map((paragraph) => `          <p>${escapeHtml(paragraph)}</p>`).join("\n")}
        </section>`,
  )
  .join("\n")}
      </main>`;
}

const englishPages = [
  {
    path: "/en",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "Site AI Score | AI Search Readiness Diagnostic",
    description:
      "Site AI Score checks AI search accessibility, initial HTML, structured data, core content, improvement work orders, and rechecks in one AEO diagnostic flow.",
    fallbackHtml: renderEnglishFallback(
      "Check how well AI understands your website.",
      "Site AI Score is an AEO diagnostic service that checks public URLs for AI search accessibility, initial HTML body content, H1 and internal links, canonical URLs, structured data, and missing content that AI systems need to answer customer questions.",
      [
        {
          heading: "What the service provides",
          paragraphs: [
            "Site AI Score checks whether AI systems can access, understand, answer, and recommend a website. It reviews AI bot accessibility, initial HTML, structured data consistency, pricing, refund, support, privacy, differentiators, and use cases.",
          ],
        },
        {
          heading: "Process and deliverables",
          paragraphs: [
            "Register a public URL, run a free simple diagnostic, review the current score, and use detailed PDF reports and improvement work orders to confirm issue evidence and completion criteria.",
          ],
        },
        {
          heading: "Pricing and data handling",
          paragraphs: [
            "Simple diagnostics may be free within account limits. Detailed diagnostic PDF reports, improvement work orders, and post-improvement comparison materials may be paid deliverables.",
          ],
        },
      ],
    ),
    jsonLd: [englishHomePageJsonLd],
  },
  {
    path: "/en/guide",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "User Guide | Site AI Score",
    description:
      "Learn how to sign up, register a website, run a free simple diagnostic, review results, purchase paid reports, and re-diagnose after improvements.",
    fallbackHtml: renderEnglishFallback(
      "User Guide",
      "Learn how to use Site AI Score, from account creation and website registration to diagnostics, paid deliverables, payment, and rechecks.",
      [
        {
          heading: "1. Create an account",
          paragraphs: [
            "Sign up with an email address or a Google account. Email sign-up requires email verification, while Google sign-in uses Google's authentication flow.",
          ],
        },
        {
          heading: "2. Register a website",
          paragraphs: [
            "Enter the website name and main URL you want to diagnose. A publicly accessible production URL is recommended.",
          ],
        },
        {
          heading: "3. Run diagnostics and review results",
          paragraphs: [
            "The simple diagnostic checks AI search readiness, structured data, initial HTML content, accessibility, and link structure. After improvements, run another diagnostic and compare score changes.",
          ],
        },
      ],
    ),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [englishOrganizationJsonLd, englishWebSiteJsonLd],
      },
    ],
  },
  {
    path: "/en/faq",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "FAQ | Site AI Score",
    description:
      "Find answers about free usage, Google sign-in, paid deliverables, Polar payments, data use, privacy, and support.",
    fallbackHtml: renderEnglishFallback(
      "Frequently Asked Questions",
      "Answers about free usage, Google sign-in, paid deliverables, payments, data use, privacy, and support.",
      englishFaqItems.map(([question, answer]) => ({
        heading: question,
        paragraphs: [answer],
      })),
    ),
    jsonLd: [englishFaqJsonLd],
  },
  {
    path: "/en/checkout",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "Pricing and Payment | Site AI Score",
    description:
      "Pricing and payment guide for Site AI Score detailed diagnostic PDF reports, improvement work orders, case study discounts, and Polar payments.",
    fallbackHtml: renderEnglishFallback(
      "Pricing and Payment",
      "The free simple diagnostic provides the core score and examples of key issues. Detailed diagnostic PDF reports and improvement work orders are paid digital deliverables.",
      [
        {
          heading: "Paid deliverables",
          paragraphs: [
            "Paid deliverables may include a detailed diagnostic PDF report, an improvement work order, post-improvement recheck comparison, and additional content suggestions for AI answers.",
          ],
        },
        {
          heading: "Case study discount",
          paragraphs: [
            "The case study discount may be selected when you agree to limited public sharing of before-and-after comparison results such as the initial score and improved score. Full reports and work orders are not publicly disclosed.",
          ],
        },
      ],
    ),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [
          englishOrganizationJsonLd,
          englishWebSiteJsonLd,
          englishWebApplicationJsonLd,
        ],
      },
    ],
  },
  {
    path: "/en/terms",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "Terms of Service | Site AI Score",
    description:
      "Terms for using Site AI Score, including free usage, paid deliverables, case study data use, prohibited conduct, and disclaimers.",
    fallbackHtml: renderEnglishFallback(
      "Terms of Service",
      "Terms for using Site AI Score, including free usage, paid deliverables, data use, prohibited conduct, and disclaimers.",
      [
        {
          heading: "Service description",
          paragraphs: [
            "Site AI Score analyzes a website's AI search readiness, search engine accessibility, structured data, content clarity, and diagnostic results, and provides improvement guidance.",
          ],
        },
        {
          heading: "Disclaimer",
          paragraphs: [
            "Diagnostics are reference materials for website improvement. They do not guarantee search exposure, AI citations, ranking improvements, traffic growth, revenue, or advertising performance.",
          ],
        },
      ],
    ),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [englishOrganizationJsonLd, englishWebSiteJsonLd],
      },
    ],
  },
  {
    path: "/en/privacy",
    htmlLang: "en",
    ogLocale: "en_US",
    title: "Privacy Policy | Site AI Score",
    description:
      "How Site AI Score processes account information, Google sign-in data, payment records, diagnostic data, retention, and deletion.",
    fallbackHtml: renderEnglishFallback(
      "Privacy Policy",
      "How Site AI Score processes account information, diagnostic data, payment records, retention, and deletion.",
      [
        {
          heading: "Input data and diagnostic data",
          paragraphs: [
            "Website names, URLs, diagnostic scores, key findings, and report or work order data may be stored to provide the service and maintain user history.",
          ],
        },
        {
          heading: "Public disclosure",
          paragraphs: [
            "Detailed reports, improvement work orders, detailed issue lists, source evidence, scan data, and internal analysis materials are not publicly disclosed without separate consent.",
          ],
        },
      ],
    ),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [englishOrganizationJsonLd, englishWebSiteJsonLd],
      },
    ],
  },
];

const pages = [
  {
    path: "/ko",
    title: "Site AI Score | AI 검색 친화도 진단",
    description:
      "Site AI Score는 웹사이트의 AI 검색 접근성, 초기 HTML, 구조화 데이터, 핵심 콘텐츠, 수정 작업지시서와 재검수까지 한 흐름으로 점검하는 AEO 진단 서비스입니다.",
    jsonLd: [homePageJsonLd],
  },
  {
    path: "/ko/guide",
    title: "이용가이드 | Site AI Score",
    description:
      "Site AI Score 회원가입, 사이트 등록, 무료 간편진단, 유료 보고서, 결제, 개선 후 재진단 방법을 안내합니다.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [organizationJsonLd, webSiteJsonLd],
      },
    ],
  },
  {
    path: "/ko/faq",
    title: "자주 묻는 질문 | Site AI Score",
    description:
      "Site AI Score의 무료 이용 범위, Google 로그인, 유료 산출물, Polar 결제, 자료 이용 범위, 문의 방법을 확인하세요.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [organizationJsonLd, webSiteJsonLd, faqJsonLd],
      },
    ],
  },
  {
    path: "/ko/checkout",
    title: "요금/결제 안내 | Site AI Score",
    description:
      "Site AI Score의 상세 진단 PDF 보고서, 수정 작업지시서, 사례 할인 상품, Polar 해외 결제와 요금 안내입니다.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [organizationJsonLd, webSiteJsonLd, webApplicationJsonLd],
      },
    ],
  },
  {
    path: "/ko/terms",
    title: "이용약관 | Site AI Score",
    description:
      "Site AI Score 서비스 이용 조건, 무료 이용 범위, 유료 산출물, 사례 할인 자료 이용, 금지 행위, 면책 사항을 안내합니다.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [organizationJsonLd, webSiteJsonLd],
      },
    ],
  },
  {
    path: "/ko/privacy",
    title: "개인정보처리방침 | Site AI Score",
    description:
      "Site AI Score의 개인정보 처리 목적, Google 로그인, 결제 정보, 진단 데이터, 보관 및 삭제 기준을 안내합니다.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [organizationJsonLd, webSiteJsonLd],
      },
    ],
  },
  ...englishPages,
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function removeExistingHeadTags(html) {
  return html
    .replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, "\n")
    .replace(/\s*<link\s+rel="alternate"[^>]*>\s*/gi, "\n")
    .replace(
      /\s*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi,
      "\n",
    );
}

function upsertTitle(html, title) {
  return html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
}

function upsertMetaName(html, name, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(
    `<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`,
    "i",
  );
  const tag = `<meta name="${name}" content="${escaped}" />`;

  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

function upsertMetaProperty(html, property, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(
    `<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`,
    "i",
  );
  const tag = `<meta property="${property}" content="${escaped}" />`;

  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

function pagePathForLocale(page, locale) {
  const suffix = page.path.replace(/^\/(ko|en)/, "");
  return `/${locale}${suffix}`;
}

function renderAlternateLinks(page) {
  const koUrl = `${siteOrigin}${pagePathForLocale(page, "ko")}`;
  const enUrl = `${siteOrigin}${pagePathForLocale(page, "en")}`;

  return [
    `  <link rel="alternate" hreflang="ko" href="${koUrl}" />`,
    `  <link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${koUrl}" />`,
  ].join("\n");
}

function renderPage(page) {
  const canonicalUrl = `${siteOrigin}${page.path}`;
  const jsonLdTags = page.jsonLd
    .map(
      (item) =>
        `  <script type="application/ld+json">${JSON.stringify(item)}</script>`,
    )
    .join("\n");

  let html = removeExistingHeadTags(sourceHtml);

  html = html.replace(
    /<html\s+lang="[^"]*">/i,
    `<html lang="${page.htmlLang ?? "ko"}">`,
  );

  if (page.fallbackHtml) {
    html = html.replace(
      /<main class="static-fallback"[\s\S]*?<\/main>/i,
      page.fallbackHtml,
    );
  }

  html = upsertTitle(html, page.title);
  html = upsertMetaName(html, "description", page.description);
  html = upsertMetaName(html, "robots", "index,follow,max-image-preview:large");
  html = upsertMetaProperty(html, "og:type", "website");
  html = upsertMetaProperty(html, "og:site_name", "Site AI Score");
  html = upsertMetaProperty(html, "og:title", page.title);
  html = upsertMetaProperty(html, "og:description", page.description);
  html = upsertMetaProperty(html, "og:url", canonicalUrl);
  html = upsertMetaProperty(html, "og:locale", page.ogLocale ?? "ko_KR");
  html = upsertMetaName(html, "twitter:card", "summary");
  html = upsertMetaName(html, "twitter:title", page.title);
  html = upsertMetaName(html, "twitter:description", page.description);

  html = html.replace(
    "</head>",
    `  <link rel="canonical" href="${canonicalUrl}" />\n${renderAlternateLinks(page)}\n${jsonLdTags}\n</head>`,
  );

  return html;
}

for (const page of pages) {
  const outputDir =
    page.path === "/ko"
      ? path.join(distDir, "ko")
      : path.join(distDir, ...page.path.split("/").filter(Boolean));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "index.html"), renderPage(page));
  console.log(`[prerender] ${page.path}/index.html`);
}
