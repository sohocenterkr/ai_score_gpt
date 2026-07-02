const faqs = [
  {
    question: "이 사이트는 어떤 서비스인가요?",
    answer:
      "Site AI Score는 웹사이트가 AI 검색과 검색엔진에 잘 이해될 수 있는지 진단하고, 개선 방향을 제안하는 서비스입니다.",
  },
  {
    question: "누구를 위한 서비스인가요?",
    answer:
      "자영업자, 스타트업, 기업 홈페이지 운영자, 마케팅 담당자, 웹 제작사처럼 사이트의 AI 검색 친화도를 개선하려는 사용자를 위한 서비스입니다.",
  },
  {
    question: "처음 이용하려면 어떻게 해야 하나요?",
    answer:
      "회원가입 후 사이트명과 대표 URL을 등록하고 간편진단을 실행하면 됩니다.",
  },
  {
    question: "회원가입이 필요한가요?",
    answer:
      "진단 이력 관리와 결과 확인을 위해 회원가입이 필요합니다. 이메일 또는 Google 계정으로 가입할 수 있습니다.",
  },
  {
    question: "무료로 이용할 수 있나요?",
    answer:
      "간편진단 실행은 무료로 제공됩니다. 다만 서비스 남용을 막기 위해 계정당 무료 진단 횟수 제한이 적용될 수 있습니다.",
  },
  {
    question: "유료 요금제는 어떻게 되나요?",
    answer:
      "상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다. 기본 가격은 USD 100 수준을 검토하고 있으며, 개선 사례 활용에 동의하는 경우 USD 70 수준의 할인 가격을 검토하고 있습니다.",
  },
  {
    question: "결제는 어떤 방식으로 가능한가요?",
    answer:
      "결제 기능은 준비 중입니다. 1회성 결제 방식으로 제공할 예정이며, 결제 수단은 최종 도입 시 안내됩니다.",
  },
  {
    question: "환불이나 취소는 가능한가요?",
    answer:
      "결제 기능 도입 후 환불 기준을 별도로 안내할 예정입니다. 디지털 산출물이 생성되거나 다운로드된 경우 환불이 제한될 수 있습니다.",
  },
  {
    question: "모바일에서도 사용할 수 있나요?",
    answer:
      "네. Site AI Score는 모바일에서도 사용할 수 있도록 구성되어 있습니다.",
  },
  {
    question: "비밀번호를 잊어버리면 어떻게 하나요?",
    answer:
      "로그인 화면의 비밀번호 재설정 기능을 이용해 등록한 이메일로 재설정 링크를 받을 수 있습니다.",
  },
  {
    question: "개인정보는 안전하게 보호되나요?",
    answer:
      "서비스 제공에 필요한 정보만 처리하며, 비밀번호는 해시 형태로 저장됩니다. 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.",
  },
  {
    question: "입력한 데이터는 저장되나요?",
    answer:
      "사이트명, URL, 진단 결과 점수는 서비스 제공과 이력 확인을 위해 저장될 수 있습니다. 생성된 상세 보고서 자료와 수정 작업지시서의 내용은 관리자도 열람할 수 없습니다.",
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
  {
    question: "이용약관과 개인정보처리방침은 어디에서 확인하나요?",
    answer:
      "사이트 하단 Footer의 이용약관과 개인정보처리방침 링크에서 확인할 수 있습니다.",
  },
];

export function FaqPage() {
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
        <h1>자주 묻는 질문</h1>

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
