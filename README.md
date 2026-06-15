# Site AI Score

웹사이트가 AI에게 얼마나 잘 읽히고 이해되는지 진단하고, 수정 작업지시서를 만들며, 배포된 운영 URL을 다시 자동검수하는 AEO 웹 품질검증 플랫폼입니다.

## 현재 단계

2단계 인증 기반 중 2-2차 비밀번호 변경·재설정 및 Resend 메일 발송까지 완료된 상태입니다.

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

Google 로그인과 동일 이메일 계정 연결, 계정 설정·회원탈퇴, 검사 엔진과 Cloudinary 연동은 아직 구현하지 않았습니다.

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
/ko/system                     → 서버·KST·DB 상태 확인
/api/health                    → JSON 상태 API
/api/auth/session              → 현재 로그인 세션 확인
/api/auth/forgot-password      → 재설정 메일 요청
/api/auth/validate-reset-token → 재설정 링크 사전 검증
/api/auth/reset-password       → 새 비밀번호 저장
/api/auth/change-password      → 로그인 회원 비밀번호 변경
/api/me                        → 인증 회원 정보
```

## 문서

- `AGENTS.md`: 협업·수정 원칙
- `SITEAISCORE_FINAL_DEVELOPMENT_PROMPT.md`: 전체 제품 기획
- `DATABASE.md`: 개발/배포 DB 기록
- `DEPLOYMENT.md`: 배포 상태와 Secrets 이름
- `CHANGELOG.md`: 주요 변경 이력
