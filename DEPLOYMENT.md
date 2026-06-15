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
- `SESSION_SECRET`: Replit 환경에 32자 이상 설정 확인
- `APP_BASE_URL`: Replit Preview 공개 origin 설정 확인
- Resend API Key 설정 확인
- Resend 발신 도메인 `auth.siteaiscore.com` DNS Verified 확인
- 발신 주소: `Site AI Score <no-reply@auth.siteaiscore.com>`
- 실제 비밀번호 재설정 메일 발송·수신 확인
- 외부 공개 URL HTTP 수집과 DNS·리디렉션 SSRF 재검증 확인
- HTTP 수집 제한: 요청 15초, 최대 리디렉션 5회, 응답 본문 2MB
- 수동 검사 작업 실행 명령: `npm run scan:once`
- 자동 백그라운드 검사 실행기는 아직 구성하지 않음
- Replit Preview: `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` 기반 허용 호스트 적용
- 확인일: 2026-06-15 KST

## 현재 개발 환경 Secrets

```text
DATABASE_URL
SESSION_SECRET
APP_BASE_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
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
