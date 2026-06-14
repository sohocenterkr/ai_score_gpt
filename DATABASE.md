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
| 마이그레이션 상태 | 1개 적용 완료 | 미실행 |
| 확인일(KST) | 2026-06-14 | 미확인 |

## Development 확인 기록

- `DATABASE_URL` Replit Secret 설정 확인
- PostgreSQL 연결 성공
- 최초 마이그레이션: `20260614055344_init_app_metadata`
- 생성 테이블: `_prisma_migrations`, `app_metadata`
- `prisma migrate status`: Database schema is up to date
- 확인 시각 기준: 2026-06-14 KST

## 초기 Prisma 모델

`AppMetadata` 모델만 포함한다. 인증·사이트·검사·작업지시서 모델은 각 개발 단계에서 마이그레이션으로 추가한다.

## DB 설정 후 확인

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
```

운영 배포에서는 `npm run db:deploy`를 사용한다.
