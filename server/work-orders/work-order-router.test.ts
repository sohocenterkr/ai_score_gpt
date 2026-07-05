import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import type { PublicUser } from "../auth/auth-service";
import { createWorkOrderRouter } from "./work-order-router";
import type {
  PublicWorkOrder,
  WorkOrderService,
} from "./work-order-service";

const user: PublicUser = {
  id: "user-1",
  email: "sohocenter.kr@gmail.com",
  name: "소유자",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
};

const workOrder = {
  id: "wo-1",
  orderNumber: "WO-20260615-12345",
  version: 1,
  status: "DRAFT",
  rulesVersion: "2026.06-core-v2",
  scoreBefore: 71,
  gradeBefore: "B",
  expectedScoreMin: 86,
  expectedScoreMax: 100,
  issuedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  site: {
    id: "site-1",
    name: "테스트 사이트",
    baseUrl: "https://example.com/",
    finalUrl: "https://example.com/kr",
  },
  initialScan: {
    id: "scan-1",
    score: 71,
    grade: "B",
    rulesVersion: "2026.06-core-v3",
    targetUrl: "https://example.com/",
    completedAt: new Date().toISOString(),
  },
  customerOrganization: {
    id: "org-1",
    name: "고객 조직",
  },
  agencyOrganization: null,
  items: [],
  verificationAttempts: [],
} satisfies PublicWorkOrder;

function auth(
  _request: Request,
  response: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
) {
  response.locals.authUser = user;
  next();
  return Promise.resolve();
}

function createService(): WorkOrderService {
  return {
    listWorkOrders: vi.fn().mockResolvedValue([]),
    createWorkOrder: vi.fn().mockResolvedValue(workOrder),
    getWorkOrder: vi.fn().mockResolvedValue(workOrder),
    issueWorkOrder: vi.fn().mockResolvedValue({
      ...workOrder,
      status: "ISSUED",
    }),
    submitVerification: vi.fn().mockResolvedValue({
      ...workOrder,
      status: "VERIFYING",
      verificationAttempts: [
        {
          id: "verification-1",
          attemptNumber: 1,
          submittedUrl: "https://deploy.example.com/",
          status: "QUEUED",
          scoreAfter: null,
          gradeAfter: null,
          startedAt: null,
          completedAt: null,
          errorCode: null,
          createdAt: new Date().toISOString(),
          scan: {
            id: "scan-verification-1",
            type: "VERIFICATION",
            status: "QUEUED",
            targetUrl: "https://deploy.example.com/",
            score: null,
            grade: null,
            startedAt: null,
            completedAt: null,
            errorCode: null,
          },
          itemResults: [],
        },
      ],
    }),
    reviseWorkOrder: vi.fn().mockResolvedValue({
      ...workOrder,
      id: "wo-2",
      version: 2,
    }),
    cancelWorkOrder: vi.fn().mockResolvedValue(undefined),
    exportJson: vi.fn().mockResolvedValue({
      formatVersion: "site-ai-score-work-order-v1",
      generatedAt: new Date().toISOString(),
      workOrder,
      disclaimer: "안내",
    }),
    exportCsv: vi.fn().mockResolvedValue("\uFEFFa,b\r\n1,2"),
  };
}

function createTestApp(service: WorkOrderService) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/work-orders",
    createWorkOrderRouter({
      workOrderService: service,
      requireAuth: auth,
    }),
  );
  return app;
}

describe("work order router", () => {
  it("작업지시서를 생성한다", async () => {
    const service = createService();
    const response = await request(createTestApp(service))
      .post("/api/work-orders")
      .send({
        scanId: "scan-1",
        findingIds: ["finding-1"],
        renderedImprovementCodes: [],
      });

    expect(response.status).toBe(201);
    expect(response.body.workOrder.orderNumber).toBe(
      "WO-20260615-12345",
    );
  });

  it("AI 수집 개선안만 선택해도 생성한다", async () => {
    const service = createService();
    const response = await request(createTestApp(service))
      .post("/api/work-orders")
      .send({
        scanId: "scan-1",
        findingIds: [],
        renderedImprovementCodes: [
          "RENDERED-ADDED-CONTENT",
        ],
      });

    expect(response.status).toBe(201);
    expect(service.createWorkOrder).toHaveBeenCalledWith(user, {
      scanId: "scan-1",
      findingIds: [],
      renderedImprovementCodes: [
        "RENDERED-ADDED-CONTENT",
      ],
      locale: "ko",
    });
  });

  it("문제와 개선안이 모두 선택되지 않으면 생성하지 않는다", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/work-orders")
      .send({
        scanId: "scan-1",
        findingIds: [],
        renderedImprovementCodes: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("발급 상태로 변경한다", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/work-orders/wo-1/issue")
      .send();

    expect(response.status).toBe(200);
    expect(response.body.workOrder.status).toBe("ISSUED");
  });

  it("수정된 공개 URL을 검수 대기열에 등록한다", async () => {
    const service = createService();
    const response = await request(createTestApp(service))
      .post("/api/work-orders/wo-1/verifications")
      .send({
        submittedUrl: "https://deploy.example.com/",
      });

    expect(response.status).toBe(201);
    expect(response.body.workOrder.status).toBe("VERIFYING");
    expect(
      response.body.workOrder.verificationAttempts[0]
        .submittedUrl,
    ).toBe("https://deploy.example.com/");
    expect(service.submitVerification).toHaveBeenCalledWith(
      user,
      "wo-1",
      {
        submittedUrl: "https://deploy.example.com/",
      },
    );
  });

  it("검수 URL이 비어 있으면 등록하지 않는다", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/work-orders/wo-1/verifications")
      .send({
        submittedUrl: "",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("새 버전을 생성한다", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/work-orders/wo-1/revise")
      .send();

    expect(response.status).toBe(201);
    expect(response.body.workOrder.version).toBe(2);
  });

  it("JSON 파일을 내려받는다", async () => {
    const response = await request(createTestApp(createService())).get(
      "/api/work-orders/wo-1/export.json",
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      "WO-20260615-12345-v1.json",
    );
    expect(response.body.formatVersion).toBe(
      "site-ai-score-work-order-v1",
    );
  });

  it("CSV 파일을 내려받는다", async () => {
    const response = await request(createTestApp(createService())).get(
      "/api/work-orders/wo-1/export.csv",
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      "WO-20260615-12345-v1.csv",
    );
    expect(response.text).toContain("a,b");
  });
});
