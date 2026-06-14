# DEPLOYMENT.md

## 현재 상태

- 개발 환경: Replit
- 프로젝트 루트: `/home/runner/workspace`
- 개발 포트: `5000`
- 운영 배포: 아직 구성하지 않음
- 공식 도메인: `siteaiscore.com`
- GitHub origin: 아직 연결되지 않음
- 개발 DB: Replit 제공 PostgreSQL `heliumdb` 연결 확인
- 개발 DB 마이그레이션:
  - `20260614055344_init_app_metadata`
  - `20260614062302_add_local_auth`
- `SESSION_SECRET`: Replit 환경에 32자 이상 설정 확인
- Replit Preview: `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` 기반 허용 호스트 적용
- 확인일: 2026-06-14 KST

## 현재 필요한 기본 Secrets 이름

```text
DATABASE_URL
SESSION_SECRET
APP_BASE_URL
NODE_ENV
```

외부 서비스 단계에서 다음 이름을 사용한다.

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
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
- 배포 사이트에서 확인한 KST 날짜
