import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

const SITE_ORIGIN = "https://siteaiscore.com";

const routeMeta: Record<string, { title: string; description: string }> = {
  "": {
    title: "Site AI Score | AI 검색 친화도 진단",
    description:
      "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해되는지 진단하고, 개선 방향과 작업지시서를 제공하는 서비스입니다.",
  },
  sites: {
    title: "사이트 진단 | Site AI Score",
    description:
      "공개 URL을 기준으로 웹사이트의 AI 검색 친화도, 구조화 데이터, 초기 HTML 콘텐츠, 접근 가능성을 진단합니다.",
  },
  guide: {
    title: "이용가이드 | Site AI Score",
    description:
      "Site AI Score 회원가입, 사이트 등록, 간편진단 실행, 진단 결과 확인, 개선 후 재진단 방법을 안내합니다.",
  },
  faq: {
    title: "자주 묻는 질문 | Site AI Score",
    description:
      "Site AI Score의 무료 이용 범위, 유료 산출물, 결제 준비 상태, 개인정보 보호, 문의 방법을 확인하세요.",
  },
  checkout: {
    title: "요금/결제 안내 | Site AI Score",
    description:
      "Site AI Score의 상세 진단 PDF 보고서, 수정 작업지시서, 개선 후 추가 제공 항목과 요금 안내입니다.",
  },
  terms: {
    title: "이용약관 | Site AI Score",
    description:
      "Site AI Score 서비스 이용 조건, 무료 이용 범위, 유료 산출물, 금지 행위, 면책 사항을 안내합니다.",
  },
  privacy: {
    title: "개인정보처리방침 | Site AI Score",
    description:
      "Site AI Score의 개인정보 처리 목적, 처리 항목, 진단 데이터 저장, 보관 및 삭제 기준을 안내합니다.",
  },
};

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setPropertyMeta(property: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", url);
}

export function RouteMeta() {
  const location = useLocation();
  const { locale = "ko" } = useParams();

  useEffect(() => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    const routeKey = pathParts[1] ?? "";
    const meta = routeMeta[routeKey] ?? routeMeta[""];
    const canonicalPath = `/${locale}${routeKey ? `/${routeKey}` : ""}`;
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

    document.documentElement.lang = locale;
    document.title = meta.title;

    setMeta("description", meta.description);
    setMeta("robots", "index,follow,max-image-preview:large");
    setCanonical(canonicalUrl);

    setPropertyMeta("og:type", "website");
    setPropertyMeta("og:site_name", "Site AI Score");
    setPropertyMeta("og:title", meta.title);
    setPropertyMeta("og:description", meta.description);
    setPropertyMeta("og:url", canonicalUrl);
    setPropertyMeta("og:locale", "ko_KR");

    setMeta("twitter:card", "summary");
    setMeta("twitter:title", meta.title);
    setMeta("twitter:description", meta.description);
  }, [locale, location.pathname]);

  return null;
}
