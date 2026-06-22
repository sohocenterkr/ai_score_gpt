import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";
import {
  createPrismaDeepDiagnosticAdminService,
  DeepDiagnosticAdminServiceError,
} from "./deep-diagnostic-admin-service";

vi.mock("../db", () => ({
  getDatabase: vi.fn(),
}));

const user: PublicUser = {
  id: "user-1",
  email: "member@example.com",
  name: "회원",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  loginCount: 1,
  lastLoginAt: null,
  createdAt: "2026-06-17T00:00:00.000Z",
};

describe("deep diagnostic admin ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("소유 조직의 회원이 아닌 사이트는 찾을 수 없음으로 처리한다", async () => {
    vi.mocked(getDatabase).mockReturnValue({
      site: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never);

    const service = createPrismaDeepDiagnosticAdminService();

    await expect(service.getSetup(user, "other-site")).rejects.toMatchObject({
      code: "SITE_NOT_FOUND",
      status: 404,
    });
  });

  it("기준정보 저장 전에도 사이트 소유권을 먼저 확인한다", async () => {
    const upsert = vi.fn();

    vi.mocked(getDatabase).mockReturnValue({
      site: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      siteFact: { upsert },
    } as never);

    const service = createPrismaDeepDiagnosticAdminService();

    await expect(
      service.saveFact(
        user,
        "other-site",
        "service_definition",
        "허용되지 않은 저장",
      ),
    ).rejects.toBeInstanceOf(DeepDiagnosticAdminServiceError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
