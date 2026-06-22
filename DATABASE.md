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
| 마이그레이션 상태 | 6개 적용 완료 | 미실행 |
| 확인일(KST) | 2026-06-15 | 미확인 |

## Development 확인 기록

- `DATABASE_URL` Replit Secret 설정 확인
- PostgreSQL 연결 성공
- 최초 마이그레이션: `20260614055344_init_app_metadata`
- 인증 마이그레이션: `20260614062302_add_local_auth`
- 비밀번호 재설정 마이그레이션: `20260614070105_add_password_reset_tokens`
- 사이트·검사 기반 마이그레이션: `20260615042821_add_sites_scan_foundation`
- 작업지시서 마이그레이션: `20260615072844_add_work_orders`
- 진단 보고서 캐시 마이그레이션: `20260615121000_add_scan_report_cache`
- 생성 테이블: `_prisma_migrations`, `app_metadata`, `users`, `auth_accounts`, `sessions`, `password_reset_tokens`, `organizations`, `organization_members`, `sites`, `site_facts`, `scans`, `scan_pages`, `findings`, `work_orders`, `work_order_items`, `scan_report_caches`
- 사용자 역할·상태·인증 공급자 enum 적용
- 비밀번호 재설정 토큰은 원문이 아닌 HMAC-SHA256 해시만 저장
- 재설정 토큰은 30분 유효하며 사용·만료 여부를 기록
- 사이트·검사·페이지·규칙별 진단 증거와 검사 규칙 버전을 저장
- `scans.score`, `scans.grade`, `findings.score_delta`에 규칙 기반 점수 결과 저장
- 원본 HTML은 저장하지 않고 SHA-256 해시와 구조화된 증거만 저장
- 비짓제주 v1 초기 수집에서 `COMPLETED`, 페이지 1건, 진단 14건 저장 확인
- 비짓제주 v2 점수 검사에서 `2026.06-core-v2`, 71점, B등급, 페이지 1건, 진단 25건 저장 확인
- 비짓제주 발급 작업지시서 1건과 작업 항목 5건 저장 확인
- 작업지시서 번호·버전은 `(order_number, version)` 복합 유일키로 보호
- 작업 항목은 최초 진단, 대상 URL, 요구사항, 개발자 문구, 완료 기준 JSON과 배점을 저장
- 3-4B 작업지시서 PDF 출력은 실시간 생성 방식이며 별도 DB 모델·마이그레이션을 추가하지 않음
- 3-4C 진단 보고서 PDF는 기존 `Scan`, `ScanPage`, `Finding` 자료를 실시간 변환함
- 3-4D에서 완성된 PDF의 반복 다운로드를 위해 `ScanReportCache` 모델과 `scan_report_caches` 테이블을 추가함
- 캐시에는 검사별 보고서 종류, 결과 해시, 렌더러 버전, 글꼴 해시, 생성 상태, PDF `BYTEA`, PDF SHA-256, 파일 크기, 생성 토큰과 잠금 만료 시각을 저장함
- 검사 ID와 보고서 종류는 복합 유일키로 보호하며 검사 삭제 시 관련 캐시는 연쇄 삭제함
- 개발 단계에서는 공유 오브젝트 스토리지가 없어 약 48~62KB의 PDF를 PostgreSQL에 제한적으로 저장함
- Production Cloudinary 비공개 자산 저장이 구성되면 PDF 바이너리를 외부 저장소로 이전하고 DB에는 메타데이터만 남길 수 있도록 캐시 서비스를 분리함
- 마이그레이션 전후 사이트 1건, 검사 3건, 페이지 2건, 진단 39건, 작업지시서 1건, 작업 항목 5건이 그대로 유지됨
- 실제 v1·v2 진단 보고서 캐시 2건이 `READY` 상태로 저장되고 PDF 크기와 SHA-256 일치 확인
- `prisma migrate status`: Database schema is up to date
- 확인 시각 기준: 2026-06-16 KST

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
- `WorkOrder`
- `WorkOrderItem`
- `ScanReportCache`

배포 제출·자동검수·전후 비교 모델은 각 개발 단계에서 마이그레이션으로 추가한다.

## DB 설정 후 확인

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
```

운영 배포에서는 `npm run db:deploy`를 사용한다.


## 외부 Supabase DB 이전 절차

2026-06-22 기준, 기존 Replit PostgreSQL의 테이블 이름과 구조를 유지한 채 외부 Supabase PostgreSQL로 이전할 수 있도록 일회성 이전 도구를 둔다.

원칙:

- 실제 DB URL과 비밀번호는 Git, Markdown, 로그에 기록하지 않는다.
- Cloudinary 파일/이미지 저장 코드는 변경하지 않는다.
- 이전 중에는 기존 Replit DB를 source, Supabase DB를 target으로 분리한다.
- target DB에는 Prisma migration으로 같은 구조를 만든 뒤, source의 앱 데이터를 data-only dump/restore 방식으로 옮긴다.
- `_prisma_migrations` 데이터는 dump 대상에서 제외하고, target에서는 Prisma migration deploy 결과를 사용한다.

명령:

```bash
npm run db:supabase:preflight
npm run db:supabase:apply-schema
npm run db:supabase:dump
npm run db:supabase:restore
npm run db:supabase:verify
```

필요 환경변수:

```text
SOURCE_DATABASE_URL
TARGET_DATABASE_URL
```

`SOURCE_DATABASE_URL`이 없으면 현재 `DATABASE_URL`을 source로 사용한다. 최종 전환 시에는 Replit Secrets의 `DATABASE_URL`을 검증 완료된 Supabase 앱 연결 문자열로 교체한다.

