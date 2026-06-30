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

export function HomePage() {
  const { locale = "ko" } = useParams();

  return (
    <>
      <section className="hero-section full-bleed-section">
        <div className="content-container hero-content">
          <p className="eyebrow">AEO WEB QUALITY VERIFICATION</p>
          <h1>내 사이트를 AI가 얼마나 잘 이해하는지 확인하세요.</h1>
          <p className="hero-description">
            공개 URL을 진단하고, 무엇을 고쳐야 하는지 작업지시서로 정리하며,
            수정 후에는 같은 기준으로 개선 결과를 다시 측정합니다.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to={`/${locale}/sites`}>
              사이트 대시보드에서 진단 시작
            </Link>
          </div>
        </div>
      </section>

      <section className="full-bleed-section section-muted">
        <div className="content-container section-content">
          <div className="section-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>진단부터 수정 검수까지 한 흐름으로</h2>
          </div>
          <div className="step-grid">
            {serviceSteps.map(([number, title, description]) => (
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
            <h2>AI가 사이트를 읽고 이해하는 데 필요한 핵심 영역</h2>
          </div>
          <ul className="diagnostic-list">
            {diagnosticAreas.map((area) => (
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
            <h2>점수만 보여주지 않고, 왜 달라졌는지 증명합니다.</h2>
          </div>
          <div className="score-comparison" aria-label="수정 전후 예시">
            <div>
              <span>수정 전</span>
              <strong>61</strong>
            </div>
            <span className="comparison-arrow" aria-hidden="true">→</span>
            <div>
              <span>수정 후</span>
              <strong>82</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
