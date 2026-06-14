# CHANGELOG

모든 주요 변경사항을 KST 기준으로 기록합니다.

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

- 비밀번호 재설정·Resend
- Google 로그인과 동일 이메일 계정 연결
- 계정 설정과 즉시 회원탈퇴
- 총관리자·공지·Cloudinary
- 사이트 등록·검사 엔진
- 점수·작업지시서·에이전시 자동검수
