import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import {
  type AuthResult,
  type AuthService,
  type PublicUser,
} from "../auth/auth-service";
import type {
  DeepDiagnosticAdminService,
  PublicAiQuestion,
  PublicDeepDiagnosticSetup,
  PublicSiteFact,
} from "./deep-diagnostic-admin-service";

const user: PublicUser = {
  id: "user-1",
  email: "member@example.com",
  name: "테스트 회원",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: null,
  createdAt: "2026-06-17T00:00:00.000Z",
};

const authResult: AuthResult = {
  user,
  token: "session-token",
  expiresAt: new Date("2026-06-20T00:00:00.000Z"),
};

const question: PublicAiQuestion = {
  id: "question-1",
  siteId: "site-1",
  code: "BRAND-01",
  kind: "BRAND",
  source: "SYSTEM",
  status: "ACTIVE",
  question: "테스트 사이트는 어떤 서비스인가요?",
  expectedFactKeys: ["service_definition"],
  isRequired: true,
  sortOrder: 10,
  createdAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
};

const fact: PublicSiteFact = {
  id: "fact-1",
  factKey: "service_definition",
  value: "테스트 서비스입니다.",
  source: "USER",
  createdAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
};

const setup: PublicDeepDiagnosticSetup = {
  site: {
    id: "site-1",
    name: "테스트 사이트",
    baseUrl: "https://example.com/",
    siteType: "기업 홈페이지",
    primaryLocale: "ko",
  },
  factDefinitions: [],
  facts: [fact],
  questions: [question],
  execution: {
    apiConfigured: false,
    provider: "OPENAI",
    model: "gpt-5.4-mini",
    evaluationModel: "gpt-5.4-mini",
    runsPerQuestion: 2,
    maxQuestions: 8,
    activeQuestionCount: 1,
    plannedAnswerRuns: 2,
    plannedApiCalls: 4,
    requiredFactCount: 5,
    savedRequiredFactCount: 1,
    canStart: false,
    blockers: ["설정 필요"],
    latestScan: null,
    summary: null,
    runs: [],
  },
};

function authService(authenticated = true): AuthService {
  return {
    signup: vi.fn().mockResolvedValue({ user }),
    createSessionForVerifiedEmail: vi.fn().mockResolvedValue(authResult),
    login: vi.fn().mockResolvedValue(authResult),
    getSessionUser: vi
      .fn()
      .mockResolvedValue(authenticated ? user : null),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function adminService(
  overrides: Partial<DeepDiagnosticAdminService> = {},
): DeepDiagnosticAdminService {
  return {
    getSetup: vi.fn().mockResolvedValue(setup),
    saveFact: vi.fn().mockResolvedValue(fact),
    deleteFact: vi.fn().mockResolvedValue(undefined),
    ensureDefaultQuestions: vi.fn().mockResolvedValue([question]),
    createQuestion: vi.fn().mockResolvedValue(question),
    updateQuestion: vi.fn().mockResolvedValue(question),
    startDiagnostic: vi.fn().mockResolvedValue({
      id: "deep-scan-1",
      status: "QUEUED",
      score: null,
      grade: null,
      errorCode: null,
      createdAt: "2026-06-17T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
    }),
    ...overrides,
  };
}

const cookie = "siteaiscore_session=session-token";

describe("deep diagnostic setup API", () => {
  it("로그인하지 않은 요청을 차단한다", async () => {
    const response = await request(
      createApp({
        authService: authService(false),
        deepDiagnosticAdminService: adminService(),
      }),
    ).get("/api/deep-diagnostics/sites/site-1/setup");

    expect(response.status).toBe(401);
  });

  it("소유 사이트의 기준정보와 질문을 반환한다", async () => {
    const getSetup = vi.fn().mockResolvedValue(setup);
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({ getSetup }),
      }),
    )
      .get("/api/deep-diagnostics/sites/site-1/setup")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.setup.site.id).toBe("site-1");
    expect(getSetup).toHaveBeenCalledWith(user, "site-1");
  });

  it("허용된 기준정보를 저장한다", async () => {
    const saveFact = vi.fn().mockResolvedValue(fact);
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({ saveFact }),
      }),
    )
      .put(
        "/api/deep-diagnostics/sites/site-1/facts/service_definition",
      )
      .set("Cookie", cookie)
      .send({ value: "테스트 서비스입니다." });

    expect(response.status).toBe(200);
    expect(saveFact).toHaveBeenCalledWith(
      user,
      "site-1",
      "service_definition",
      "테스트 서비스입니다.",
    );
  });

  it("지원하지 않는 기준정보 키를 차단한다", async () => {
    const saveFact = vi.fn();
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({ saveFact }),
      }),
    )
      .put("/api/deep-diagnostics/sites/site-1/facts/secret")
      .set("Cookie", cookie)
      .send({ value: "값" });

    expect(response.status).toBe(400);
    expect(saveFact).not.toHaveBeenCalled();
  });

  it("운영자 질문을 등록한다", async () => {
    const createQuestion = vi.fn().mockResolvedValue(question);
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({ createQuestion }),
      }),
    )
      .post("/api/deep-diagnostics/sites/site-1/questions")
      .set("Cookie", cookie)
      .send({
        kind: "CUSTOM",
        question: "이 서비스는 어떤 자료를 사용하나요?",
        expectedFactKeys: ["data_handling"],
        isRequired: true,
      });

    expect(response.status).toBe(201);
    expect(createQuestion).toHaveBeenCalledWith(
      user,
      "site-1",
      expect.objectContaining({
        kind: "CUSTOM",
        expectedFactKeys: ["data_handling"],
      }),
    );
  });

  it("정밀진단 작업을 대기열에 등록한다", async () => {
    const startDiagnostic = vi.fn().mockResolvedValue({
      id: "deep-scan-1",
      status: "QUEUED",
      score: null,
      grade: null,
      errorCode: null,
      createdAt: "2026-06-17T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
    });
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({
          startDiagnostic,
        }),
      }),
    )
      .post("/api/deep-diagnostics/sites/site-1/runs")
      .set("Cookie", cookie);

    expect(response.status).toBe(201);
    expect(response.body.scan.status).toBe("QUEUED");
    expect(startDiagnostic).toHaveBeenCalledWith(
      user,
      "site-1",
    );
  });

  it("질문을 보관 상태로 변경한다", async () => {
    const archived = { ...question, status: "ARCHIVED" as const };
    const updateQuestion = vi.fn().mockResolvedValue(archived);
    const response = await request(
      createApp({
        authService: authService(),
        deepDiagnosticAdminService: adminService({ updateQuestion }),
      }),
    )
      .patch(
        "/api/deep-diagnostics/sites/site-1/questions/question-1",
      )
      .set("Cookie", cookie)
      .send({ status: "ARCHIVED" });

    expect(response.status).toBe(200);
    expect(response.body.question.status).toBe("ARCHIVED");
  });
});
