# Site AI Score 최종 개발 프롬프트 및 통합 기능 기획서

- 문서 버전: 1.0
- 기준일: 2026-06-14 KST
- 공식 서비스명: **Site AI Score**
- 공식 도메인: **siteaiscore.com**
- GitHub 저장소: `https://github.com/sohocenterkr/*****`
- 개발·배포 환경: Replit
- 대상: 이 문서를 처음 읽는 AI 개발자, 주니어 개발자, 디자이너, QA

---

# 0. 이 문서를 받은 개발자에게

당신은 Site AI Score의 개발 파트너다. 사용자는 엔지니어가 아니며 코드를 직접 작성하지 않는다. 사용자가 Replit Shell에서 당신이 제공한 명령을 실행하고 결과를 전달한다.

다음 원칙을 반드시 지킨다.

1. Replit이나 GitHub에 직접 접속하려고 하지 않는다. 사용자가 당신의 손이다.
2. Replit Shell에서 실행할 명령을 한 이슈 단위로 제공한다.
3. 사용자가 이전 명령의 실행 결과를 회신하지 않았다면 실행하지 않은 것으로 간주한다.
4. 이전 단계의 실제 결과를 받기 전에 다음 수정 단계로 넘어가지 않는다.
5. 확실하지 않은 정보는 `확인이 필요합니다` 또는 `정확하지 않을 수 있습니다`라고 명시한다.
6. 추측한 내용을 사실처럼 말하지 않는다.
7. 한 기능을 구현하기 위해 다른 기능을 삭제·비활성화·변경하지 않는다.
8. 기존 기능 변경이 불가피하면 이유와 영향을 먼저 설명하고 사용자 승인을 받은 뒤 진행한다.
9. 등록 기능을 만들면 반드시 조회·수정·삭제 기능도 함께 만든다.
10. 모든 화면과 기능은 모바일·태블릿·PC에서 동작해야 한다.
11. 모든 날짜와 시간 계산·저장·표시는 KST(UTC+9)를 기준으로 한다.
12. 테스트를 요청할 때 `개발모드에서`인지 `배포 후 배포된 사이트에서`인지 반드시 명시한다.
13. 코드 수정 후 가능한 경우 타입검사 → 테스트 → 빌드 → git add → commit → push → `git status -sb`까지 처리한다.
14. 완료 보고 시 수정 파일, 검사 결과, 커밋 해시, Git 상태, 개발모드 확인사항, 배포 후 확인사항, 기존 기능 변경 여부를 알린다.

## 긴 코드 수정 방식

수정 범위가 길거나 여러 파일을 동시에 수정해야 하면 긴 코드를 채팅에 여러 조각으로 나누지 않는다. `.cjs` 패치 파일을 만들어 **업로드형 단일 실행 패치 스크립트 방식**으로 진행한다.

순서:

1. `.cjs` 패치 파일 제공
2. 사용자가 프로젝트 루트에 업로드
3. 업로드 확인
4. `node --check 패치파일.cjs` 문법 검사
5. 패치 실행
6. 변경 파일 확인
7. 타입검사·테스트·빌드
8. 스테이징·커밋·푸시·Git 상태 확인

패치 스크립트는 대상 파일 존재 여부, 기존 코드 정확한 일치, 중복 적용 여부를 먼저 검사해야 한다. 예상한 코드가 없거나 여러 번 발견되면 어떤 파일도 수정하지 말고 종료해야 한다.

---

# 1. 개발 시작 절차

이 프롬프트를 받은 뒤 바로 코드를 작성하지 말고 먼저 프로젝트 상태를 확인한다.

## 첫 번째 응답에서 할 일

사용자에게 프로젝트 루트에서 실행할 **조회 전용 명령 한 묶음**을 제공한다. 최소한 다음을 확인한다.

- 현재 경로
- 프로젝트 파일 목록
- 루트 Markdown 문서
- `package.json`
- Git 연결 상태
- 현재 브랜치와 변경 파일
- Node.js와 npm 버전
- 기존 프레임워크 여부

예시 목적:

```bash
pwd
printf '\n===== root files =====\n'
find . -maxdepth 2 -type f | sort | sed -n '1,240p'
printf '\n===== markdown files =====\n'
find . -maxdepth 1 -type f -name '*.md' -print -exec sh -c 'echo "--- $1"; sed -n "1,220p" "$1"' _ {} \;
printf '\n===== package.json =====\n'
[ -f package.json ] && cat package.json || true
printf '\n===== git status =====\n'
git status -sb 2>/dev/null || true
printf '\n===== remotes =====\n'
git remote -v 2>/dev/null || true
printf '\n===== versions =====\n'
node -v 2>/dev/null || true
npm -v 2>/dev/null || true
```

사용자가 결과를 전달하면 실제 프로젝트 상태에 맞춰 다음 단계를 제시한다.

## 시작 전에 확인해야 하는 미확정 사항

다음 값이 아직 `*****` 또는 미정이면 사용자에게 확인해야 한다.

1. GitHub 저장소의 실제 이름
2. 최초 공개 언어 목록
3. 결제 공급자
4. 최초 지원 업종
5. Cloudinary 허용 파일 형식과 최대 크기

단, 이 질문을 한꺼번에 반복해서 묻지 않는다. 현재 구현 단계에 필요한 값만 확인한다.

---

# 2. 제품 정의

## 2.1 한 문장 정의

**Site AI Score는 웹사이트가 AI에게 얼마나 잘 읽히고 이해되는지 진단하고, 수정 작업지시서를 만들며, 웹개발 에이전시가 수정한 운영 URL을 다시 자동검수하여 개선 전후를 증명하는 AEO 진단·검증 플랫폼이다.**

## 2.2 AEO 의미

AEO(Answer Engine Optimization)는 AI 검색엔진이 사용자의 질문에 답변을 생성할 때 콘텐츠가 출처나 정답으로 활용되기 쉽도록 사이트의 기술 구조와 콘텐츠를 개선하는 전략이다.

이 서비스는 실제 AI 추천 순위를 보장하지 않는다. 다음을 측정한다.

- AI 검색봇이 사이트에 접근할 수 있는가
- 핵심정보가 초기 HTML에 존재하는가
- JavaScript, iframe, 이미지 때문에 정보가 숨겨지는가
- 업체명, 서비스, 주소, 가격, 영업시간 등을 정확히 추출할 수 있는가
- 구조화 데이터와 화면 정보가 일치하는가
- 예상 고객 질문에 사이트 내용만으로 답할 수 있는가
- 수정 전후 AI 친화도가 얼마나 달라졌는가
- 에이전시가 작업지시서의 완료 기준을 충족했는가

## 2.3 해결할 문제

사이트 운영자는 보통 다음을 알기 어렵다.

- AI가 사이트를 읽을 수 있는지
- 화면의 정보가 크롤러에게도 보이는지
- 무엇을 수정해야 하는지
- 개발업체에 어떤 형태로 요청해야 하는지
- 수정이 제대로 배포됐는지
- 수정 후 점수가 실제로 얼마나 개선됐는지
- 점수가 오르지 않았을 때 진단 문제인지 구현 문제인지

Site AI Score는 다음 흐름을 하나로 연결한다.

```text
URL 입력
  → 무료 간편진단
  → 유료 정밀진단
  → 문제별 수정 작업지시서 발급
  → 기존 개발자에게 전달 또는 제휴 에이전시 연결
  → 에이전시 수정·배포
  → 작업지시서 ID + 배포 URL로 자동검수
  → 실패 항목 재수정
  → 수정 전후 비교 및 자동검수 확인서
  → 정기 모니터링
```

---

# 3. 제품 원칙과 범위

## 3.1 반드시 지킬 원칙

1. 고객 사이트의 소스코드를 요구하지 않는다.
2. 고객 사이트를 직접 수정하거나 배포하지 않는다.
3. 실제 공개 URL에서 확인되는 결과를 기준으로 검사한다.
4. 모든 감점과 실패에는 URL, 검사값, 증거가 있어야 한다.
5. 점수와 pass/fail은 규칙 기반으로 계산한다.
6. LLM은 요약과 쉬운 설명에 사용하되 최종 점수를 임의로 결정하지 않는다.
7. 검색용 봇과 학습용 봇을 구분한다.
8. 수정 전후 비교는 같은 규칙 버전과 같은 조건으로 실행한다.
9. AI 친화도와 실제 AI 추천·인용 노출은 분리한다.
10. 에이전시 평가는 종합점수만이 아니라 작업 이행률과 회귀 안전성으로 한다.

## 3.2 MVP 필수 범위

- 모바일 우선 반응형 UI
- 768px 이하 Edge-to-edge / Full-bleed
- URL 기반 다국어 구조
- 이메일/PW 가입·로그인
- Google 가입·로그인
- 동일 이메일 계정 연결
- Resend 비밀번호 재설정
- 즉시 회원탈퇴와 개인 데이터 삭제
- 총관리자 전용 로그인
- 관리자 회원관리
- 공지사항 팝업 CRUD
- Cloudinary 파일 업로드·삭제
- 사이트 등록과 기준정보
- 무료 간편진단
- 정밀진단
- AI 친화도 점수
- 문제 상세와 증거
- 수정 작업지시서
- 에이전시 작업함
- URL 기반 수정 검수
- 전후 비교
- 자동검수 확인서
- 관리자 검사·규칙·에이전시·이의신청 관리

## 3.3 후속 기능

- 정기 모니터링
- 경쟁사 비교
- 에이전시용 공개 REST API와 웹훅
- 에이전시 구독과 사용량 과금
- 에이전시 품질등급
- 실제 AI 검색 언급·인용 모니터링
- 결제 시스템

## 3.4 하지 않는 기능

- 고객 사이트 직접 수정
- GitHub 저장소 제출 강제
- 자동 배포
- 고객과 에이전시 사이의 수정비 결제 중개
- 모든 CMS 자동수정
- ChatGPT·Gemini의 추천 순위 보장
- 사이트 전체 보안이나 모든 코드 품질 보증

---

# 4. 권장 기술 구조

기존 프로젝트가 비어 있을 때의 권장 기본값이다. 기존 프로젝트가 이미 있으면 임의로 갈아엎지 말고 현재 구조를 먼저 분석한다.

## 4.1 권장 스택

- 언어: TypeScript
- 프론트엔드: React + Vite
- 백엔드: Node.js + Express
- DB: PostgreSQL
- ORM: Prisma
- 인증: 서버 세션 + HttpOnly Cookie
- 비밀번호 해시: Argon2 우선, 불가하면 bcrypt
- 브라우저 검사: Playwright
- 파일 저장: Cloudinary
- 이메일: Resend
- 다국어: URL locale + locale JSON 파일
- 유효성 검사: Zod
- 테스트: Vitest + Supertest + Playwright E2E
- 스타일: 모바일 우선 CSS 또는 Tailwind 중 기존 프로젝트에 맞는 방식

## 4.2 검사 작업 큐

MVP에서는 외부 Redis를 필수로 만들지 않는다.

- `scan_jobs` 또는 `scans` 테이블의 상태를 이용한 PostgreSQL 기반 작업 큐를 만든다.
- 별도 worker 프로세스가 `queued` 작업을 가져가 처리한다.
- 동시에 같은 작업을 중복 처리하지 않도록 DB lock 또는 atomic update를 사용한다.
- 운영 규모가 커지면 Redis/BullMQ로 교체할 수 있도록 service interface를 분리한다.

## 4.3 애플리케이션 구성

```text
브라우저
  ├─ 공개 사이트
  ├─ 고객 대시보드
  ├─ 에이전시 대시보드
  └─ 관리자 대시보드
        ↓
Express API
  ├─ 인증/권한
  ├─ 회원/공지/파일
  ├─ 사이트/기준정보
  ├─ 검사/점수/보고서
  ├─ 작업지시서/검수
  └─ 관리자
        ↓
PostgreSQL + Cloudinary + Resend
        ↓
Scan Worker
  ├─ HTTP fetch
  ├─ User-Agent fetch
  ├─ Playwright
  ├─ DOM/JSON-LD/robots 분석
  ├─ 규칙 엔진
  └─ 결과·증거 저장
```

---

# 5. Replit·GitHub·배포 운영

## 5.1 GitHub 연결

사용자는 빈 Replit 프로젝트를 만들고 GitHub PAT를 이용하여 Replit Shell에서 직접 Git 명령으로 저장소에 연결한다. 실제 저장소 URL이 확정되기 전에는 임의의 저장소를 만들거나 연결하지 않는다.

## 5.2 개발 DB와 배포 DB

Replit 개발 환경과 배포 환경의 DB가 다를 수 있다.

배포 후 반드시 다음을 확인하고 문서화한다.

- development와 production의 DB가 같은지 다른지
- 각 환경이 사용하는 Secret 이름
- DB 공급자와 DB 이름
- 마스킹된 호스트
- 마이그레이션 상태
- 확인한 KST 날짜

`DEPLOYMENT.md`와 `DATABASE.md`를 프로젝트 루트에 유지한다.

실제 비밀번호가 포함된 전체 DB URL은 Markdown이나 Git에 기록하지 않는다. 실제 값은 Replit Secrets에만 저장한다.

## 5.3 필수 루트 문서

- `AGENTS.md`: 협업 및 수정 규칙
- `README.md`: 실행 방법
- `SITEAISCORE_FINAL_DEVELOPMENT_PROMPT.md`: 이 문서
- `DATABASE.md`: 개발/배포 DB 구분
- `DEPLOYMENT.md`: 배포 상태와 Secrets 이름
- `CHANGELOG.md`: 주요 변경사항

---

# 6. Secrets와 환경변수

비밀값을 코드, 로그, GitHub에 출력하거나 저장하지 않는다.

## 6.1 기본

```text
DATABASE_URL
SESSION_SECRET
APP_BASE_URL
NODE_ENV
```

## 6.2 Google OAuth

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

## 6.3 Resend

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
```

## 6.4 Cloudinary

사용자가 현재 Replit Secrets에 다음 이름을 등록했다.

```text
Cloud_Name
Cloud_API_Key
Cloud_API_Secret
```

새 표준 이름도 지원할 수 있도록 환경변수 로더에서 별칭을 허용한다.

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

우선순위:

```text
CLOUDINARY_CLOUD_NAME ?? Cloud_Name
CLOUDINARY_API_KEY ?? Cloud_API_Key
CLOUDINARY_API_SECRET ?? Cloud_API_Secret
```

값은 절대 로그에 출력하지 않는다.

## 6.5 총관리자

```text
SUPER_ADMIN_ID
SUPER_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD_HASH
```

총관리자 이메일:

```text
sohocenter.kr@gmail.com
```

비밀번호 원문보다 Argon2 또는 bcrypt 해시를 Secret에 저장한다. 총관리자는 Google 로그인을 사용하지 않는다.

---

# 7. 다국어 URL 구조

모든 사용자 화면은 URL 경로 기반 locale을 사용한다.

```text
/{locale}
/{locale}/login
/{locale}/signup
/{locale}/forgot-password
/{locale}/dashboard
/{locale}/sites
/{locale}/sites/{siteId}
/{locale}/scans/{scanId}
/{locale}/work-orders/{workOrderId}
/{locale}/agency/jobs
/{locale}/agency/verifications/{verificationId}
/{locale}/certificates/{publicCode}
/{locale}/admin
```

API에는 locale을 넣지 않는다.

```text
/api/auth/login
/api/sites
/api/scans
/api/admin/notices
```

규칙:

- `/`는 설정된 기본 언어로 이동한다.
- 언어를 바꿔도 같은 리소스 ID를 유지한다.
- 번역문은 locale 파일에 저장한다.
- 날짜와 숫자는 언어 형식에 맞게 표시하되 시간대는 항상 KST다.
- 초기 지원 언어는 사용자 확인 후 설정값으로 활성화한다.
- 공개 페이지는 locale별 canonical과 `hreflang`을 지원한다.

---

# 8. 모바일 우선 UI/UX

## 8.1 브레이크포인트

```text
모바일: 0~768px
태블릿: 769~1023px
데스크톱: 1024px 이상
```

CSS는 mobile-first로 작성하며 `min-width` 미디어쿼리로 확장한다.

## 8.2 768px 이하 Edge-to-edge / Full-bleed

모바일에서는 반드시 다음을 지킨다.

- 주요 섹션은 화면 전체 너비를 사용한다.
- 본문 카드 컨테이너의 border, border-radius, 좌우 margin을 제거한다.
- 내용 가독성을 위한 내부 좌우 padding은 기본 16px을 사용한다.
- 섹션 구분은 16~24px 여백 또는 배경색 차이로 처리한다.
- 목록 구분은 하단 divider를 사용할 수 있으나 사방 카드로 만들지 않는다.
- 데스크톱의 표는 모바일에서 세로 목록 행으로 바꾼다.
- 모달은 가능한 경우 full-width bottom sheet로 바꾼다.
- 주요 터치 영역은 최소 44×44px, 주요 버튼과 입력창은 최소 48px 높이로 한다.
- hover에만 의존하는 기능을 만들지 않는다.
- 하단 고정 CTA는 safe area를 반영하고 본문을 가리지 않는다.

## 8.3 전역 내비게이션

### 공개 사이트

- 로고
- 언어 변경
- 메뉴 버튼
- 모바일 메뉴는 drawer 또는 full-height sheet

### 고객 하단 내비게이션

- 홈
- 사이트
- 작업
- 보고서
- 더보기

### 에이전시 하단 내비게이션

- 작업함
- 검수
- 확인서
- 더보기

### 관리자

관리자 기능이 많으므로 모바일 하단 탭을 사용하지 않고 상단 메뉴 drawer를 사용한다.

## 8.4 공통 상태

모든 비동기 기능은 다음 상태를 제공한다.

- idle
- queued
- running
- success
- partial
- empty
- error

중복 제출을 막고, 로딩·빈 상태·오류·재시도 UI를 구현한다.

---

# 9. 사용자와 권한

## 9.1 역할

```text
USER
AGENCY
SUPER_ADMIN
```

필요하면 조직 내 역할을 별도로 둔다.

```text
OWNER
ADMIN
MEMBER
```

## 9.2 권한 원칙

- 프론트 메뉴 숨김만으로 권한을 보호하지 않는다.
- 모든 API에서 서버 미들웨어가 사용자, 역할, 리소스 소유권을 다시 검사한다.
- 다른 고객·에이전시의 사이트, 검사, 작업지시서, 파일에 접근할 수 없어야 한다.
- SUPER_ADMIN은 모든 기능을 테스트할 수 있지만 감사로그를 남긴다.

---

# 10. 회원가입·로그인·세션

## 10.1 일반 가입

로그인 ID는 **이메일 주소**다. 별도 사용자명이나 ID 필드를 만들지 않는다.

필수 입력:

- 이메일
- 이름
- 비밀번호
- 비밀번호 확인
- 이용약관 동의
- 개인정보처리방침 동의

전화번호는 수집하지 않는다.

규칙:

- 이메일은 전체 사용자 중 고유하다.
- 이메일 형식을 프론트와 서버에서 검증한다.
- 비밀번호는 해시만 저장한다.
- 비밀번호 원문을 로그에 기록하지 않는다.
- 이메일 인증 상태 필드를 둔다.
- 세션은 HttpOnly, Secure(운영), SameSite 쿠키로 관리한다.
- 로그인 성공 시 `login_count`를 1 증가하고 `last_login_at`을 KST 시각으로 갱신한다.

## 10.2 Google 로그인

흐름:

1. 사용자가 Google 로그인 버튼을 누른다.
2. 서버가 Google 토큰을 검증한다.
3. Google subject ID와 검증된 이메일을 읽는다.
4. 이미 연결된 Google 계정이면 로그인한다.
5. 같은 이메일의 일반 계정이 있으면 새 계정을 만들지 않는다.
6. 기존 계정 비밀번호로 본인을 확인한다.
7. Google 계정을 기존 계정에 연결한다.
8. 같은 이메일 계정이 없으면 Google 전용 계정을 생성한다.

Google 이메일이 아니라 subject ID를 `provider_account_id`로 저장한다.

## 10.3 비밀번호 재설정

Resend로 새 비밀번호를 보내지 않고 30분짜리 일회용 재설정 링크를 보낸다.

- 계정 존재 여부와 관계없이 동일한 안내를 표시한다.
- DB에는 토큰 원문이 아닌 해시만 저장한다.
- 토큰은 1회 사용 후 즉시 무효화한다.
- 변경 후 모든 기존 세션을 종료한다.
- Google 전용 계정은 Google 로그인 안내를 보여준다.
- 요청 횟수 제한을 적용한다.

## 10.4 계정 비활성화

관리자가 계정을 정지하면:

- 신규 로그인 차단
- 기존 세션 즉시 무효화
- API 키 중지
- 예약된 검사 중지
- 데이터는 유지
- 정지 사유와 관리자 기록 저장

---

# 11. 회원탈퇴

탈퇴는 유예 없이 즉시 처리한다. 실수를 막기 위해 강한 확인 절차를 사용한다.

## 11.1 탈퇴 화면

순서:

1. 삭제되는 데이터 목록
2. 복구할 수 없다는 안내
3. 필요한 보고서와 자료는 각 화면에서 미리 저장하라는 안내
4. 일반 회원은 현재 비밀번호 재입력
5. Google 전용 회원은 Google 재인증
6. 확인 문구 직접 입력
7. 최종 탈퇴 버튼

확인 문구 예:

```text
회원탈퇴 및 데이터 삭제에 동의합니다
```

## 11.2 삭제 대상

- 회원 프로필
- 인증 계정 연결
- 세션
- 개인 소유 사이트
- 기준정보
- 검사 결과와 증거
- 작업지시서
- 검수 결과
- 보고서와 확인서
- API 키
- 알림 설정
- 개인 소유 Cloudinary 파일

다음은 별도 처리한다.

- 법령상 보관해야 하는 거래 기록
- 다른 회원이 공동으로 소유한 조직 데이터
- 정산 관련 법적 기록

이 경우 개인정보를 최소화하거나 익명화한다.

별도의 전체 ZIP 내보내기 기능은 만들지 않는다.

---

# 12. 총관리자

## 12.1 로그인

- 경로: `/{locale}/admin/login`
- Google 로그인 사용 안 함
- Replit Secrets의 ID와 비밀번호 해시로 검증
- DB에는 SUPER_ADMIN 고정 사용자 레코드를 두되 비밀번호는 저장하지 않음
- 모든 관리자 API는 서버 미들웨어로 `SUPER_ADMIN` 세션을 검사

## 12.2 사이트 이동과 테스트 모드

관리자 페이지에 `사이트로 이동` 버튼을 둔다.

- 동일 세션으로 `/{locale}/dashboard`로 이동
- 다시 로그인하지 않음
- 모든 유료 기능 무료
- 사용량 제한 없음
- 화면에 `총관리자 테스트 모드` 배너 표시

내부 권한 계산 예:

```text
role = SUPER_ADMIN
effectivePlan = ENTERPRISE
usageLimit = UNLIMITED
```

실제 외부 API·Cloudinary·Resend 비용은 발생할 수 있다.

---

# 13. 관리자 기능

## 13.1 대시보드

표시:

- 총 회원 수
- 활성/정지 회원 수
- 오늘 가입
- 실행 중 검사
- 실패 검사
- 등록 사이트 수
- 에이전시 수
- 처리 대기 이의신청
- 최근 공지
- 시스템 오류 요약

## 13.2 회원관리

표시 항목:

- 회원번호
- 로그인 방식
- 이메일
- 이름
- 가입일
- 접속 횟수
- 최종 접속일
- 계정 상태

기능:

- 이름 또는 이메일 검색
- 상태·로그인 방식 필터
- 상세 조회
- 비활성화·해제
- 세션 강제 종료
- 회원 삭제

모바일에서는 표 대신 full-width 목록 행을 사용한다.

### 관리자 회원 삭제

1. 삭제 데이터 안내
2. 대상 회원 이메일 직접 입력
3. 삭제 사유 입력
4. 총관리자 비밀번호 재입력
5. 최종 확인
6. 개인 소유 데이터와 Cloudinary 자산 즉시 삭제
7. 감사로그 저장

비밀번호가 틀리면 삭제하지 않는다.

감사로그에는 삭제된 사용자의 이메일을 장기 보관하지 않고 식별자 해시를 남긴다.

## 13.3 공지사항 팝업

CRUD를 모두 지원한다.

필드:

- 제목
- 내용
- 시작일시
- 종료일시
- 활성 여부
- 우선순위
- 버전
- 이미지(선택)
- 버튼 문구(선택)
- 이동 URL(선택)
- 새 창 여부

날짜 규칙(KST):

- 시작·종료 없음: 영구 게시
- 시작만 있음: 시작일부터 무기한
- 종료만 있음: 즉시 게시 후 종료일까지
- 둘 다 있음: 기간 내 게시
- 종료 날짜는 해당일 23:59:59 KST 포함

여러 공지가 활성화되면 우선순위가 가장 높은 1개만 팝업으로 표시한다.

모바일 팝업은 bottom sheet가 기본이다.

`오늘은 더 이상 보지 않기`:

- 공지 ID와 버전별 쿠키
- KST 다음 자정에 만료
- 내용이 중요하게 수정되면 버전 증가로 다시 표시

공지 HTML을 허용할 경우 XSS 정제를 적용한다.

## 13.4 기타 관리자

- 검사 작업 큐 관리
- 실패 검사 재시도
- 규칙 및 배점 관리
- AI/검색봇 목록 관리
- 에이전시 승인·정지·전문분야 관리
- 소개 이력과 수수료 상태
- 이의신청과 재검사 판정
- Cloudinary 파일과 고아 자산 관리
- 감사로그 조회

---

# 14. Cloudinary

## 14.1 저장 원칙

- 실제 파일은 Cloudinary에 저장
- DB에는 URL과 메타데이터만 저장
- DB에 파일 바이너리를 넣지 않음
- API Secret은 서버에서만 사용
- 클라이언트 업로드는 서버가 signed upload 정보를 발급

사용 대상:

- 공지 이미지
- 검사 스크린샷
- PDF 보고서
- 자동검수 확인서
- 프로필 이미지가 추가될 경우
- 사용자가 업로드하는 허용 파일

DB 메타데이터:

- public_id
- resource_type
- secure_url
- 원본 파일명
- MIME type
- size_bytes
- owner_user_id
- related_type
- related_id
- created_at
- deleted_at

삭제는 DB와 Cloudinary 실제 자산을 함께 처리한다. 둘 중 하나가 실패하면 재시도 가능한 상태로 남기고 관리자에게 표시한다.

---

# 15. 사이트 등록과 기준정보

## 15.1 사이트 등록

입력:

- 사이트명
- 대표 URL
- 업종
- 국가·지역
- 기본 언어
- 중요 페이지(선택)

URL 처리:

- `example.com` 입력 시 `https://` 보완 시도
- 최종 리디렉션 URL 저장
- 공개 HTTP/HTTPS만 허용
- 사설 IP, localhost, 내부망, 클라우드 메타데이터 차단

## 15.2 기준정보

사용자가 정답으로 제공하는 정보다.

공통 예:

- 업체명
- 설명
- 서비스명
- 주소
- 이메일
- 영업시간
- 휴무일
- 가격
- 예약·문의 방법
- 주요 특징

전화번호는 회원정보에서는 수집하지 않지만, 분석 대상 사이트의 사업정보로는 입력할 수 있다.

업종별 기준정보 템플릿을 지원한다.

---

# 16. 검사 종류와 상태

## 16.1 검사 종류

- `QUICK`: 대표 URL 무료 간편진단
- `DEEP`: 여러 페이지 정밀진단
- `VERIFICATION`: 수정 작업 자동검수
- `MONITORING`: 정기 모니터링(후속)

## 16.2 상태

```text
QUEUED
RUNNING
COMPLETED
PARTIAL
FAILED
CANCELLED
```

## 16.3 검사 흐름

1. URL 보안검사
2. 중복 작업 확인
3. 검사 job 생성
4. HTTP 수집
5. 봇 User-Agent 수집
6. Playwright 렌더링
7. DOM·iframe·스크립트 분석
8. robots·meta·JSON-LD 분석
9. 핵심정보 추출
10. 규칙 평가
11. 점수 계산
12. 요약 생성
13. 결과 저장
14. UI와 알림 갱신

---

# 17. 페이지 검사 엔진

## 17.1 일반 HTTP 검사

수집:

- 상태 코드
- 최종 URL
- 응답 헤더
- Content-Type
- HTML 크기
- 초기 HTML 텍스트
- canonical
- robots meta
- title
- meta description
- heading
- 링크
- JSON-LD
- iframe

## 17.2 봇별 요청

최소 검사 User-Agent:

- OAI-SearchBot
- GPTBot
- Claude-SearchBot
- ClaudeBot
- Googlebot
- Bingbot
- PerplexityBot

검색용과 학습용을 UI에서 분리한다. 학습용 봇 차단은 운영자 선택이며 자동 감점하지 않는다.

robots.txt 허용과 실제 HTTP 응답을 모두 비교한다.

예:

> robots.txt에서는 OAI-SearchBot을 허용하지만 실제 요청은 WAF에서 403으로 차단됩니다.

## 17.3 Playwright 검사

- JavaScript 실행 후 최종 DOM
- 화면에 실제 보이는 텍스트
- 모바일·데스크톱 뷰포트
- iframe 목록과 접근 가능 여부
- 네트워크 실패
- console error
- 버튼과 링크
- 접근성 트리
- 스크린샷
- 클릭·스크롤·탭 이후 나타나는 정보

CAPTCHA나 로그인 우회를 시도하지 않는다. 감지 사실만 보고한다.

## 17.4 구조화 데이터

- JSON 문법
- Schema type
- 필수·권장 속성
- 중복·충돌
- 실제 화면과의 일치
- URL·날짜·가격 형식

`llms.txt`는 참고정보로 표시하되 핵심 배점에 크게 반영하지 않는다.

## 17.5 핵심정보 추출

초기 HTML, 렌더링 DOM, JSON-LD에서 별도로 추출하고 출처를 기록한다.

판정:

```text
MATCH
PARTIAL_MATCH
MISSING
CONFLICT
INCORRECT
NOT_APPLICABLE
```

---

# 18. AI 친화도 점수

총점 100점.

| 영역 | 배점 |
|---|---:|
| 접근 및 수집 정책 | 15 |
| 콘텐츠 읽기 용이성 | 20 |
| 정보 구조와 의미 전달 | 15 |
| 핵심정보 인식 정확도 | 20 |
| 콘텐츠 이해 및 답변 가능성 | 15 |
| AI 에이전트 사용 가능성 | 10 |
| 최신성 및 측정 환경 | 5 |

## 18.1 대표 지표

### 초기 HTML 핵심정보 포함률

```text
초기 HTML에서 확인된 핵심정보 수 ÷ 최종 화면 핵심정보 수 × 100
```

### iframe 핵심정보 의존률

```text
iframe에만 존재하는 핵심정보 수 ÷ 전체 핵심정보 수 × 100
```

### 상호작용 의존률

```text
클릭·스크롤·탭 후에만 나타나는 핵심정보 수 ÷ 전체 핵심정보 수 × 100
```

### 핵심정보 인식률

```text
정확히 추출한 기준정보 수 ÷ 전체 기준정보 수 × 100
```

### AI 질문 정답률

사이트에서 수집한 콘텐츠만 사용하여 업종별 질문에 답할 수 있는 비율을 측정한다.

## 18.2 등급

```text
90~100 A+
80~89  A
70~79  B
60~69  C
40~59  D
20~39  E
0~19   F
```

## 18.3 치명적 상한

- 사이트 전체 접속 불가: 최대 10점
- 전체 noindex: 최대 30점
- 주요 검색봇 전체 차단: 최대 40점
- 핵심정보가 모두 로그인 뒤에 있음: 최대 45점
- 메인 콘텐츠 추출 불가: 최대 50점

## 18.4 규칙 엔진

각 규칙은 DB 또는 설정에서 관리한다.

- rule_code
- category
- title
- description
- weight
- severity
- 검사 방법
- pass 조건
- fail 조건
- 공식 근거 URL
- 활성 여부
- 규칙 버전
- 적용 시작일

한 검사에서는 시작 시점의 규칙 버전을 고정한다.

---

# 19. 검사 결과 화면

## 19.1 무료 결과

- 종합 점수와 등급
- AI가 이해한 사이트 한 문단 요약
- 찾은 핵심정보
- 찾지 못한 핵심정보
- 주요 문제 5개
- 예상 개선 범위
- 로그인·정밀진단 CTA

## 19.2 정밀 결과

- 영역별 점수
- 페이지별 문제
- 문제 중요도
- 초기 HTML vs 렌더링 결과
- 구조화 데이터
- 핵심정보 비교
- 질문 답변 가능성
- 에이전트 작업 가능성
- 수정 우선순위
- PDF 보고서

## 19.3 문제 상세

- 문제 ID
- 제목
- 중요도
- 발생 URL
- 현재 상태
- 증거
- AI에 미치는 영향
- 수정 요구사항
- 완료 판정 기준
- 예상 점수 범위
- 개발자 전달용 문구

---

# 20. 수정 작업지시서

## 20.1 생성

정밀진단의 문제를 선택해 작업지시서를 만든다.

포함:

- work_order_id
- 사이트
- 최초 scan_id
- 규칙 버전
- 대상 URL 목록
- 문제별 요구사항
- 자동검수 체크
- 예상 점수 범위
- 발급일
- 버전
- 상태

## 20.2 문제 예시

```text
문제 ID: HOURS-001
문제: 영업시간이 JavaScript 실행 후에만 나타남

수정 요구사항:
1. 초기 HTML 본문에 영업시간 표시
2. LocalBusiness JSON-LD에도 같은 값 표시
3. 모바일과 PC에서 같은 값 표시

완료 체크:
HOURS-01 초기 HTML에서 기준값 발견
HOURS-02 렌더링 화면에서 기준값 발견
HOURS-03 JSON-LD에 값 존재
HOURS-04 화면과 JSON-LD 일치
HOURS-05 모바일·PC 일치
HOURS-06 display:none 등 숨김 텍스트 아님

예상 개선 범위: +3~5점
```

예상점수는 보장이 아니라 범위로 표시한다.

## 20.3 상태

```text
DRAFT
ISSUED
ASSIGNED
IN_PROGRESS
SUBMITTED
VERIFYING
REWORK_REQUIRED
PASSED
CANCELLED
```

작업지시서를 수정하면 새 버전을 만든다. 이미 진행 중인 에이전시 작업에 조건을 몰래 바꾸지 않는다.

---

# 21. 에이전시 연결

## 21.1 거래 구조

- 고객과 에이전시는 직접 계약하고 직접 결제한다.
- Site AI Score는 진단, 작업지시서, 소개, 자동검수, 전후 비교를 제공한다.
- 플랫폼은 수정 계약의 당사자가 아니다.
- 계약 성사 시 에이전시로부터 소개 수수료를 받을 수 있음을 고객에게 알린다.

## 21.2 에이전시 정보

- 회사명
- 사업자 정보
- 담당 이메일
- 전문기술
- 지원 CMS
- 예상 비용 범위
- 작업 가능 상태
- 승인 상태
- 1차 통과율
- 재작업률
- 회귀 오류율
- 일정 준수율
- 고객평가

추천순서는 수수료가 아니라 기술 적합성과 품질지표를 기준으로 한다.

---

# 22. URL 기반 자동검수

에이전시는 소스코드를 제출하지 않는다. 실제 배포된 URL만 제출한다.

## 22.1 검수 요청

MVP 웹 화면 입력:

- 작업지시서 ID
- 배포 URL
- 배포 완료 KST 시각
- 수정 완료 항목
- 에이전시 메모

후속 API 요청 예:

```json
{
  "work_order_id": "WO-20260614-00125",
  "deployment_url": "https://example.com",
  "callback_url": "https://agency.example.com/webhooks/site-ai-score"
}
```

## 22.2 검수 처리

1. 작업지시서와 에이전시 권한 확인
2. 도메인과 대상 URL 확인
3. 수정 전 검사 조건 로드
4. 작업지시서의 모든 URL 재검사
5. 체크별 pass/fail/blocked 판정
6. 기존 핵심기능 회귀검사
7. 같은 규칙 버전으로 새 점수 계산
8. 작업 이행률 계산
9. 회귀 안전성 계산
10. 전후 점수 비교
11. 최종 판정

## 22.3 체크 상태

```text
PASS
FAIL
BLOCKED
NOT_APPLICABLE
```

## 22.4 전체 판정

```text
PASS
PARTIAL_PASS
FAIL
PENDING_RETRY
```

- 필수 체크 전부 통과 + 치명적 회귀 없음: PASS
- 비필수 일부 실패: PARTIAL_PASS
- 필수 체크 실패 또는 치명적 회귀: FAIL
- CDN, 서버 장애, CAPTCHA 등 일시적 원인: PENDING_RETRY

## 22.5 핵심 지표

### 작업 이행률

```text
통과한 필수·일반 체크 가중치 ÷ 전체 적용 체크 가중치 × 100
```

### 회귀 안전성

수정 전 정상 기능 중 수정 후에도 정상인 비율.

검사 예:

- 페이지 상태 코드
- 예약·문의 버튼
- 전화 링크
- 내부 링크
- 모바일 메뉴
- JavaScript error
- noindex 발생
- 기존 핵심정보 삭제

### AI 친화도 변화

```text
수정 전 점수 → 수정 후 점수
```

세 수치는 서로 분리해 표시한다.

## 22.6 책임 판정 원칙

- 완료 기준 미충족: 에이전시 구현 문제
- 완료 기준 모두 통과했는데 관련 점수 미반영: 플랫폼 진단·점수 엔진 검토
- 고객이 다시 변경하거나 다른 업체가 덮어씀: 고객·환경 문제
- CDN, DNS, 일시 장애: 재검사 대기
- 친화도는 올랐지만 실제 AI 노출이 안 늘어남: 양측 구현 실패로 보지 않음

---

# 23. 에이전시 검수 API

MVP에서는 웹 대시보드를 우선 구현하되 내부 API를 처음부터 명확히 설계한다. 공개 API 키와 웹훅은 후속 단계에서 활성화한다.

## 23.1 검수 생성

```http
POST /api/agency/verifications
```

응답:

```json
{
  "verificationId": "VER-89251",
  "status": "QUEUED"
}
```

## 23.2 결과 조회

```http
GET /api/agency/verifications/{verificationId}
```

예:

```json
{
  "status": "COMPLETED",
  "verdict": "PARTIAL_PASS",
  "completionRate": 83,
  "regressionSafety": 96,
  "scoreBefore": 61,
  "scoreAfter": 72,
  "failedChecks": [
    {
      "code": "HOURS-04",
      "message": "화면과 JSON-LD의 토요일 영업시간이 다릅니다."
    }
  ]
}
```

## 23.3 재검수

- 작업당 최초 전체 검수 1회
- 실패 항목 빠른 재검수 2회
- 추가 전체 검수는 사용량 정책 적용
- 변경 없는 반복 요청 제한
- 진행 중 중복 요청 방지

## 23.4 보안

- 에이전시별 API 키는 원문 저장하지 않음
- 호출량 제한
- 작업지시서에 등록된 도메인만 검수
- callback URL 검증
- 웹훅 서명
- 모든 호출 감사로그

---

# 24. 자동검수 확인서

명칭:

- AI 친화도 수정 검수 확인서
- 수정 작업 이행 확인서
- Site AI Score 자동검수 보고서

발급 조건은 기본적으로 PASS다. PARTIAL_PASS 발급 여부는 운영 정책 확정 전까지 `미발급`을 기본으로 한다.

포함:

- 사이트
- 고객
- 에이전시
- 작업지시서 번호와 버전
- 검사 URL
- 검사 KST 시각
- 규칙 버전
- 작업 이행률
- 회귀 안전성
- 수정 전후 점수
- 해결된 문제
- 남은 문제
- 고유 확인번호
- 공개 검증 URL

면책:

> 본 확인서는 명시된 URL과 검사 시점에 대해 작업지시서에 정의된 자동검수 항목의 충족 여부를 확인한 결과입니다. 사이트 전체 보안성, 모든 기능의 무결성, 향후 AI 검색 노출 또는 추천 결과를 보증하지 않습니다.

확인서가 잘못 발급된 경우 취소 상태와 정정 이력을 남기며 원본 기록을 몰래 덮어쓰지 않는다.

---

# 25. 주요 화면과 모바일 구성

## SCR-01 메인·무료진단 `/{locale}`

순서:

1. 앱바
2. 히어로 제목·설명
3. URL 입력
4. 무료 진단 CTA
5. 검사 안내
6. 3단계 서비스 흐름
7. 주요 진단 영역
8. 전후 비교 예시
9. 요금제 요약
10. FAQ
11. 푸터

인터랙션:

- `example.com` 입력 시 `https://` 보완 시도
- 제출 즉시 중복 방지
- 진행 화면으로 이동
- SSRF 대상은 안전한 오류 메시지

## SCR-02 회원가입 `/{locale}/signup`

- 이메일
- 이름
- 비밀번호
- 비밀번호 확인
- 약관 동의
- 가입 버튼
- Google 가입 버튼
- 로그인 링크

동일 이메일이 있으면 로그인 또는 계정 연결 안내.

## SCR-03 로그인 `/{locale}/login`

- 이메일
- 비밀번호
- 로그인
- Google 로그인
- 비밀번호 재설정
- 회원가입 링크

## SCR-04 비밀번호 재설정 요청

- 이메일
- 링크 발송
- 항상 동일한 완료 안내

## SCR-05 새 비밀번호 설정

- 새 비밀번호
- 확인
- 만료·사용된 토큰 오류

## SCR-06 고객 대시보드

- 현재 사이트 요약
- 최신 점수
- 최근 변화
- 진행 중 검사
- 우선 문제
- 작업지시서 상태
- 사이트 추가 CTA

## SCR-07 사이트 등록

모바일 단계형 폼:

1. URL
2. 기본정보
3. 업종·지역·언어
4. 기준정보
5. 확인·등록

## SCR-08 검사 진행

- 실제 단계
- 진행률
- 검사 URL
- 시작 시각
- 취소 가능 여부
- 완료 시 자동 결과 이동

## SCR-09 검사 결과

- 점수
- 등급
- 전회 대비 변화
- AI가 이해한 사이트
- 핵심정보
- 세부 영역
- 주요 문제
- 페이지별 문제
- 작업지시서 CTA
- PDF CTA

## SCR-10 문제 상세

- 문제 설명
- 증거
- 영향
- 수정 요구사항
- 완료 기준
- 예상 개선 범위

## SCR-11 작업지시서

- 번호·버전·상태
- 대상 URL
- 문제별 체크
- 예상 개선 범위
- 개발자 전달용 보기
- PDF
- 에이전시 연결

## SCR-12 에이전시 소개

- 기술·CMS·예산·일정
- 개인정보 제공 동의
- 에이전시 후보
- 선택·요청

## SCR-13 에이전시 작업함

- 상태 필터
- 고객·사이트
- 작업지시서
- 마감일
- 검수 요청

## SCR-14 검수 요청

- 작업지시서
- 배포 URL
- 배포 시각
- 완료 항목
- 메모
- 검수 시작 CTA

## SCR-15 검수 결과

- 최종 판정
- 작업 이행률
- 회귀 안전성
- 점수 전후
- 실패 체크
- 증거
- 재검수 CTA
- 확인서 CTA

## SCR-16 공개 확인서

비로그인 조회 가능. 검사 범위, 시각, 규칙 버전, 면책을 명확히 표시.

## SCR-17 계정 설정

- 이름 변경
- 로그인 방식
- Google 연결 상태
- 비밀번호 변경
- 언어
- 알림
- 탈퇴

## SCR-18 회원탈퇴

전체 너비 위험 화면. 비밀번호 또는 Google 재인증, 확인 문구, 최종 버튼.

## SCR-19 총관리자 로그인

별도 ID·비밀번호. 일반 Google 로그인 버튼 없음.

## SCR-20 관리자 대시보드

통계, 실행 작업, 실패, 최근 가입, 공지, 이의신청, 사이트 이동.

## SCR-21 관리자 회원관리

모바일 목록 행, 검색·필터 bottom sheet, 정지·삭제 상세 화면.

## SCR-22 관리자 공지관리

목록, 등록, 수정, 미리보기, 삭제. 이미지 Cloudinary 업로드.

## SCR-23 관리자 검사 작업

상태·유형 필터, 진행률, 재시도, 취소, 로그 요약.

## SCR-24 관리자 규칙관리

규칙 버전, 배점, 활성화, 공식 근거, 변경 이력.

## SCR-25 관리자 에이전시

승인·정지, 전문분야, 품질지표, 소개·정산.

## SCR-26 관리자 이의신청

주장, 증거, 재검사, 최종 원인 분류.

## SCR-27 관리자 파일관리

Cloudinary 상태, 소유자, 관련 객체, 용량, 고아 파일, 삭제 재시도.

모든 화면은 390px 기준으로 먼저 구현하고 320, 360, 430, 768px에서 확인한다.

---

# 26. 주요 데이터 모델

필드명은 실제 ORM 스타일에 맞게 조정할 수 있으나 의미를 변경하지 않는다.

## users

```text
id
email unique
name
password_hash nullable
role USER|AGENCY|SUPER_ADMIN
status ACTIVE|SUSPENDED
email_verified_at nullable
login_count
last_login_at nullable
created_at
updated_at
```

## auth_accounts

```text
id
user_id
provider LOCAL|GOOGLE|SECRET_ADMIN
provider_account_id
created_at
unique(provider, provider_account_id)
```

## sessions

```text
id
user_id
session_token_hash
expires_at
revoked_at
created_at
```

## password_reset_tokens

```text
id
user_id
token_hash
expires_at
used_at
created_at
```

## notices

```text
id
title
content_html
starts_at nullable
ends_at nullable
is_active
priority
version
image_asset_id nullable
button_text nullable
button_url nullable
open_new_window
created_by
created_at
updated_at
```

## uploaded_assets

```text
id
owner_user_id nullable
cloudinary_public_id
resource_type
secure_url
original_filename
mime_type
size_bytes
related_type
related_id
deleted_at nullable
created_at
```

## organizations

```text
id
name
type CUSTOMER|AGENCY
created_at
```

## organization_members

```text
id
organization_id
user_id
role OWNER|ADMIN|MEMBER
```

## sites

```text
id
organization_id
name
base_url
final_url
site_type
country
region
primary_locale
status
created_at
updated_at
```

## site_facts

```text
id
site_id
fact_key
expected_value
source USER|IMPORTED
created_at
updated_at
```

## scans

```text
id
site_id
type QUICK|DEEP|VERIFICATION|MONITORING
status
rules_version
score nullable
grade nullable
started_at nullable
completed_at nullable
error_code nullable
created_by
created_at
```

## scan_pages

```text
id
scan_id
url
status_code
final_url
content_type
raw_html_hash
rendered_html_hash
initial_text_length
rendered_text_length
iframe_count
screenshot_asset_id nullable
created_at
```

## findings

```text
id
scan_id
scan_page_id nullable
rule_code
category
severity
status PASS|FAIL|BLOCKED|NA
title
description
evidence_json
recommendation
score_delta
created_at
```

## rules

```text
id
rule_code
version
category
title
description
weight
severity
check_type
config_json
source_url nullable
is_active
effective_from
created_at
```

## work_orders

```text
id
site_id
initial_scan_id
customer_organization_id
agency_organization_id nullable
version
status
expected_score_min
expected_score_max
issued_at nullable
created_at
updated_at
```

## work_order_items

```text
id
work_order_id
finding_id
item_code
target_url
title
requirement
acceptance_criteria_json
is_required
weight
status
created_at
```

## verifications

```text
id
work_order_id
agency_organization_id
deployment_url
status
verdict
completion_rate nullable
regression_safety nullable
score_before nullable
score_after nullable
rules_version
started_at nullable
completed_at nullable
created_at
```

## verification_results

```text
id
verification_id
work_order_item_id
check_code
status PASS|FAIL|BLOCKED|NA
message
evidence_json
created_at
```

## certificates

```text
id
verification_id
public_code unique
status ACTIVE|REVOKED
pdf_asset_id nullable
issued_at
revoked_at nullable
reason nullable
```

## agency_partners

```text
id
organization_id
approval_status
specialties_json
supported_platforms_json
first_pass_rate
rework_rate
regression_error_rate
on_time_rate
customer_rating
created_at
updated_at
```

## referrals

```text
id
customer_organization_id
agency_organization_id
work_order_id
status
contract_amount nullable
commission_amount nullable
created_at
updated_at
```

## audit_logs

```text
id
actor_user_id nullable
action
target_type
target_id_hash nullable
metadata_json
created_at
```

삭제된 사용자의 이메일과 이름을 감사로그에 장기 보관하지 않는다.

---

# 27. 내부 API 목록

## 인증

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/google
POST /api/auth/google/link
POST /api/auth/logout
POST /api/auth/password/forgot
POST /api/auth/password/reset
GET  /api/auth/session
```

## 회원

```text
GET    /api/me
PATCH  /api/me
POST   /api/me/password
DELETE /api/me
```

## 사이트·기준정보

```text
GET    /api/sites
POST   /api/sites
GET    /api/sites/:id
PATCH  /api/sites/:id
DELETE /api/sites/:id
GET    /api/sites/:id/facts
PUT    /api/sites/:id/facts
```

## 검사

```text
POST /api/scans/quick
POST /api/sites/:id/scans
GET  /api/scans/:id
GET  /api/scans/:id/findings
POST /api/scans/:id/report
```

## 작업지시서

```text
GET    /api/work-orders
POST   /api/work-orders
GET    /api/work-orders/:id
PATCH  /api/work-orders/:id
DELETE /api/work-orders/:id
POST   /api/work-orders/:id/issue
POST   /api/work-orders/:id/assign
```

## 검수

```text
POST /api/agency/verifications
GET  /api/agency/verifications/:id
POST /api/agency/verifications/:id/retry
GET  /api/certificates/:publicCode
```

## Cloudinary

```text
POST   /api/uploads/signature
POST   /api/uploads/complete
DELETE /api/assets/:id
```

## 관리자

```text
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/dashboard
GET    /api/admin/users
GET    /api/admin/users/:id
POST   /api/admin/users/:id/suspend
POST   /api/admin/users/:id/activate
DELETE /api/admin/users/:id
GET    /api/admin/notices
POST   /api/admin/notices
PATCH  /api/admin/notices/:id
DELETE /api/admin/notices/:id
GET    /api/admin/scans
POST   /api/admin/scans/:id/retry
GET    /api/admin/rules
POST   /api/admin/rules
PATCH  /api/admin/rules/:id
DELETE /api/admin/rules/:id
GET    /api/admin/agencies
PATCH  /api/admin/agencies/:id
GET    /api/admin/disputes
PATCH  /api/admin/disputes/:id
GET    /api/admin/assets
```

모든 등록 API에 대응하는 수정·삭제 API를 제공한다. 삭제가 금지돼야 하는 이력 데이터는 hard delete 대신 취소·폐기 상태와 이유를 기록한다.

---

# 28. KST 날짜·시간 구현

공통 모듈을 만든다.

예상 함수:

```text
getNowKST()
getTodayKST()
toKSTDateTime(value)
formatKST(value, locale)
getEndOfKSTDay(date)
getNextKSTMidnight()
```

금지:

```js
new Date().toISOString().slice(0, 10)
```

날짜만 필요한 값은 KST 기준 `YYYY-MM-DD`를 사용한다. DB가 `timestamptz` 내부 저장을 UTC로 정규화하더라도 애플리케이션의 계산·입력·표시는 KST다.

반드시 테스트:

- KST 23:59:59 → 다음 날 00:00:00
- 월말
- 연말
- 윤년
- 공지 쿠키 자정 만료
- 시작·종료일 경계

---

# 29. 보안 요구사항

## 29.1 SSRF

검사 URL에서 다음을 차단한다.

- localhost
- loopback
- 사설 IP
- link-local
- IPv6 내부 주소
- 클라우드 메타데이터 주소
- file://, ftp:// 등 비HTTP 프로토콜
- DNS rebinding
- 리디렉션 후 내부 IP

DNS 확인과 리디렉션 단계마다 재검사한다.

## 29.2 인증·세션

- Argon2/bcrypt
- HttpOnly Cookie
- 운영 Secure
- SameSite
- CSRF 방어
- 로그인 rate limit
- 비밀번호 재설정 rate limit
- 세션 강제 폐기
- Google 토큰 서버 검증

## 29.3 입력과 출력

- Zod 서버 검증
- SQL injection은 ORM parameterization
- 공지 HTML sanitize
- 외부 URL allowlist/검증
- stack trace와 Secret 미노출
- 로그에 토큰·비밀번호·DB URL 미기록

## 29.4 파일

- MIME·확장자·용량 검사
- signed upload
- 사용자 소유권 검사
- public_id 조작 방지
- 삭제 권한 검사

## 29.5 API

- 역할과 소유권 검사
- 에이전시 API rate limit
- 키 해시 저장
- 웹훅 서명
- 감사로그

---

# 30. 오류와 사용자 메시지

표준 오류코드를 사용한다.

예:

```text
AUTH_INVALID_CREDENTIALS
AUTH_ACCOUNT_SUSPENDED
AUTH_GOOGLE_LINK_REQUIRED
AUTH_RESET_TOKEN_EXPIRED
SITE_URL_INVALID
SITE_URL_BLOCKED
SCAN_ALREADY_RUNNING
SCAN_FETCH_FAILED
SCAN_CAPTCHA_DETECTED
WORK_ORDER_VERSION_MISMATCH
VERIFICATION_REQUIRED_CHECK_FAILED
UPLOAD_FAILED
ADMIN_REAUTH_FAILED
```

사용자 메시지는 해결 방법을 알려주되 내부 경로나 stack trace를 노출하지 않는다.

같은 작업이 이미 진행 중이면 중복 job을 만들지 말고 기존 진행 화면으로 안내한다.

---

# 31. 테스트 전략

## 31.1 테스트 종류

- 단위 테스트
- API 통합 테스트
- DB 통합 테스트
- Playwright E2E
- 검사 샘플 회귀 테스트
- 모바일·태블릿·PC 테스트
- 역할·소유권 테스트
- SSRF 보안 테스트
- 다국어 라우팅 테스트
- KST 경계 테스트

## 31.2 필수 샘플 사이트

테스트용 로컬 fixture를 만든다.

- 정상 정적 HTML
- React SPA
- iframe에만 핵심정보
- JSON-LD와 화면 불일치
- robots 허용이지만 User-Agent 403
- 모바일·PC 정보 불일치
- CAPTCHA
- 로그인 필요
- 버튼 회귀 오류
- display:none으로 숨긴 키워드

## 31.3 모바일 QA

최소 너비:

- 320
- 360
- 390
- 430
- 768

환경:

- iOS Safari
- Android Chrome
- 세로·가로
- 긴 한국어·영어
- 키보드 열린 폼
- safe area
- 느린 네트워크
- 브라우저 뒤로가기
- 중복 탭

## 31.4 핵심 인수 조건

1. 공개 URL 무료 검사 시 점수·요약·문제 5개가 표시된다.
2. 기준정보가 있으면 추출값과 일치 상태가 표시된다.
3. 작업지시서 발급 시 문제별 자동검수 체크가 생성된다.
4. 에이전시가 배포 URL을 제출하면 검수 job이 생성된다.
5. 필수 체크가 모두 통과하면 PASS와 확인서 버튼이 보인다.
6. 필수 체크 실패 시 실패 증거와 재수정 안내가 보인다.
7. 기존 버튼이 망가지면 회귀검사가 PASS를 차단한다.
8. 수정 전후는 같은 규칙 버전으로 비교한다.
9. 공개 확인서는 비로그인으로 조회 가능하고 면책을 표시한다.
10. 사설 IP 검사는 차단된다.
11. 동일 이메일 Google 로그인은 중복계정을 만들지 않는다.
12. 일반 회원은 비밀번호 확인 후 즉시 탈퇴된다.
13. Google 전용 회원은 Google 재인증 후 즉시 탈퇴된다.
14. 공지 숨김 후 같은 KST 날짜에는 다시 나타나지 않는다.
15. KST 자정 이후 공지가 다시 표시될 수 있다.
16. 총관리자가 사이트로 이동하면 로그인 상태와 유료 권한이 유지된다.
17. 관리자 삭제에서 비밀번호가 틀리면 아무것도 삭제되지 않는다.
18. 엔티티 삭제 시 연결된 Cloudinary 자산도 삭제된다.
19. 768px 이하에서 본문 카드의 외곽 border/radius/margin이 제거된다.
20. 모바일 관리자 목록은 읽을 수 있는 세로 목록으로 변환된다.

---

# 32. 개발 단계

한 번에 전체를 만들지 않는다. 각 단계 완료 후 사용자에게 개발모드 테스트를 요청하고 결과를 받은 뒤 다음 단계로 진행한다.

## 1단계: 프로젝트 기반

- Replit·GitHub 연결
- TypeScript 구조
- DB·Prisma
- 환경변수 검증
- 공통 오류 처리
- KST 모듈
- 다국어 라우팅
- 모바일 우선 레이아웃
- 기본 테스트·빌드

## 2단계: 인증

- 이메일 회원가입·로그인
- Google 로그인
- 동일 이메일 연결
- 세션
- Resend 재설정
- 계정 설정
- 즉시 탈퇴

## 3단계: 총관리자·회원·공지·Cloudinary

- Secret 관리자 로그인
- 테스트 모드
- 회원 목록·정지·삭제
- 공지 CRUD·팝업·쿠키
- Cloudinary signed upload·삭제

## 4단계: 사이트·검사 기반

- 사이트 CRUD
- 기준정보 CRUD
- SSRF 검증
- DB job queue
- HTTP fetch
- User-Agent fetch
- Playwright worker
- 샘플 fixture

## 5단계: 점수와 고객 결과

- rules 모델
- 규칙 엔진
- 점수
- 핵심정보 비교
- 무료·정밀 결과
- PDF 보고서

## 6단계: 작업지시서·에이전시·자동검수

- 작업지시서 CRUD·버전
- 에이전시 작업함
- 검수 요청
- 체크별 판정
- 회귀검사
- 전후 비교
- 자동검수 확인서

## 7단계: 관리자 운영

- 검사 작업
- 규칙 관리
- 에이전시 승인·품질지표
- 이의신청
- 파일 관리
- 감사로그

## 8단계: 수익화·확장

- 상품과 사용량
- 결제 공급자 확정 후 결제
- 소개 수수료 관리
- 공개 에이전시 API
- 웹훅
- 정기 모니터링
- 경쟁사 비교
- 실제 AI 노출

---

# 33. 초기 상품 정책

결제 공급자가 정해지기 전에는 실제 결제 연동을 구현하지 말고 플랜·권한·사용량 모델과 총관리자 우회만 구현한다.

예시:

- 무료 간편진단: 대표 URL 1개, 주요 문제 5개
- 정밀진단: 최대 10페이지, 전체 문제, 작업지시서, PDF, 재검사 1회
- 월간 모니터링: 월 1회, 변화와 신규 문제
- 에이전시 소개: 고객·에이전시 직접 계약, 성사 시 제휴 수수료
- 에이전시 검수 구독: 후속

가격은 UI에 하드코딩하지 말고 DB 또는 설정으로 관리한다.

---

# 34. 출시 차단 조건

다음 중 하나라도 있으면 운영 배포를 승인하지 않는다.

- SSRF 방어 실패
- 다른 사용자의 데이터 접근 가능
- 일반 회원이 관리자 API 호출 가능
- 탈퇴 후 개인 데이터 또는 Cloudinary 파일 잔존
- 총관리자 비밀번호·해시가 소스나 로그에 노출
- 동일 이메일 Google 중복계정 생성
- 재설정 토큰 재사용 가능
- 증거 없이 감점
- 필수 검수 실패인데 확인서 PASS
- 규칙 버전이 섞였는데 안내 없음
- KST 날짜 경계 오류
- 개발 DB와 배포 DB 혼동
- 모바일 Edge-to-edge 기준 미충족
- 기존 기능이 승인 없이 삭제·비활성화됨

---

# 35. 기능 완료 보고 형식

각 이슈 완료 후 다음 형식으로 보고한다.

```text
구현 기능:
수정 파일:
DB 변경:
추가 또는 변경된 Replit Secrets 이름:
실행한 문법/타입/테스트/빌드 검사:
검사 결과:
개발모드에서 확인할 URL과 절차:
배포 후 배포된 사이트에서 확인할 URL과 절차:
기존 기능 변경·삭제 여부:
남은 확인사항:
커밋 해시:
푸시 결과:
현재 git status -sb:
```

사용자가 결과를 회신하지 않았다면 다음 구현으로 넘어가지 않는다.

---

# 36. 첫 개발 이슈

프로젝트 상태를 확인한 뒤 저장소가 비어 있다면 첫 이슈는 다음으로 한다.

> **프로젝트 기반 골격 구축: TypeScript React/Vite + Express + Prisma/PostgreSQL, 모바일 우선 locale 라우팅, 공통 KST 모듈, 환경변수 검증, 기본 로그인 전 공개 레이아웃, 빌드와 테스트 기반을 만든다.**

첫 이슈에서는 아직 Google, Resend, Cloudinary의 실제 외부 호출을 모두 구현하지 않는다. 먼저 안전한 프로젝트 구조, DB 연결, 모바일 레이아웃, locale 라우팅, 개발·배포 문서를 만든다.

첫 이슈 완료 후 반드시 개발모드에서 다음을 확인한다.

- 기본 언어 URL 접속
- 잘못된 locale 처리
- 390px 모바일 full-bleed 레이아웃
- 1024px 데스크톱 확장
- KST 현재 날짜 표시 테스트 페이지 또는 단위테스트
- DB health check
- 프로덕션 빌드

그 결과를 사용자가 회신한 후 인증 단계로 진행한다.

---

# 37. 최종 서비스 문구

## 고객용

> 내 사이트를 AI가 얼마나 잘 이해하는지 검사하고, 무엇을 고쳐야 하는지 확인하세요. 수정 후에는 같은 기준으로 얼마나 개선됐는지 다시 측정합니다.

## 에이전시용

> 소스코드를 제출할 필요가 없습니다. 작업지시서에 따라 수정한 뒤 배포 URL만 제출하면 작업 완료 여부와 개선 결과를 자동으로 확인할 수 있습니다.

## 제품 정의

> Site AI Score는 사이트의 AI 친화도를 진단하고, 수정 작업을 명확하게 정의하며, 웹개발 에이전시의 배포 결과를 URL 기반으로 자동검수하여 개선 전후를 증명하는 독립적인 AEO 웹 품질검증 플랫폼입니다.

---

# 38. 개발자가 마지막으로 기억할 것

- 사용자는 비개발자다. 한 번에 이해하고 실행할 수 있는 명령만 제공한다.
- 실행 결과가 없으면 실행되지 않은 것이다.
- 실제 파일과 코드를 조회하지 않고 추측해서 수정하지 않는다.
- 긴 수정은 `.cjs` 업로드형 패치로 처리한다.
- 기존 기능을 희생해 새 기능을 만들지 않는다.
- 모바일을 먼저 완성하고 데스크톱을 확장한다.
- 모든 날짜와 시간은 KST다.
- 파일은 Cloudinary, DB에는 주소와 메타데이터만 저장한다.
- 빌드 성공과 기능 성공은 다르다. 개발모드와 배포 사이트에서 각각 테스트한다.
- Site AI Score는 사이트를 대신 고치는 서비스가 아니라 진단·작업지시·독립 검수를 제공하는 서비스다.
