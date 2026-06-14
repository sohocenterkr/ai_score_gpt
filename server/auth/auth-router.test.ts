import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import {
  AuthError,
  type AuthResult,
  type AuthService,
  type PublicUser,
} from "./auth-service";

const sampleUser: PublicUser = {
  id: "user-1",
  email: "member@example.com",
  name: "테스트 회원",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: "2026-06-14T06:00:00.000Z",
  createdAt: "2026-06-14T06:00:00.000Z",
};

const authResult: AuthResult = {
  user: sampleUser,
  token: "raw-session-token",
  expiresAt: new Date("2026-06-21T06:00:00.000Z"),
};

function createFakeService(
  overrides: Partial<AuthService> = {},
): AuthService {
  return {
    signup: vi.fn().mockResolvedValue(authResult),
    login: vi.fn().mockResolvedValue(authResult),
    getSessionUser: vi.fn().mockResolvedValue(sampleUser),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("auth API", () => {
  it("회원가입 후 HttpOnly 세션 쿠키를 발급한다", async () => {
    const app = createApp({ authService: createFakeService() });
    const response = await request(app).post("/api/auth/signup").send({
      email: "member@example.com",
      name: "테스트 회원",
      password: "securepass123",
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("member@example.com");
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "siteaiscore_session=raw-session-token",
    );
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  });

  it("회원가입 입력값을 서버에서 검증한다", async () => {
    const app = createApp({ authService: createFakeService() });
    const response = await request(app).post("/api/auth/signup").send({
      email: "invalid",
      name: "A",
      password: "short",
      termsAccepted: false,
      privacyAccepted: false,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("로그인 오류 코드를 그대로 반환한다", async () => {
    const app = createApp({
      authService: createFakeService({
        login: vi.fn().mockRejectedValue(
          new AuthError(
            "AUTH_INVALID_CREDENTIALS",
            "이메일 또는 비밀번호가 올바르지 않습니다.",
            401,
          ),
        ),
      }),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "member@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("세션 쿠키로 현재 회원을 반환한다", async () => {
    const app = createApp({ authService: createFakeService() });
    const response = await request(app)
      .get("/api/auth/session")
      .set("Cookie", "siteaiscore_session=raw-session-token");

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(true);
    expect(response.body.user.id).toBe(sampleUser.id);
  });

  it("보호된 /api/me는 세션이 없으면 차단한다", async () => {
    const app = createApp({ authService: createFakeService() });
    const response = await request(app).get("/api/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });

  it("로그아웃 시 세션을 폐기하고 쿠키를 제거한다", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      authService: createFakeService({ logout }),
    });

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", "siteaiscore_session=raw-session-token");

    expect(response.status).toBe(204);
    expect(logout).toHaveBeenCalledWith("raw-session-token");
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "siteaiscore_session=;",
    );
  });
});
