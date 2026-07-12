import { describe, expect, it } from "vitest";
import type { PublicUser } from "./auth-service";
import {
  DEV_USER_PREVIEW_EMAIL,
  resolveDevUserPreview,
} from "./dev-user-preview";

const superAdmin: PublicUser = {
  id: "user-super",
  email: "sohocenter.kr@gmail.com",
  name: "수퍼관리자",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: "2026-07-12T00:00:00.000Z",
  loginCount: 1,
  lastLoginAt: "2026-07-12T00:00:00.000Z",
  createdAt: "2026-07-12T00:00:00.000Z",
};

describe("development regular-user preview", () => {
  it("개발모드의 실제 수퍼관리자 GET 요청을 일반 사용자로 변환한다", () => {
    const result = resolveDevUserPreview({
      nodeEnv: "development",
      method: "GET",
      headerValue: "1",
      user: superAdmin,
    });

    expect(result.active).toBe(true);
    expect(result.readOnlyViolation).toBe(false);
    expect(result.user.role).toBe("USER");
    expect(result.user.email).toBe(DEV_USER_PREVIEW_EMAIL);
    expect(result.user.id).toBe(superAdmin.id);
  });

  it("개발모드 미리보기의 데이터 변경 요청을 차단 대상으로 표시한다", () => {
    const result = resolveDevUserPreview({
      nodeEnv: "development",
      method: "POST",
      headerValue: "1",
      user: superAdmin,
    });

    expect(result.active).toBe(true);
    expect(result.readOnlyViolation).toBe(true);
  });

  it("운영환경에서는 미리보기 요청을 무시한다", () => {
    const result = resolveDevUserPreview({
      nodeEnv: "production",
      method: "GET",
      headerValue: "1",
      user: superAdmin,
    });

    expect(result.active).toBe(false);
    expect(result.user).toEqual(superAdmin);
  });

  it("일반 사용자가 헤더를 보내도 권한을 바꾸지 않는다", () => {
    const regularUser: PublicUser = {
      ...superAdmin,
      id: "user-regular",
      email: "user@example.com",
      role: "USER",
    };

    const result = resolveDevUserPreview({
      nodeEnv: "development",
      method: "GET",
      headerValue: "1",
      user: regularUser,
    });

    expect(result.active).toBe(false);
    expect(result.user).toEqual(regularUser);
  });

  it("PDF 링크용 쿼리 플래그도 개발모드에서만 인정한다", () => {
    const result = resolveDevUserPreview({
      nodeEnv: "development",
      method: "GET",
      queryValue: "1",
      user: superAdmin,
    });

    expect(result.active).toBe(true);
    expect(result.user.role).toBe("USER");
  });
});
