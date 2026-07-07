import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import {
  type AuthResult,
  type AuthService,
  type PublicUser,
} from "../auth/auth-service";
import {
  SiteServiceError,
  type PublicScan,
  type PublicSite,
  type SiteService,
} from "./site-service";
import { SiteUrlError } from "./url-safety";

const sampleUser: PublicUser = {
  id: "user-1",
  email: "member@example.com",
  name: "테스트 회원",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: "2026-06-15T01:00:00.000Z",
  createdAt: "2026-06-14T06:00:00.000Z",
};

const authResult: AuthResult = {
  user: sampleUser,
  token: "raw-session-token",
  expiresAt: new Date("2026-06-22T01:00:00.000Z"),
};

const sampleScan: PublicScan = {
  id: "scan-1",
  siteId: "site-1",
  type: "QUICK",
  status: "QUEUED",
  rulesVersion: "2026.06-core-v1",
  isOutdatedRulesVersion: true,
  locale: "ko",
  score: null,
  grade: null,
  startedAt: null,
  completedAt: null,
  errorCode: null,
  createdAt: "2026-06-15T01:30:00.000Z",
  linkedWorkOrderId: null,
  verificationWorkOrderId: null,
};

const sampleSite: PublicSite = {
  id: "site-1",
  organizationId: "organization-1",
  organizationName: "테스트 회원의 사이트",
  name: "테스트 사이트",
  baseUrl: "https://example.com/",
  finalUrl: null,
  siteType: "기업 홈페이지",
  country: "KR",
  region: "서울",
  primaryLocale: "ko",
  status: "ACTIVE",
  createdAt: "2026-06-15T01:00:00.000Z",
  updatedAt: "2026-06-15T01:00:00.000Z",
  latestScan: null,
};

function createFakeAuthService(
  overrides: Partial<AuthService> = {},
): AuthService {
  return {
    signup: vi.fn().mockResolvedValue({ user: sampleUser }),
    createSessionForVerifiedEmail: vi.fn().mockResolvedValue(authResult),
    login: vi.fn().mockResolvedValue(authResult),
    loginWithGoogle: vi.fn(),
    getSessionUser: vi.fn().mockResolvedValue(sampleUser),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createFakeSiteService(
  overrides: Partial<SiteService> = {},
): SiteService {
  return {
    listSites: vi.fn().mockResolvedValue([sampleSite]),
    createSite: vi.fn().mockResolvedValue(sampleSite),
    getSite: vi.fn().mockResolvedValue(sampleSite),
    updateSite: vi.fn().mockResolvedValue(sampleSite),
    archiveSite: vi.fn().mockResolvedValue(undefined),
    listScans: vi.fn().mockResolvedValue([sampleScan]),
    queueScan: vi.fn().mockResolvedValue(sampleScan),
    ...overrides,
  };
}

const sessionCookie = "siteaiscore_session=raw-session-token";

describe("site API", () => {
  it("로그인하지 않은 요청은 차단한다", async () => {
    const app = createApp({
      authService: createFakeAuthService({
        getSessionUser: vi.fn().mockResolvedValue(null),
      }),
      siteService: createFakeSiteService(),
    });

    const response = await request(app).get("/api/sites");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });

  it("회원이 소유한 사이트 목록을 반환한다", async () => {
    const listSites = vi.fn().mockResolvedValue([sampleSite]);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ listSites }),
    });

    const response = await request(app)
      .get("/api/sites")
      .set("Cookie", sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.sites).toHaveLength(1);
    expect(response.body.sites[0].id).toBe(sampleSite.id);
    expect(listSites).toHaveBeenCalledWith(sampleUser);
  });

  it("사이트를 등록한다", async () => {
    const createSite = vi.fn().mockResolvedValue(sampleSite);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ createSite }),
    });

    const response = await request(app)
      .post("/api/sites")
      .set("Cookie", sessionCookie)
      .send({
        name: "테스트 사이트",
        baseUrl: "example.com",
        siteType: "기업 홈페이지",
        country: "KR",
        region: "서울",
        primaryLocale: "ko",
      });

    expect(response.status).toBe(201);
    expect(response.body.site.id).toBe(sampleSite.id);
    expect(createSite).toHaveBeenCalledWith(
      sampleUser,
      expect.objectContaining({
        name: "테스트 사이트",
        baseUrl: "example.com",
      }),
    );
  });

  it("사이트 등록 입력값을 검증한다", async () => {
    const createSite = vi.fn().mockResolvedValue(sampleSite);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ createSite }),
    });

    const response = await request(app)
      .post("/api/sites")
      .set("Cookie", sessionCookie)
      .send({
        name: "A",
        baseUrl: "",
        country: "KOR",
        primaryLocale: "korean",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(createSite).not.toHaveBeenCalled();
  });

  it("사이트 정보를 수정한다", async () => {
    const updatedSite = {
      ...sampleSite,
      name: "수정한 사이트",
    };
    const updateSite = vi.fn().mockResolvedValue(updatedSite);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ updateSite }),
    });

    const response = await request(app)
      .patch("/api/sites/site-1")
      .set("Cookie", sessionCookie)
      .send({ name: "수정한 사이트" });

    expect(response.status).toBe(200);
    expect(response.body.site.name).toBe("수정한 사이트");
    expect(updateSite).toHaveBeenCalledWith(
      sampleUser,
      "site-1",
      expect.objectContaining({
        name: "수정한 사이트",
      }),
    );
  });

  it("사이트를 이력 보존 방식으로 보관 처리한다", async () => {
    const archiveSite = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ archiveSite }),
    });

    const response = await request(app)
      .delete("/api/sites/site-1")
      .set("Cookie", sessionCookie);

    expect(response.status).toBe(204);
    expect(archiveSite).toHaveBeenCalledWith(sampleUser, "site-1");
  });

  it("검사 작업을 대기열에 등록한다", async () => {
    const queueScan = vi.fn().mockResolvedValue(sampleScan);
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({ queueScan }),
    });

    const response = await request(app)
      .post("/api/sites/site-1/scans")
      .set("Cookie", sessionCookie)
      .send({ type: "QUICK" });

    expect(response.status).toBe(201);
    expect(response.body.scan.status).toBe("QUEUED");
    expect(queueScan).toHaveBeenCalledWith(sampleUser, "site-1", "QUICK", "ko");
  });

  it("무료 간편진단 사이트 제한 오류를 반환한다", async () => {
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({
        queueScan: vi
          .fn()
          .mockRejectedValue(
            new SiteServiceError(
              "FREE_QUICK_SCAN_SITE_LIMIT_EXCEEDED",
              "무료 간편진단은 계정당 최대 10개 사이트까지 사용할 수 있습니다. 이미 진단한 사이트의 재진단은 계속 가능합니다.",
              403,
            ),
          ),
      }),
    });

    const response = await request(app)
      .post("/api/sites/site-11/scans")
      .set("Cookie", sessionCookie)
      .send({ type: "QUICK" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FREE_QUICK_SCAN_SITE_LIMIT_EXCEEDED");
  });

  it("SSRF 차단 오류를 내부 정보 없이 반환한다", async () => {
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({
        createSite: vi
          .fn()
          .mockRejectedValue(
            new SiteUrlError(
              "SITE_URL_BLOCKED",
              "사설 IP나 내부 주소는 검사할 수 없습니다.",
            ),
          ),
      }),
    });

    const response = await request(app)
      .post("/api/sites")
      .set("Cookie", sessionCookie)
      .send({
        name: "내부 주소",
        baseUrl: "http://127.0.0.1",
        country: "KR",
        primaryLocale: "ko",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("SITE_URL_BLOCKED");
    expect(response.body.message).not.toContain("127.0.0.1");
  });

  it("중복 사이트 오류를 표준 코드로 반환한다", async () => {
    const app = createApp({
      authService: createFakeAuthService(),
      siteService: createFakeSiteService({
        createSite: vi
          .fn()
          .mockRejectedValue(
            new SiteServiceError(
              "SITE_DUPLICATE",
              "같은 사이트 주소가 이미 등록되어 있습니다.",
              409,
            ),
          ),
      }),
    });

    const response = await request(app)
      .post("/api/sites")
      .set("Cookie", sessionCookie)
      .send({
        name: "중복 사이트",
        baseUrl: "https://example.com",
        country: "KR",
        primaryLocale: "ko",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SITE_DUPLICATE");
  });
});
