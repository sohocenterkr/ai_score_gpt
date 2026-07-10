import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "../auth/auth-service";
import type { ScanReportCacheService } from "./scan-report-cache";
import { createScanResultRouter } from "./scan-result-router";
import {
  ScanResultServiceError,
  type PublicScanResult,
  type ScanResultService,
} from "./scan-result-service";

const dbMocks = vi.hoisted(() => ({
  paidEntitlementFindFirst: vi.fn(),
}));

vi.mock("../db", () => ({
  getDatabase: () => ({
    paidEntitlement: {
      findFirst: dbMocks.paidEntitlementFindFirst,
    },
  }),
}));

const sampleUser: PublicUser = {
  id: "user-1",
  email: "sohocenter.kr@gmail.com",
  name: "테스트 사용자",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: null,
  createdAt: "2026-06-15T00:00:00.000Z",
};

const sampleResult: PublicScanResult = {
  site: {
    id: "site-1",
    name: "예제 사이트",
    baseUrl: "https://example.com/",
    finalUrl: "https://example.com/ko",
    siteType: "기업 홈페이지",
    country: "KR",
    region: "서울",
    primaryLocale: "ko",
  },
  scan: {
    id: "scan-1",
    type: "QUICK",
    diagnosticNumber: 1,
    status: "COMPLETED",
    rulesVersion: "2026.06-core-v2",
    locale: "ko",
    score: 77,
    grade: "B",
    startedAt: "2026-06-15T00:00:00.000Z",
    completedAt: "2026-06-15T00:00:04.000Z",
    errorCode: null,
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  scoreSummary: null,
  currentRulesVersion: "2026.06-core-v3",
  isOutdatedRulesVersion: false,
  understandingSummary: "예제 사이트 요약",
  foundInformation: [],
  missingInformation: [],
  primaryIssues: [],
  pages: [],
  findings: [],
};

function createApp(
  service: ScanResultService,
  cacheService: ScanReportCacheService = {
    getOrCreate: vi.fn().mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4\n%%EOF"),
      cacheStatus: "HIT",
    }),
  },
  currentUser = sampleUser,
) {
  const app = express();
  app.use(
    "/api/scan-results",
    createScanResultRouter({
      scanResultService: service,
      scanReportCacheService: cacheService,
      requireAuth: async (_request, response, next) => {
        response.locals.authUser = currentUser;
        next();
      },
    }),
  );
  return app;
}

describe("scan result router", () => {
  beforeEach(() => {
    dbMocks.paidEntitlementFindFirst.mockReset();
    dbMocks.paidEntitlementFindFirst.mockResolvedValue(null);
  });

  it("인증 회원의 검사 결과를 반환한다", async () => {
    const getScanResult = vi.fn().mockResolvedValue(sampleResult);
    const response = await request(createApp({ getScanResult })).get(
      "/api/scan-results/scan-1",
    );

    expect(response.status).toBe(200);
    expect(response.body.result.scan.id).toBe("scan-1");
    expect(response.body.result.scan.diagnosticNumber).toBe(1);
    expect(response.body.result.paidFeatureAccess).toBe(true);
    expect(getScanResult).toHaveBeenCalledWith(sampleUser, "scan-1");
  });

  it("일반 회원의 진단 보고서 PDF 다운로드를 차단한다", async () => {
    const regularUser = {
      ...sampleUser,
      email: "user@example.com",
      role: "USER" as const,
    };
    const getScanResult = vi.fn().mockResolvedValue(sampleResult);

    const response = await request(
      createApp({ getScanResult }, undefined, regularUser),
    ).get("/api/scan-results/scan-1/export.pdf");

    expect(response.status).toBe(402);
    expect(response.body.code).toBe("PAID_FEATURE_REQUIRED");
    expect(getScanResult).not.toHaveBeenCalled();
  });

  it("유료 권한이 있는 일반 회원의 진단 보고서 PDF를 반환한다", async () => {
    const regularUser = {
      ...sampleUser,
      email: "user@example.com",
      role: "USER" as const,
    };
    dbMocks.paidEntitlementFindFirst.mockResolvedValue({
      id: "entitlement-1",
    });

    const getScanResult = vi.fn().mockResolvedValue(sampleResult);
    const getOrCreate = vi.fn().mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4\npaid\n%%EOF"),
      cacheStatus: "HIT",
    });

    const response = await request(
      createApp({ getScanResult }, { getOrCreate }, regularUser),
    ).get("/api/scan-results/scan-1/export.pdf");

    expect(response.status).toBe(200);
    expect(getScanResult).toHaveBeenCalledWith(regularUser, "scan-1");
    expect(dbMocks.paidEntitlementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("인증 회원의 캐시된 진단 보고서 PDF를 반환한다", async () => {
    const getScanResult = vi.fn().mockResolvedValue(sampleResult);
    const getOrCreate = vi.fn().mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4\ncached\n%%EOF"),
      cacheStatus: "HIT",
    });
    const response = await request(
      createApp({ getScanResult }, { getOrCreate }),
    ).get("/api/scan-results/scan-1/export.pdf");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain(
      "site-ai-score-diagnostic-1-scan-1.pdf",
    );
    expect(response.headers["x-site-ai-report-cache"]).toBe("HIT");
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(getOrCreate).toHaveBeenCalledWith(sampleResult);
  });

  it("영문 PDF 요청 시 locale=en을 PDF 생성 입력에 반영한다", async () => {
    const getScanResult = vi.fn().mockResolvedValue(sampleResult);
    const getOrCreate = vi.fn().mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4\nenglish\n%%EOF"),
      cacheStatus: "MISS",
    });

    const response = await request(
      createApp({ getScanResult }, { getOrCreate }),
    ).get("/api/scan-results/scan-1/export.pdf?locale=en");

    expect(response.status).toBe(200);
    expect(getOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        scan: expect.objectContaining({
          id: "scan-1",
          locale: "en",
        }),
      }),
    );
  });

  it("접근할 수 없는 검사 결과를 404로 반환한다", async () => {
    const getScanResult = vi
      .fn()
      .mockRejectedValue(
        new ScanResultServiceError(
          "SCAN_RESULT_NOT_FOUND",
          "검사 결과를 찾을 수 없습니다.",
          404,
        ),
      );
    const response = await request(createApp({ getScanResult })).get(
      "/api/scan-results/other-scan",
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("SCAN_RESULT_NOT_FOUND");
  });
});
