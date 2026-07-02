const fs = require("node:fs");
const path = require("node:path");

const distDir = path.resolve("dist/public");
const sourceIndexPath = path.join(distDir, "index.html");

if (!fs.existsSync(sourceIndexPath)) {
  throw new Error(`index.html not found: ${sourceIndexPath}`);
}

const sourceHtml = fs.readFileSync(sourceIndexPath, "utf8");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "소호센터",
  alternateName: "SOHO Center",
  url: "https://siteaiscore.com/ko",
  logo: "https://siteaiscore.com/favicon.ico",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+82-70-4513-4093",
    contactType: "customer support",
    availableLanguage: ["ko"],
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressRegion: "서울특별시",
    addressLocality: "강동구",
    streetAddress: "양재대로 1522-10, 202호(길동)",
  },
};

const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Site AI Score",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://siteaiscore.com/ko",
  description:
    "Site AI Score는 웹사이트의 AI 검색 친화도, 검색엔진 접근성, 구조화 데이터, 초기 HTML 콘텐츠, 개선 방향을 진단하는 웹 애플리케이션입니다.",
  provider: {
    "@type": "Organization",
    name: "소호센터",
    url: "https://siteaiscore.com/ko",
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
    price: "100",
    availability: "https://schema.org/PreOrder",
    description:
      "간편진단 실행은 무료로 제공되며, 상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다.",
  },
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
    "간편진단 실행은 무료로 제공됩니다. 계정당 최대 10개 사이트까지 무료로 진단할 수 있으며, 이미 진단한 사이트는 무료 한도 초과 후에도 재진단할 수 있습니다.",
  ],
  [
    "유료 요금제는 어떻게 되나요?",
    "상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다. 기본 가격은 USD 100 수준을 검토하고 있으며, 개선 사례 활용에 동의하는 경우 USD 70 수준의 할인 가격을 검토하고 있습니다.",
  ],
  [
    "결제는 어떤 방식으로 가능한가요?",
    "결제 기능은 준비 중입니다. 1회성 결제 방식으로 제공할 예정이며, 결제 수단은 최종 도입 시 안내됩니다.",
  ],
  [
    "환불이나 취소는 가능한가요?",
    "결제 기능 도입 후 환불 기준을 별도로 안내할 예정입니다. 디지털 산출물이 생성되거나 다운로드된 경우 환불이 제한될 수 있습니다.",
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
    "사이트명, URL, 진단 결과 점수는 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 생성된 상세 보고서 자료와 수정 작업지시서 본문은 관리자 페이지에서 열람할 수 없도록 운영됩니다.",
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

const pages = [
  {
    path: "/ko",
    title: "Site AI Score | AI 검색 친화도 진단",
    description:
      "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해되는지 진단하고, 개선 방향과 작업지시서를 제공하는 서비스입니다.",
    jsonLd: [organizationJsonLd, webApplicationJsonLd],
  },
  {
    path: "/ko/guide",
    title: "이용가이드 | Site AI Score",
    description:
      "Site AI Score 회원가입, 사이트 등록, 간편진단 실행, 진단 결과 확인, 개선 후 재진단 방법을 안내합니다.",
    jsonLd: [organizationJsonLd],
  },
  {
    path: "/ko/faq",
    title: "자주 묻는 질문 | Site AI Score",
    description:
      "Site AI Score의 무료 이용 범위, 유료 산출물, 결제 준비 상태, 개인정보 보호, 문의 방법을 확인하세요.",
    jsonLd: [organizationJsonLd, faqJsonLd],
  },
  {
    path: "/ko/terms",
    title: "이용약관 | Site AI Score",
    description:
      "Site AI Score 서비스 이용 조건, 무료 이용 범위, 유료 산출물, 금지 행위, 면책 사항을 안내합니다.",
    jsonLd: [organizationJsonLd],
  },
  {
    path: "/ko/privacy",
    title: "개인정보처리방침 | Site AI Score",
    description:
      "Site AI Score의 개인정보 처리 목적, 처리 항목, 진단 데이터 저장, 보관 및 삭제 기준을 안내합니다.",
    jsonLd: [organizationJsonLd],
  },
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
    .replace(/\s*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, "\n");
}

function upsertTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function upsertMetaName(html, name, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`, "i");
  const tag = `<meta name="${name}" content="${escaped}" />`;

  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function upsertMetaProperty(html, property, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`, "i");
  const tag = `<meta property="${property}" content="${escaped}" />`;

  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function renderPage(page) {
  const canonicalUrl = `https://siteaiscore.com${page.path}`;
  const jsonLdTags = page.jsonLd
    .map(
      (item) =>
        `  <script type="application/ld+json">${JSON.stringify(item)}</script>`,
    )
    .join("\n");

  let html = removeExistingHeadTags(sourceHtml);

  html = upsertTitle(html, page.title);
  html = upsertMetaName(html, "description", page.description);
  html = upsertMetaName(html, "robots", "index,follow,max-image-preview:large");
  html = upsertMetaProperty(html, "og:type", "website");
  html = upsertMetaProperty(html, "og:site_name", "Site AI Score");
  html = upsertMetaProperty(html, "og:title", page.title);
  html = upsertMetaProperty(html, "og:description", page.description);
  html = upsertMetaProperty(html, "og:url", canonicalUrl);
  html = upsertMetaProperty(html, "og:locale", "ko_KR");
  html = upsertMetaName(html, "twitter:card", "summary");
  html = upsertMetaName(html, "twitter:title", page.title);
  html = upsertMetaName(html, "twitter:description", page.description);

  html = html.replace(
    "</head>",
    `  <link rel="canonical" href="${canonicalUrl}" />\n${jsonLdTags}\n</head>`,
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
