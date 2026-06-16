# Site AI Score

웹사이트가 AI에게 얼마나 잘 읽히고 이해되는지 진단하고, 수정 작업지시서를 만들며, 배포된 운영 URL을 다시 자동검수하는 AEO 웹 품질검증 플랫폼입니다.

## 현재 단계

핵심 서비스 3-4D 진단 보고서 PDF 반복 다운로드 캐시까지 완료된 상태입니다.

- TypeScript
- React + Vite
- Express
- Prisma/PostgreSQL
- URL locale 라우팅
- 모바일 우선 Edge-to-edge UI
- KST 공통 모듈과 단위테스트
- 서버·DB 상태 확인 API
- 이메일 기반 회원가입·로그인·로그아웃
- Argon2id 비밀번호 해시
- 해시 기반 서버 세션과 HttpOnly 쿠키
- 로그인 횟수·최종 로그인 기록
- 인증 보호 대시보드
- 로그인 회원 비밀번호 변경
- 변경·재설정 후 기존 세션 전체 폐기
- 30분 유효 일회용 비밀번호 재설정 링크
- 재설정 토큰 원문을 저장하지 않는 해시 보관
- 사용·만료된 재설정 링크 접속 즉시 차단
- Resend와 검증된 `auth.siteaiscore.com` 발신 도메인 연동
- 로그인 회원의 사이트 등록·수정·보관 처리
- URL 정규화와 회원별 중복 등록 차단
- localhost·사설 IP·내부망·클라우드 메타데이터 SSRF 차단
- DNS 결과와 리디렉션 단계별 공개 IP 재검증
- 검사 작업 대기열과 규칙 버전 기록
- 실제 HTTP 응답·리디렉션·robots.txt·sitemap.xml 기초 수집
- title·meta description·canonical·HTML 언어·heading·링크·iframe·JSON-LD 분석
- 원본 HTML 대신 SHA-256 해시와 구조화된 증거 저장
- 규칙 버전 `2026.06-core-v2`와 7개 영역 총 100점 배점
- 규칙 기반 종합점수·A+~F 등급·영역별 점수 계산
- robots.txt 선언 sitemap 우선 확인과 OAI-SearchBot·ChatGPT-User·GPTBot 구분
- 검사 결과 상세 화면, 주요 문제, 검사 증거, 수정 권장사항 표시
- 진단 배지의 판정·중요도·배점·감점 의미 안내
- 비짓제주 실제 v2 검사에서 71점·B등급, 페이지 1건, 진단 25건 확인
- 검사 결과의 주요 문제 선택 기반 수정 작업지시서 생성
- `WO-YYYYMMDD-#####` 번호와 버전별 원본 보존
- 작업지시서 초안·발급·취소와 새 버전 생성
- 문제별 대상 URL·수정 요구사항·개발자 전달 문구·완료 판정 기준
- 현재 점수와 규칙 배점 기준 예상 개선 범위
- 작업지시서 JSON·UTF-8 BOM CSV 파일 출력
- A4 작업지시서 PDF 파일 출력
- PDF에 Noto Sans KR WOFF2 500 단일 글꼴을 내장하여 한글 검색·복사 지원
- 현재 점수·예상 점수 범위·항목별 요구사항·완료 기준·최초 검사 증거·면책·페이지 번호 표시
- 비짓제주 실제 작업지시서 PDF 10페이지, 생성 약 1.07초, 파일 약 6.09MB 확인
- 검사 결과 상세 화면에서 진단 보고서 PDF 저장
- 종합점수·등급·7개 영역·AI 이해 요약·주요 문제·전체 진단·수집 페이지·검사 증거·면책·페이지 번호 표시
- 검사 증거의 쿠키·토큰·비밀번호·인증정보 자동 숨김
- 진단 보고서에는 퍼블릭 도메인 둥근모꼴+ Fixedsys TTF 단일 글꼴을 내장하여 한글 표시·검색·복사 지원
- 비짓제주 실제 진단 보고서 PDF A4 15페이지, 약 65KB, 주요 문제 5건·전체 진단 25건·수집 페이지 1건과 한글 표시·검색·복사 확인
- 진단 보고서 완성본을 PostgreSQL 공유 캐시에 저장하여 서버 재시작과 여러 서버 인스턴스에서 재사용
- 검사 ID·규칙 버전·검사 완료 시각·정제된 결과 해시·PDF 렌더러 버전·글꼴 해시를 기준으로 캐시 자동 무효화
- 동일 보고서 동시 요청 시 DB 생성 잠금으로 중복 PDF 생성을 방지하고, 생성 서버 장애 시 만료된 잠금을 회수
- 캐시 적중 시 저장 PDF의 크기와 SHA-256을 검증하고 손상된 저장본은 다시 생성
- PDF와 캐시 오류 정보에 포함된 쿠키·Bearer 토큰·비밀번호·인증정보 자동 숨김
- 실제 v3 보고서 검증에서 최초 생성 922.99ms `MISS`, 반복 다운로드 10.24ms `HIT`, 다운로드본·DB 저장본 PDF SHA-256 일치 확인
- 렌더러 버전 `2026.06-scan-report-v3`와 둥근모꼴 TTF 글꼴 해시 변경으로 기존 v2 캐시가 자동 무효화·재생성되는 것을 확인
- 비짓제주 발급 작업지시서 1건과 작업 항목 5건 저장 확인

검사 신청 후 서버의 자동 백그라운드 워커가 대기 작업을 순차적으로 처리하며, 별도의 `npm run scan:once` 실행 없이 `QUEUED → RUNNING → COMPLETED` 상태 전환을 완료합니다. QUICK 검사는 초기 HTML 진단과 함께 Playwright·Chromium으로 JavaScript 실행 후 DOM을 수집하여 본문량·제목·링크·구조화 데이터 변화를 비감점 비교 증거로 저장합니다. 현재 점수는 기존 초기 HTML 기준 25개 규칙을 유지하며, 렌더링 실패가 전체 검사를 중단시키지 않습니다. 모바일·데스크톱 별도 비교, 에이전시 배정·배포 URL 제출·자동검수는 아직 구현하지 않았습니다. Production 공유 오브젝트 스토리지가 구성되면 현재 PostgreSQL PDF 캐시를 Cloudinary 비공개 자산 방식으로 이전할 수 있도록 저장소 구조를 분리합니다. Google 로그인과 계정 설정·회원탈퇴도 후속 단계입니다.

## 프로젝트 루트

```text
/home/runner/workspace
```

별도의 중첩 프로젝트 폴더를 만들지 않습니다.

## 개발 실행

```bash
cd /home/runner/workspace
npm install
npm run dev
```

Replit 개발 포트는 `5000`입니다.

## 검사 명령

```bash
npm run check
npm test
npm run build
npm run scan:once
```

## 환경변수

`.env.example`을 참고합니다. 비밀값은 Git에 저장하지 않고 Replit Secrets에만 등록합니다.

`DATABASE_URL`이 설정되지 않아도 첫 골격은 실행되며 `/api/health`에서 `not_configured`로 표시됩니다. DB를 설정한 뒤에는 다음을 실행합니다.

```bash
npm run db:generate
npm run db:validate
```

비밀번호 재설정 메일 발송에는 다음 환경변수가 필요합니다.

```text
APP_BASE_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
```

## 초기 locale

다국어 구조는 구현했지만, 공개 언어 목록이 확정되기 전까지 활성 locale은 `ko` 하나입니다. 언어 목록 확정 후 `shared/locales.ts`와 번역 리소스를 확장합니다.

## 주요 경로

```text
/                              → /ko 이동
/ko                            → 공개 메인 화면
/ko/signup                     → 이메일 회원가입
/ko/login                      → 이메일 로그인
/ko/forgot-password            → 비밀번호 재설정 메일 요청
/ko/reset-password             → 일회용 링크의 새 비밀번호 설정
/ko/change-password            → 로그인 회원 비밀번호 변경
/ko/dashboard                  → 인증 회원 대시보드
/ko/sites                      → 사이트 등록·수정·검사 작업 관리
/ko/sites/:siteId/scans/:scanId → 점수·영역별 결과·문제·증거 상세
/ko/work-orders                → 작업지시서 목록
/ko/work-orders/:workOrderId   → 작업지시서 상세·발급·버전·자료 저장
/ko/system                     → 서버·KST·DB 상태 확인
/api/health                    → JSON 상태 API
/api/auth/session              → 현재 로그인 세션 확인
/api/auth/forgot-password      → 재설정 메일 요청
/api/auth/validate-reset-token → 재설정 링크 사전 검증
/api/auth/reset-password       → 새 비밀번호 저장
/api/auth/change-password      → 로그인 회원 비밀번호 변경
/api/me                        → 인증 회원 정보
/api/sites                     → 사이트 목록·등록
/api/sites/:siteId             → 사이트 상세·수정·보관
/api/sites/:siteId/scans       → 검사 이력·검사 작업 생성
/api/scan-results/:scanId      → 검사 점수·진단 결과 상세 조회
/api/work-orders               → 작업지시서 목록·생성
/api/work-orders/:workOrderId  → 작업지시서 상세·초안 취소
/api/work-orders/:workOrderId/issue  → 작업지시서 발급
/api/work-orders/:workOrderId/revise → 작업지시서 새 버전 생성
/api/work-orders/:workOrderId/export.json → JSON 저장
/api/work-orders/:workOrderId/export.csv  → CSV 저장
/api/work-orders/:workOrderId/export.pdf  → PDF 저장
/api/scan-results/:scanId/export.pdf     → 진단 보고서 PDF 저장
```

## 문서

- `AGENTS.md`: 협업·수정 원칙
- `replit.md`: Replit 실행 환경과 프로젝트 루트 원칙
- `SITEAISCORE_FINAL_DEVELOPMENT_PROMPT.md`: 전체 제품 기획
- `DATABASE.md`: 개발/배포 DB 기록
- `DEPLOYMENT.md`: 배포 상태와 Secrets 이름
- `CHANGELOG.md`: 주요 변경 이력
