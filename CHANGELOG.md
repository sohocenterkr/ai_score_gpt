# CHANGELOG

모든 주요 변경사항을 KST 기준으로 기록합니다.

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
