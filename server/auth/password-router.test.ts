import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type {
  AuthService,
  PublicUser,
} from "./auth-service";
import type {
  PasswordResetDelivery,
  PasswordService,
} from "./password-service";
import type { PasswordResetMailer } from "../email/password-reset-mailer";

const sampleUser: PublicUser = {
  id: "user-1",
  email: "member@example.com",
  name: "테스트 회원",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: null,
  createdAt: "2026-06-14T06:00:00.000Z",
};

function createFakeAuthService(): AuthService {
  return {
    signup: vi.fn(),
    createSessionForVerifiedEmail: vi.fn(),
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    getSessionUser: vi.fn().mockResolvedValue(sampleUser),
    deleteAccount: vi.fn(),
    logout: vi.fn(),
  };
}

function createFakePasswordService(
  overrides: Partial<PasswordService> = {},
): PasswordService {
  return {
    changePassword: vi.fn().mockResolvedValue(undefined),
    createPasswordReset: vi.fn().mockResolvedValue(null),
    validatePasswordReset: vi.fn().mockResolvedValue(false),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createFakeMailer(
  configured = true,
): PasswordResetMailer & {
  sendPasswordReset: ReturnType<typeof vi.fn>;
} {
  return {
    isConfigured: () => configured,
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  };
}

describe("password API", () => {
  it("가입 여부와 관계없이 같은 비밀번호 찾기 응답을 반환한다", async () => {
    const passwordService = createFakePasswordService();
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService,
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(202);
    expect(response.body.message).toContain("가입된 이메일이라면");
  });

  it("발송 대상이 있으면 메일러를 호출한다", async () => {
    const delivery: PasswordResetDelivery = {
      to: "member@example.com",
      name: "테스트 회원",
      token: "reset-token-value-1234567890",
      expiresAt: new Date("2026-06-14T07:00:00.000Z"),
    };
    const mailer = createFakeMailer();
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService({
        createPasswordReset: vi.fn().mockResolvedValue(delivery),
      }),
      passwordResetMailer: mailer,
    });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: delivery.to });

    expect(response.status).toBe(202);
    expect(mailer.sendPasswordReset).toHaveBeenCalledWith(delivery);
  });

  it("메일 설정이 없으면 모든 이메일에 같은 503을 반환한다", async () => {
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService(),
      passwordResetMailer: createFakeMailer(false),
    });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "member@example.com" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("사용 가능한 재설정 토큰을 유효하다고 반환한다", async () => {
    const validatePasswordReset = vi.fn().mockResolvedValue(true);
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService({
        validatePasswordReset,
      }),
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/validate-reset-token")
      .send({ token: "reset-token-value-1234567890" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(validatePasswordReset).toHaveBeenCalledWith(
      "reset-token-value-1234567890",
    );
  });

  it("사용했거나 만료된 재설정 토큰을 무효하다고 반환한다", async () => {
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService({
        validatePasswordReset: vi.fn().mockResolvedValue(false),
      }),
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/validate-reset-token")
      .send({ token: "used-reset-token-value-1234567890" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
  });

  it("유효한 토큰으로 비밀번호를 재설정한다", async () => {
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService({ resetPassword }),
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: "reset-token-value-1234567890",
        newPassword: "new-password-123",
      });

    expect(response.status).toBe(200);
    expect(resetPassword).toHaveBeenCalledWith(
      "reset-token-value-1234567890",
      "new-password-123",
    );
  });

  it("비로그인 상태의 비밀번호 변경을 차단한다", async () => {
    const authService = createFakeAuthService();
    authService.getSessionUser = vi.fn().mockResolvedValue(null);
    const app = createApp({
      authService,
      passwordService: createFakePasswordService(),
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/change-password")
      .send({
        currentPassword: "current-password-123",
        newPassword: "new-password-123",
      });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });

  it("로그인 회원의 비밀번호 변경 후 쿠키를 제거한다", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      authService: createFakeAuthService(),
      passwordService: createFakePasswordService({ changePassword }),
      passwordResetMailer: createFakeMailer(),
    });

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", "siteaiscore_session=session-token")
      .send({
        currentPassword: "current-password-123",
        newPassword: "new-password-123",
      });

    expect(response.status).toBe(204);
    expect(changePassword).toHaveBeenCalledWith(
      sampleUser.id,
      "current-password-123",
      "new-password-123",
    );
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "siteaiscore_session=;",
    );
  });
});
