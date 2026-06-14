import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("health API", () => {
  it("KST 시각과 데이터베이스 상태를 반환한다", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("site-ai-score");
    expect(response.body.timestampKST).toMatch(/\+09:00$/);
    expect(["not_configured", "connected"]).toContain(response.body.database.status);
  });

  it("존재하지 않는 API는 표준 오류를 반환한다", async () => {
    const response = await request(createApp()).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("API_NOT_FOUND");
  });
});
