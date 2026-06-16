# CHANGELOG

모든 주요 변경사항을 KST 기준으로 기록합니다.

## 2026-06-16

### Added

- 진단 보고서 반복 다운로드용 `ScanReportCache` Prisma 모델
- 마이그레이션 `20260615121000_add_scan_report_cache`
- PostgreSQL `BYTEA` 기반 공유 PDF 캐시와 캐시 상태 `GENERATING`, `READY`, `FAILED`
- 검사 ID·규칙 버전·검사 완료 시각·정제된 결과 SHA-256·렌더러 버전·글꼴 SHA-256 기반 캐시 키
- 동일 보고서 동시 요청의 중복 생성을 막는 DB 생성 토큰과 90초 잠금 만료 처리
- 캐시 응답 확인용 `X-Site-AI-Report-Cache: MISS|HIT` 헤더
- 캐시 PDF 크기·SHA-256 무결성 검사와 손상 저장본 자동 재생성
- PDF 생성일을 검사 완료 시각으로 고정하여 동일 검사 결과의 PDF 재현성 개선
- 객체 키뿐 아니라 문자열 안의 Authorization·Bearer 토큰·Cookie·비밀번호·토큰 숨김 처리
- 캐시 생성 실패 메시지의 민감정보 숨김 처리
- 캐시 적중·무효화·동시 생성·민감정보·무결성 회귀 테스트
- 서버 시작 시 대기 검사를 자동 처리하는 `scan-background-worker`
- 자동 워커 활성화·대기 간격 설정용 `SCAN_WORKER_ENABLED`, `SCAN_WORKER_POLL_INTERVAL_MS`
- 자동 워커 순차 처리·중복 방지·오류 복구·안전 종료 테스트 4개
- Playwright 기반 JavaScript 렌더링 DOM 수집기
- Replit Chromium 실행 환경용 `replit.nix`
- 렌더링 활성화·Chromium 경로·제한시간 설정용 `RENDERED_DOM_ENABLED`, `CHROMIUM_PATH`, `RENDERED_DOM_TIMEOUT_MS`, `RENDERED_DOM_SETTLE_MS`
- 등록 사이트 목록의 `QUEUED`·`RUNNING` 검사 상태 자동 갱신
- 결과 화면과 PDF의 초기 HTML·JavaScript 렌더링 DOM 비교 영역
- 렌더링 차이에서 쉬운 AI 수집 개선안을 자동 생성하는 규칙
- 개선안마다 현재 상태·쉬운 의미·수정 방향·개발자 작업 지시·완료 확인 기준 제공
- 기존 점수 문제와 AI 수집 개선안을 선택해 작업지시서 1건으로 만드는 기능
- 작업지시서 요청의 `renderedImprovementCodes` 검증과 서버 측 검사 증거 재확인
- `findingId`가 없는 점수 외 독립 개선 작업 항목 지원

### Changed

- 진단 보고서 다운로드가 매 요청 실시간 생성 방식에서 최초 생성 후 공유 캐시 재사용 방식으로 변경
- 개발 단계에서는 별도 오브젝트 스토리지가 없어 약 48~62KB의 PDF를 PostgreSQL에 제한적으로 저장
- Production 공유 오브젝트 스토리지 구성 후 Cloudinary 비공개 자산 저장 방식으로 이전할 수 있도록 캐시 서비스를 분리
- 진단 보고서 렌더러 버전을 `2026.06-scan-report-v2`로 지정
- 진단 보고서 글꼴을 Noto Sans KR WOFF에서 퍼블릭 도메인 둥근모꼴+ Fixedsys TTF로 변경
- 진단 보고서 렌더러 버전을 `2026.06-scan-report-v3`로 올려 기존 캐시 자동 무효화
- 서버 빌드 시 `DungGeunMo.ttf`를 `dist/assets/fonts`로 복사하도록 배포 자산 처리 추가
- 진단 보고서 내부 글꼴 식별자를 `SiteAiScoreReportFont`로 정리
- 검사 신청 후 별도 Shell 명령 없이 `QUEUED → RUNNING → COMPLETED`를 자동 처리하도록 서버 시작·종료 흐름에 워커 연결
- 자동 워커는 한 번에 한 검사만 순차 처리하며, 대기열이 비면 기본 1초 간격으로 다시 확인
- 기존 25개 점수 규칙은 유지하고 렌더링 DOM 결과를 `ENV-MEASUREMENT-001`의 비감점 비교 증거로 저장
- 초기 HTML과 렌더링 DOM의 본문 길이·제목·링크·JSON-LD·Open Graph 차이를 기록
- 렌더링 실패나 Chromium 부재가 QUICK 검사 전체 완료를 막지 않도록 격리
- 사이트 목록은 대기·검사 중인 작업이 있을 때만 상태를 주기적으로 갱신하고 완료 후 자동 중지
- 본문·내부 링크 증가, 제목·설명·H1·JSON-LD 불일치와 초기 HTML 핵심정보 부족을 개선안 생성에 활용
- 렌더링 결과는 점수에 직접 반영하지 않고 추가 콘텐츠를 읽는 AI 환경까지 고려한 수정 권장사항에 활용
- 진단 보고서 렌더러를 `2026.06-scan-report-v6`로 상향하여 기존 캐시 자동 무효화
- 화면과 PDF의 검사 범위 설명을 현재 렌더링 비교 기능에 맞게 통일
- AI 수집 개선안 카드에 작업지시서 포함 선택 기능과 선택 항목 합계 표시
- 점수 외 AI 수집 개선안은 예상 점수 범위 계산에서 제외
- 작업지시서 화면과 PDF에서 독립 개선안을 `권장 개선`, `점수 외 개선`, `추가 개선 권장`, `AI 수집 안정성`으로 표시
- 작업지시서 PDF 글꼴을 Noto Sans KR WOFF2에서 둥근모꼴+ Fixedsys TTF로 변경
- 작업지시서 PDF 섹션 시작 위치를 왼쪽 여백으로 고정하고 긴 완료 기준 코드를 짧은 호환 코드로 변경

### Security

- 기존 로그인·조직 구성원·검사 소유권 확인 후에만 캐시 조회
- 브라우저 응답의 `Cache-Control: private, no-store` 유지
- 캐시 PDF 저장 전 검사 증거의 쿠키·토큰·비밀번호·인증정보 정제
- 저장 PDF의 크기와 SHA-256을 캐시 적중 시 재검증
- 렌더링 최초 URL·최종 URL·하위 HTTP 요청의 공개 주소 검증
- 사설·로컬·메타데이터 주소, GET·HEAD 외 요청, WebSocket·EventSource·Service Worker와 이미지·동영상·글꼴 요청 차단
- 렌더링 HTML 원문은 DB에 저장하지 않고 정제된 분석값과 오류 이름만 저장
- npm 운영·전체 의존성 보안감사 취약점 0건
- 전체 단위·API 테스트 95개 통과

### Verified

- 개발 DB 마이그레이션 6개 적용 및 `Database schema is up to date` 확인
- 마이그레이션 전후 사이트 1건, 검사 3건, 페이지 2건, 진단 39건, 작업지시서 1건, 작업 항목 5건 유지
- v1 진단 보고서 최초 생성 26.59초 `MISS`, 반복 다운로드 9.57ms `HIT`
- v1 최초·반복·DB 저장 PDF 47,839바이트와 SHA-256 완전 일치
- v2 진단 보고서 반복 다운로드 약 8~13ms, DB 저장 PDF 62,300바이트와 SHA-256 일치
- 개발 DB에 정상 상태의 진단 보고서 캐시 2건 저장 확인
- 비짓제주 v3 진단 보고서 최초 생성 922.99ms `MISS`, 반복 다운로드 10.24ms `HIT`
- v3 다운로드본·반복 다운로드본·PostgreSQL 저장본 66,049바이트와 SHA-256 완전 일치
- v2 캐시가 렌더러·글꼴 해시 변경으로 v3 캐시로 자동 무효화·재생성됨을 확인
- v3 진단 보고서 A4 15페이지, 한글 표시·검색·복사, 주요 문제 5건·전체 진단 25건 확인
- PDF 관련 타입검사와 캐시·PDF·라우터 테스트 13개 통과
- 실제 사이트 검사 신청에서 Shell 실행 없이 대기·검사 중·완료 상태가 연속 자동 처리되는 통합 동작 확인
- 자동 워커 테스트 4개와 기존 검사 회귀 테스트 17개 통과
- Playwright 렌더링·검사 엔진·자동 워커 관련 테스트 11개 통과
- 비짓제주 신규 검사에서 자동 실행·화면 상태 갱신·렌더링 비교 증거 저장 확인
- 비짓제주 초기 HTML 2,529자에서 렌더링 DOM 8,224자로 증가하고 내부 링크 34개에서 130개로 증가한 증거 저장
- 렌더링 성공 상태, Chromium `92.0.4515.159`, 기존 71점·B등급·진단 25건 유지 확인
- 비짓제주 실제 개선안 보고서 A4 17페이지에서 렌더링 비교·AI 수집 개선안 2건·개발자 작업 지시·완료 확인 기준 확인
- 진단 보고서 테스트 5개와 전체 단위·API 테스트 95개 통과
- 비짓제주 작업지시서에 점수 항목 5건과 AI 수집 개선안 2건을 함께 저장하고 예상 점수 86~100점 유지 확인
- 작업지시서 PDF A4 10페이지에서 전체 7개 작업 항목, 한글·영문 표시, 검색·복사와 완료 기준 코드 추출 확인
- PDFium과 Poppler 계열 렌더러에서 작업지시서 PDF 글자 표시 확인

### Not yet implemented

- Production Cloudinary 비공개 오브젝트 스토리지 이전
- 에이전시 배정·배포 URL 제출·자동검수
- Playwright 모바일·데스크톱 별도 렌더링 비교

## 2026-06-15

### Added

- 작업지시서 Prisma 모델과 마이그레이션 `20260615072844_add_work_orders`
- 작업지시서 번호 `WO-YYYYMMDD-#####`와 버전별 원본 보존
- 검사 결과의 주요 문제 선택 기반 작업지시서 생성
- 문제별 대상 URL·수정 요구사항·개발자 전달 문구·완료 판정 기준
- 초안·발급·취소와 새 버전 생성
- 현재 점수와 규칙 배점 기준 예상 개선 범위
- `/api/work-orders` 목록·생성·상세·발급·버전 API
- 작업지시서 JSON·UTF-8 BOM CSV 출력
- `/api/work-orders/:workOrderId/export.pdf` 작업지시서 PDF 출력
- `/api/scan-results/:scanId/export.pdf` 진단 보고서 PDF 출력
- 검사 결과 상세 화면의 `PDF 보고서 저장` 기능
- 종합점수·등급·7개 영역·AI 이해 요약·주요 문제·전체 진단·수집 페이지·검사 증거·면책·페이지 번호 구성
- 검사 증거의 쿠키·토큰·비밀번호·인증정보 자동 숨김
- Noto Sans KR WOFF 500 단일 글꼴로 브라우저 PDF 뷰어 한글 표시 안정성 확보
- 비짓제주 실제 진단 보고서 A4 16페이지·62,298바이트·전체 페이지 텍스트 표시 확인
- 작업지시서 상세 화면의 `PDF 저장` 기능
- PDFKit `0.19.1`과 Noto Sans KR `5.2.9` 한글 글꼴 내장
- Noto Sans KR WOFF2 500 단일 글꼴 등록으로 PDF 생성 성능 최적화
- A4 표지·점수·작업 항목·완료 기준·최초 검사 증거·면책·페이지 번호 구성
- 비짓제주 실제 PDF 10페이지, 생성 약 1.07초, 파일 6,388,229바이트 확인
- 한글 판정 문구와 푸터 빈 페이지 회귀 테스트 추가
- `/ko/work-orders`, `/ko/work-orders/:workOrderId` 화면
- 모바일 Edge-to-edge 작업지시서 목록·상세 UI
- 비짓제주 발급 작업지시서 1건과 작업 항목 5건 저장 확인
- 규칙 버전 `2026.06-core-v2`
- 7개 영역 총 100점 규칙 기반 점수와 A+~F 등급
- 영역별 점수·측정 범위·예상 개선 범위 계산
- robots.txt 선언 sitemap 주소 우선 확인
- OAI-SearchBot 검색용·ChatGPT-User 사용자 요청용·GPTBot 학습용 정책 구분
- `/api/scan-results/:scanId` 검사 결과 상세 API
- `/ko/sites/:siteId/scans/:scanId` 검사 결과 상세 화면
- 주요 문제·전체 진단·검사 증거·수정 권장사항 표시
- 판정·중요도·배점·감점 의미를 구분한 진단 배지와 안내
- 모바일 결과 화면 히어로 좌우 여백과 Full-bleed 구성 보완
- 로그인 회원의 사이트 등록·목록·상세·수정·보관 처리
- 고객 조직과 OWNER 구성원 자동 생성
- 사이트 URL 정규화와 회원별 중복 등록 차단
- localhost·사설 IP·내부망·클라우드 메타데이터 SSRF 차단
- DNS 결과와 리디렉션 단계별 공개 IP 재검증
- `Site`, `SiteFact`, `Scan`, `ScanPage`, `Finding` Prisma 모델
- 마이그레이션 `20260615042821_add_sites_scan_foundation`
- `/ko/sites` 모바일 우선 사이트 관리 화면
- 검사 작업 대기열과 `npm run scan:once` 수동 실행기
- 실제 HTTP 응답·리디렉션·robots.txt·sitemap.xml 기초 수집
- title·meta description·canonical·HTML 언어·heading·링크·iframe·JSON-LD 분석
- 원본 HTML SHA-256 해시와 구조화된 진단 증거 저장
- 비짓제주 실제 공개 URL 검사 완료
- 로그인 회원의 현재 비밀번호 검증 후 비밀번호 변경 기능
- `/ko/forgot-password`, `/ko/reset-password`, `/ko/change-password` 화면
- 비밀번호 찾기·재설정·변경 API
- 30분 유효 일회용 비밀번호 재설정 토큰
- 재설정 토큰 HMAC-SHA256 해시 저장
- 사용 완료·만료·잘못된 재설정 링크 접속 즉시 검증
- `PasswordResetToken` Prisma 모델
- 마이그레이션 `20260614070105_add_password_reset_tokens`
- Resend `6.12.4` 연동
- Resend 발신 도메인 `auth.siteaiscore.com` DNS 인증
- 실제 비밀번호 재설정 이메일 발송·수신 확인
- 비밀번호 관련 API 테스트 추가

### Security

- 비밀번호 변경·재설정 후 기존 세션 전체 폐기
- 새 재설정 토큰 발급 시 기존 미사용 토큰 무효화
- 재설정 토큰 재사용 차단
- 존재하지 않는 이메일과 가입 이메일에 동일한 요청 응답 사용
- 사용·만료된 링크에서 비밀번호 입력 폼 미표시
- npm 운영·전체 의존성 보안감사 취약점 0건
- 단위·API 테스트 21개 통과
- 실제 DB 비밀번호 기능 통합 테스트 18개 통과
- 사이트·검사 실제 DB 통합 테스트 16개 통과
- 전체 단위·API 테스트 76개 통과
- 실제 DB 작업지시서 기능 통합 테스트 17개 통과
- 고정 IP lookup 콜백 회귀 테스트 추가
- 비짓제주 v1 실제 검사: 최종 URL `/kr`, 페이지 1건, 진단 14건 저장
- 비짓제주 v2 실제 검사: 71점·B등급, 페이지 1건, 진단 25건 저장

### Not yet implemented

- 진단 보고서 PDF 반복 다운로드 캐시와 최초 생성 성능 최적화
- 에이전시 배정·배포 URL 제출·자동검수
- 자동 백그라운드 검사 실행기
- Playwright 렌더링 DOM·모바일/데스크톱 비교

## 2026-06-14

### Added

- TypeScript React/Vite + Express 프로젝트 기반
- Prisma/PostgreSQL 스키마 준비
- `/ko` locale 공개 화면
- `/ko/system` 상태 확인 화면
- `/api/health` 서버·KST·DB 상태 API
- 모바일 768px 이하 Edge-to-edge / Full-bleed UI
- KST 공통 모듈과 경계 단위테스트
- 프로젝트 운영 문서와 환경변수 예시
- 최초 Prisma 마이그레이션 `20260614055344_init_app_metadata`
- 개발 DB의 `app_metadata`, `_prisma_migrations` 테이블
- Replit Preview 도메인의 환경변수 기반 Vite 허용 호스트 설정
- 이메일 회원가입·로그인·로그아웃 API와 화면
- Argon2id 비밀번호 해시
- 해시된 서버 세션 토큰과 HttpOnly 쿠키
- 현재 세션 확인 및 인증 보호 API
- 회원 대시보드와 보호 라우팅
- 사용자·인증계정·세션 Prisma 모델
- 인증 마이그레이션 `20260614062302_add_local_auth`
- 인증 API 테스트와 실제 DB 통합 테스트

### Changed

- Replit 실행 명령을 Python 정적 서버에서 `npm run dev`로 변경
- 서비스명을 `AI_Score_GPT`에서 `Site AI Score`로 변경
- 개발 도구를 Vite 8.0.16, Vitest 4.1.8, esbuild 0.28.1로 갱신
- npm 운영·전체 의존성 보안감사 결과를 취약점 0건으로 정리

### Not yet implemented

- Google 로그인과 동일 이메일 계정 연결
- 계정 설정과 즉시 회원탈퇴
- 총관리자·공지·Cloudinary
- 사이트 등록·검사 엔진
- 점수·작업지시서·에이전시 자동검수
