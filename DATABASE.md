# DATABASE.md

## 원칙

- 개발 DB와 배포 DB가 다를 수 있다.
- 실제 비밀번호가 포함된 전체 DB URL을 이 문서나 Git에 기록하지 않는다.
- 실제 값은 Replit Secrets의 `DATABASE_URL`에만 저장한다.
- 애플리케이션의 날짜·시간 계산과 표시는 KST를 기준으로 한다.

## 현재 상태

| 항목 | Development | Production |
|---|---|---|
| 공급자 | Replit 제공 PostgreSQL | 확인 필요 |
| DB 이름 | `heliumdb` | 확인 필요 |
| 마스킹 호스트 | `he**um` | 확인 필요 |
| Secret 이름 | `DATABASE_URL` | `DATABASE_URL` |
| 마이그레이션 상태 | 4개 적용 완료 | 미실행 |
| 확인일(KST) | 2026-06-15 | 미확인 |

## Development 확인 기록

- `DATABASE_URL` Replit Secret 설정 확인
- PostgreSQL 연결 성공
- 최초 마이그레이션: `20260614055344_init_app_metadata`
- 인증 마이그레이션: `20260614062302_add_local_auth`
- 비밀번호 재설정 마이그레이션: `20260614070105_add_password_reset_tokens`
- 사이트·검사 기반 마이그레이션: `20260615042821_add_sites_scan_foundation`
- 생성 테이블: `_prisma_migrations`, `app_metadata`, `users`, `auth_accounts`, `sessions`, `password_reset_tokens`, `organizations`, `organization_members`, `sites`, `site_facts`, `scans`, `scan_pages`, `findings`
- 사용자 역할·상태·인증 공급자 enum 적용
- 비밀번호 재설정 토큰은 원문이 아닌 HMAC-SHA256 해시만 저장
- 재설정 토큰은 30분 유효하며 사용·만료 여부를 기록
- 사이트·검사·페이지·규칙별 진단 증거와 검사 규칙 버전을 저장
- `scans.score`, `scans.grade`, `findings.score_delta`에 규칙 기반 점수 결과 저장
- 원본 HTML은 저장하지 않고 SHA-256 해시와 구조화된 증거만 저장
- 비짓제주 v1 초기 수집에서 `COMPLETED`, 페이지 1건, 진단 14건 저장 확인
- 비짓제주 v2 점수 검사에서 `2026.06-core-v2`, 71점, B등급, 페이지 1건, 진단 25건 저장 확인
- `prisma migrate status`: Database schema is up to date
- 확인 시각 기준: 2026-06-15 KST

## 현재 Prisma 모델

- `AppMetadata`
- `User`
- `AuthAccount`
- `Session`
- `PasswordResetToken`
- `Organization`
- `OrganizationMember`
- `Site`
- `SiteFact`
- `Scan`
- `ScanPage`
- `Finding`

작업지시서·보고서·자동검수 모델은 각 개발 단계에서 마이그레이션으로 추가한다.

## DB 설정 후 확인

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
```

운영 배포에서는 `npm run db:deploy`를 사용한다.
