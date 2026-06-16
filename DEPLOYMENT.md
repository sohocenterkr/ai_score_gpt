# DEPLOYMENT.md

## 현재 상태

- 개발 환경: Replit
- 프로젝트 루트: `/home/runner/workspace`
- 개발 포트: `5000`
- 운영 배포: 아직 구성하지 않음
- 공식 도메인: `siteaiscore.com`
- GitHub origin: `https://github.com/sohocenterkr/ai_score_gpt.git` 연결 완료
- 개발 DB: Replit 제공 PostgreSQL `heliumdb` 연결 확인
- 개발 DB 마이그레이션:
  - `20260614055344_init_app_metadata`
  - `20260614062302_add_local_auth`
  - `20260614070105_add_password_reset_tokens`
  - `20260615042821_add_sites_scan_foundation`
  - `20260615072844_add_work_orders`
  - `20260615121000_add_scan_report_cache`
- `SESSION_SECRET`: Replit 환경에 32자 이상 설정 확인
- `APP_BASE_URL`: Replit Preview 공개 origin 설정 확인
- Resend API Key 설정 확인
- Resend 발신 도메인 `auth.siteaiscore.com` DNS Verified 확인
- 발신 주소: `Site AI Score <no-reply@auth.siteaiscore.com>`
- 실제 비밀번호 재설정 메일 발송·수신 확인
- 외부 공개 URL HTTP 수집과 DNS·리디렉션 SSRF 재검증 확인
- HTTP 수집 제한: 요청 15초, 최대 리디렉션 5회, 응답 본문 2MB
- 수동 검사 작업 실행 명령: `npm run scan:once`
- 현재 점수 규칙 버전: `2026.06-core-v2`
- 검사 결과 화면: `/ko/sites/:siteId/scans/:scanId`
- 결과 API: `/api/scan-results/:scanId`
- 비짓제주 실제 v2 검사에서 71점·B등급·진단 25건 확인
- 작업지시서 목록: `/ko/work-orders`
- 작업지시서 상세: `/ko/work-orders/:workOrderId`
- 작업지시서 API: `/api/work-orders`
- JSON·UTF-8 BOM CSV·PDF 자료 출력 지원
- 개발 DB에 비짓제주 발급 작업지시서 1건과 작업 항목 5건 유지
- 작업지시서 PDF API: `/api/work-orders/:workOrderId/export.pdf`
- PDFKit `0.19.1`, 작업지시서용 Noto Sans KR `5.2.9`, 진단 보고서용 둥근모꼴+ Fixedsys TTF, `@types/pdfkit` `0.17.6` 사용
- Noto Sans KR WOFF2 500 단일 글꼴을 PDF에 내장하고 한글 검색·복사를 지원
- 비짓제주 실제 작업지시서 PDF: A4 10페이지, 생성 약 1.07초, 6,388,229바이트 확인
- 진단 보고서 PDF API: `/api/scan-results/:scanId/export.pdf`
- 진단 보고서는 퍼블릭 도메인 둥근모꼴+ Fixedsys TTF 단일 글꼴을 내장하며, 빌드 시 `dist/assets/fonts`로 복사하여 개발·프로덕션 환경에서 한글 표시·검색·복사를 지원
- 비짓제주 실제 v3 진단 보고서 PDF: A4 15페이지, 66,049바이트, 주요 문제 5건·전체 진단 25건·수집 페이지 1건 확인
- 진단 보고서는 PostgreSQL 공유 캐시에 저장하며 검사 결과·규칙 버전·완료 시각·렌더러·글꼴 변경 시 자동 무효화
- 실제 v3 보고서 최초 생성 922.99ms `MISS`, 반복 다운로드 10.24ms `HIT`, 다운로드본·DB 저장본 PDF SHA-256 일치 확인
- 렌더러 버전 `2026.06-scan-report-v3`와 글꼴 해시 변경으로 기존 v2 캐시가 자동 무효화·재생성됨을 확인
- 캐시 적중 시 저장 PDF의 크기와 SHA-256을 검증하고 손상된 저장본은 다시 생성
- 동일 보고서 동시 요청은 DB 생성 잠금으로 중복 생성을 방지함
- 브라우저 응답은 `Cache-Control: private, no-store`를 유지하며 기존 회원·조직·검사 소유권 검사를 먼저 수행함
- 현재 PostgreSQL PDF 저장은 공유 오브젝트 스토리지가 없는 개발 단계의 제한적 방식이며, Production에서는 Cloudinary 비공개 자산 저장으로 이전 예정
- 서버 시작 시 자동 검사 워커를 활성화하며, 기본 1초 간격으로 `QUEUED` 검사를 선점해 한 번에 한 건씩 순차 처리함 (`SCAN_WORKER_ENABLED`, `SCAN_WORKER_POLL_INTERVAL_MS`로 설정 가능)
- `playwright-core 1.55.0`과 Replit Nix의 Chromium을 사용해 JavaScript 실행 후 DOM을 비감점 비교 증거로 수집함
- 렌더링은 `RENDERED_DOM_ENABLED`, `CHROMIUM_PATH`, `RENDERED_DOM_TIMEOUT_MS`, `RENDERED_DOM_SETTLE_MS`로 제어하며 Chromium 부재·시간 초과·렌더링 오류가 QUICK 검사 전체를 실패시키지 않음
- 브라우저 요청은 공개 HTTP(S) 주소만 허용하고 사설·내부 주소, 비GET·HEAD 요청, 실시간 연결과 비필수 대용량 자원을 차단함
- 등록 사이트 화면은 대기·검사 중 상태에서만 자동 갱신하고 완료 후 폴링을 중지함
- Replit Preview: `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` 기반 허용 호스트 적용
- 확인일: 2026-06-16 KST

## 현재 개발 환경 Secrets

```text
DATABASE_URL
SESSION_SECRET
APP_BASE_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
SCAN_WORKER_ENABLED
SCAN_WORKER_POLL_INTERVAL_MS
RENDERED_DOM_ENABLED
CHROMIUM_PATH
RENDERED_DOM_TIMEOUT_MS
RENDERED_DOM_SETTLE_MS
```

`NODE_ENV`가 설정되지 않으면 애플리케이션 기본값인 `development`를 사용한다.

현재 개발 환경의 Resend 발신 설정:

```text
RESEND_FROM_EMAIL=no-reply@auth.siteaiscore.com
RESEND_FROM_NAME=Site AI Score
```

후속 외부 서비스 단계에서 다음 이름을 사용한다.

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
SUPER_ADMIN_ID
SUPER_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD_HASH
```

기존 Cloudinary 별칭도 향후 환경변수 로더에서 지원한다.

```text
Cloud_Name
Cloud_API_Key
Cloud_API_Secret
```

## 배포 전에 반드시 기록할 항목

- Development와 Production DB가 같은지 여부
- 각 환경의 DB 공급자와 DB 이름
- 마스킹된 DB 호스트
- 적용된 Prisma 마이그레이션
- Replit 배포 빌드·실행 명령
- Production용 `APP_BASE_URL`
- Production용 Resend 설정과 발신 도메인
- 배포 사이트에서 확인한 KST 날짜
