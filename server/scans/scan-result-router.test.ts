import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PublicUser } from "../auth/auth-service";
import { createScanResultRouter } from "./scan-result-router";
import {
  ScanResultServiceError,
  type PublicScanResult,
  type ScanResultService,
} from "./scan-result-service";

const sampleUser: PublicUser = {
  id: "user-1",
  email: "user@example.com",
  name: "테스트 사용자",
  role: "USER",
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
    status: "COMPLETED",
    rulesVersion: "2026.06-core-v2",
    score: 77,
    grade: "B",
    startedAt: "2026-06-15T00:00:00.000Z",
    completedAt: "2026-06-15T00:00:04.000Z",
    errorCode: null,
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  scoreSummary: null,
  understandingSummary: "예제 사이트 요약",
  foundInformation: [],
  missingInformation: [],
  primaryIssues: [],
  pages: [],
  findings: [],
};

function createApp(service: ScanResultService) {
  const app = express();
  app.use(
    "/api/scan-results",
    createScanResultRouter({
      scanResultService: service,
      requireAuth: async (_request, response, next) => {
        response.locals.authUser = sampleUser;
        next();
      },
    }),
  );
  return app;
}

describe("scan result router", () => {
  it("인증 회원의 검사 결과를 반환한다", async () => {
    const getScanResult = vi.fn().mockResolvedValue(sampleResult);
    const response = await request(
      createApp({ getScanResult }),
    ).get("/api/scan-results/scan-1");

    expect(response.status).toBe(200);
    expect(response.body.result.scan.id).toBe("scan-1");
    expect(getScanResult).toHaveBeenCalledWith(
      sampleUser,
      "scan-1",
    );
  });

  it("접근할 수 없는 검사 결과를 404로 반환한다", async () => {
    const getScanResult = vi.fn().mockRejectedValue(
      new ScanResultServiceError(
        "SCAN_RESULT_NOT_FOUND",
        "검사 결과를 찾을 수 없습니다.",
        404,
      ),
    );
    const response = await request(
      createApp({ getScanResult }),
    ).get("/api/scan-results/other-scan");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("SCAN_RESULT_NOT_FOUND");
  });
});
