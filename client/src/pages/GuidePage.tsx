export function GuidePage() {
  return (
    <section className="full-bleed-section legal-section">
      <div className="content-container legal-content">
        <p className="eyebrow">GUIDE</p>
        <h1>이용가이드</h1>

        <div className="surface legal-card">
          <h2>1. 회원가입</h2>
          <p>
            이메일 또는 Google 계정으로 회원가입합니다. 이메일 가입의 경우
            인증 메일 확인 후 로그인할 수 있습니다.
          </p>

          <h2>2. 사이트 등록</h2>
          <p>
            진단하려는 사이트명과 대표 URL을 입력합니다. 가능한 한 실제 운영
            중인 공개 URL을 입력하는 것이 좋습니다.
          </p>

          <h2>3. 간편진단 실행</h2>
          <p>
            간편진단은 사이트의 AI 검색 친화도, 구조화 데이터, 초기 HTML 콘텐츠,
            접근성, 링크 구조 등을 빠르게 점검합니다.
          </p>

          <h2>4. 진단 결과 확인</h2>
          <p>
            점수, 등급, 주요 발견 사항, 개선 방향을 확인합니다. 점수는 참고
            지표이며 검색 결과 노출을 보장하지 않습니다.
          </p>

          <h2>5. 보고서와 작업지시서</h2>
          <p>
            상세 보고서와 수정 작업지시서는 유료 산출물로 제공될 수 있습니다.
            결제 기능이 도입되면 결제 완료 후 다운로드할 수 있도록 제공할
            예정입니다.
          </p>

          <h2>6. 개선 후 재진단</h2>
          <p>
            사이트를 수정한 뒤 다시 진단하면 1차, 2차, 3차처럼 회차별 점수
            변화를 확인할 수 있습니다.
          </p>

          <h2>7. 문의</h2>
          <p>
            오류가 발생하거나 이용 방법이 궁금한 경우 카카오톡 오픈채팅으로
            문의할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
