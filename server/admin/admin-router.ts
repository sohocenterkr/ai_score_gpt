import { timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { z } from "zod";
import type {
  AuthenticatedResponseLocals,
  createRequireAuth,
} from "../auth/auth-middleware";
import { env } from "../config/env";
import { getDatabase } from "../db";
import { scanResultPdfFilename } from "../scans/scan-result-pdf";
import {
  ScanReportCacheError,
  createPrismaScanReportCacheService,
  type ScanReportCacheService,
} from "../scans/scan-report-cache";
import {
  ScanResultServiceError,
  createPrismaScanResultService,
  type ScanResultService,
} from "../scans/scan-result-service";

const SUPER_ADMIN_EMAIL = "sohocenter.kr@gmail.com";

type RequireAuthMiddleware = ReturnType<typeof createRequireAuth>;

interface CreateAdminRouterOptions {
  requireAuth: RequireAuthMiddleware;
  scanResultService?: ScanResultService;
  scanReportCacheService?: ScanReportCacheService;
}

const noticeInputSchema = z.object({
  title: z.string().trim().min(1, "공지 제목을 입력해 주세요.").max(100),
  content: z.string().trim().min(1, "공지 내용을 입력해 주세요.").max(2000),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
});

const memberQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  status: z.enum(["ALL", "ACTIVE", "SUSPENDED"]).optional().default("ALL"),
});

const memberStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const memberDeleteSchema = z.object({
  adminPassword: z.string().min(1, "관리자 비밀번호를 입력해 주세요.").max(128),
});

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("날짜 형식이 올바르지 않습니다.");
  }

  return date;
}

function serializeNotice(notice: {
  id: string;
  title: string;
  content: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    startsAt: notice.startsAt?.toISOString() ?? null,
    endsAt: notice.endsAt?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  };
}

function isSuperAdminUser(
  response: Response<unknown, AuthenticatedResponseLocals>,
): boolean {
  const user = response.locals.authUser;

  return (
    user.role === "SUPER_ADMIN" &&
    user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
  );
}

function requireSuperAdmin(
  _request: Request,
  response: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
) {
  if (!isSuperAdminUser(response)) {
    response.status(403).json({
      code: "ADMIN_FORBIDDEN",
      message: "총관리자만 접근할 수 있습니다.",
    });
    return;
  }

  next();
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifyConfiguredAdminPassword(password: string): Promise<boolean> {
  if (env.SUPER_ADMIN_PASSWORD_HASH) {
    try {
      return await argon2.verify(env.SUPER_ADMIN_PASSWORD_HASH, password);
    } catch {
      return false;
    }
  }

  if (env.SUPER_ADMIN_PASSWORD) {
    return safeEqual(env.SUPER_ADMIN_PASSWORD, password);
  }

  return false;
}

async function verifyAdminPassword(
  adminUserId: string,
  password: string,
): Promise<boolean> {
  const prisma = getDatabase();
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      email: true,
      role: true,
      passwordHash: true,
    },
  });

  if (
    adminUser?.role !== "SUPER_ADMIN" ||
    adminUser.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL
  ) {
    return false;
  }

  if (adminUser.passwordHash) {
    try {
      return await argon2.verify(adminUser.passwordHash, password);
    } catch {
      return false;
    }
  }

  return verifyConfiguredAdminPassword(password);
}

function scoreLabel(value: number | null): string | null {
  return typeof value === "number" ? value.toFixed(1) : null;
}

function readRouteParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildSiteSummaries(
  organizationMembers: Array<{
    organization: {
      sites: Array<{
        id: string;
        name: string;
        baseUrl: string;
        finalUrl: string | null;
        scans: Array<{
          id: string;
          status: string;
          score: number | null;
          grade: string | null;
          createdAt: Date;
          completedAt: Date | null;
        }>;
      }>;
    };
  }>,
) {
  const siteMap = new Map<
    string,
    {
      id: string;
      name: string;
      baseUrl: string;
      finalUrl: string | null;
      scans: Array<{
        id: string;
        status: string;
        score: number | null;
        grade: string | null;
        createdAt: Date;
        completedAt: Date | null;
      }>;
    }
  >();

  for (const member of organizationMembers) {
    for (const site of member.organization.sites) {
      siteMap.set(site.id, site);
    }
  }

  return [...siteMap.values()].map((site) => {
    const scans = [...site.scans].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const scoredScans = scans.filter(
      (scan): scan is typeof scan & { score: number } =>
        typeof scan.score === "number",
    );
    const firstScore = scoredScans[0]?.score ?? null;
    const secondScore = scoredScans[1]?.score ?? null;
    const latestScore = scoredScans.at(-1)?.score ?? null;
    const bestScore =
      scoredScans.length > 0
        ? Math.max(...scoredScans.map((scan) => scan.score))
        : null;
    const latestScan = scans.at(-1) ?? null;
    const improvement =
      typeof firstScore === "number" && typeof latestScore === "number"
        ? latestScore - firstScore
        : null;

    return {
      siteId: site.id,
      siteName: site.name,
      baseUrl: site.baseUrl,
      finalUrl: site.finalUrl,
      diagnosisCount: scans.length,
      firstScore: scoreLabel(firstScore),
      secondScore: scoreLabel(secondScore),
      latestScore: scoreLabel(latestScore),
      bestScore: scoreLabel(bestScore),
      improvement: scoreLabel(improvement),
      latestDiagnosisAt:
        latestScan?.completedAt?.toISOString() ??
        latestScan?.createdAt.toISOString() ??
        null,
      scans: [...scans]
        .sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, 5)
        .map((scan) => ({
          scanId: scan.id,
          status: scan.status,
          score: scoreLabel(scan.score),
          grade: scan.grade,
          createdAt: scan.createdAt.toISOString(),
          completedAt: scan.completedAt?.toISOString() ?? null,
        })),
    };
  });
}

export function createAdminRouter({
  requireAuth,
  scanResultService = createPrismaScanResultService(),
  scanReportCacheService = createPrismaScanReportCacheService(),
}: CreateAdminRouterOptions) {
  const router = Router();

  router.use(requireAuth as unknown as RequestHandler);
  router.use(requireSuperAdmin);

  router.get("/notices", async (_request, response) => {
    const prisma = getDatabase();

    const notices = await prisma.noticePopup.findMany({
      orderBy: [{ createdAt: "desc" }],
    });

    response.json({
      notices: notices.map(serializeNotice),
    });
  });

  router.post("/notices", async (request, response) => {
    const parsed = noticeInputSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      });
      return;
    }

    try {
      const prisma = getDatabase();
      const notice = await prisma.noticePopup.create({
        data: {
          title: parsed.data.title,
          content: parsed.data.content,
          startsAt: parseOptionalDate(parsed.data.startsAt),
          endsAt: parseOptionalDate(parsed.data.endsAt),
        },
      });

      response.status(201).json({
        notice: serializeNotice(notice),
      });
    } catch (error) {
      response.status(400).json({
        code: "NOTICE_SAVE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "공지사항을 저장하지 못했습니다.",
      });
    }
  });

  router.put("/notices/:noticeId", async (request, response) => {
    const parsed = noticeInputSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      });
      return;
    }

    try {
      const prisma = getDatabase();
      const notice = await prisma.noticePopup.update({
        where: { id: request.params.noticeId },
        data: {
          title: parsed.data.title,
          content: parsed.data.content,
          startsAt: parseOptionalDate(parsed.data.startsAt),
          endsAt: parseOptionalDate(parsed.data.endsAt),
        },
      });

      response.json({
        notice: serializeNotice(notice),
      });
    } catch (error) {
      response.status(400).json({
        code: "NOTICE_UPDATE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "공지사항을 수정하지 못했습니다.",
      });
    }
  });

  router.delete("/notices/:noticeId", async (request, response) => {
    try {
      const prisma = getDatabase();

      await prisma.noticePopup.delete({
        where: { id: request.params.noticeId },
      });

      response.json({
        message: "공지사항을 삭제했습니다.",
      });
    } catch {
      response.status(404).json({
        code: "NOTICE_NOT_FOUND",
        message: "삭제할 공지사항을 찾지 못했습니다.",
      });
    }
  });

  router.get("/members", async (request, response) => {
    const parsed = memberQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: "검색 조건을 확인해 주세요.",
      });
      return;
    }

    const prisma = getDatabase();
    const query = parsed.data.q.trim().toLowerCase();

    const users = await prisma.user.findMany({
      where:
        parsed.data.status === "ALL"
          ? undefined
          : { status: parsed.data.status },
      orderBy: [{ createdAt: "desc" }],
      include: {
        authAccounts: {
          select: {
            provider: true,
          },
        },
        organizationMembers: {
          include: {
            organization: {
              include: {
                sites: {
                  include: {
                    scans: {
                      select: {
                        id: true,
                        status: true,
                        score: true,
                        grade: true,
                        createdAt: true,
                        completedAt: true,
                      },
                      orderBy: [{ createdAt: "asc" }],
                    },
                  },
                  orderBy: [{ createdAt: "desc" }],
                },
              },
            },
          },
        },
      },
    });

    const members = users
      .map((user) => {
        const sites = buildSiteSummaries(user.organizationMembers);
        const authProviders = [
          ...new Set(user.authAccounts.map((account) => account.provider)),
        ];

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          authProviders,
          sites,
        };
      })
      .filter((member) => {
        if (!query) {
          return true;
        }

        return (
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query) ||
          member.sites.some(
            (site) =>
              site.siteName.toLowerCase().includes(query) ||
              site.baseUrl.toLowerCase().includes(query) ||
              (site.finalUrl?.toLowerCase().includes(query) ?? false),
          )
        );
      });

    response.json({ members });
  });

  router.get(
    "/scan-results/:scanId/export.pdf",
    async (request, response) => {
      const scanId = readRouteParam(request.params.scanId).trim();
      const getScanResultForAdmin =
        scanResultService.getScanResultForAdmin?.bind(scanResultService);

      if (!scanId) {
        response.status(400).json({
          code: "SCAN_ID_REQUIRED",
          message: "진단 ID를 확인해 주세요.",
        });
        return;
      }

      if (!getScanResultForAdmin) {
        response.status(500).json({
          code: "ADMIN_REPORT_UNAVAILABLE",
          message: "관리자 리포트 조회 기능을 사용할 수 없습니다.",
        });
        return;
      }

      try {
        const result = await getScanResultForAdmin(scanId);
        const cached = await scanReportCacheService.getOrCreate(result);
        const pdf = cached.pdf;
        const filename = `admin-${scanResultPdfFilename(result)}`;

        response
          .status(200)
          .type("application/pdf")
          .set({
            "Cache-Control": "private, no-store",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(pdf.length),
            "X-Site-AI-Report-Cache": cached.cacheStatus,
          })
          .send(pdf);
      } catch (error) {
        if (error instanceof ScanResultServiceError) {
          response.status(error.status).json({
            code: error.code,
            message: error.message,
          });
          return;
        }

        if (error instanceof ScanReportCacheError) {
          response.status(error.status).json({
            code: error.code,
            message: error.message,
          });
          return;
        }

        response.status(500).json({
          code: "ADMIN_REPORT_EXPORT_FAILED",
          message: "관리자 리포트 PDF를 생성하는 중 오류가 발생했습니다.",
        });
      }
    },
  );
  router.patch("/members/:userId/status", async (request, response) => {
    const parsed = memberStatusSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "상태값을 확인해 주세요.",
      });
      return;
    }

    const prisma = getDatabase();
    const targetUser = await prisma.user.findUnique({
      where: { id: request.params.userId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser) {
      response.status(404).json({
        code: "MEMBER_NOT_FOUND",
        message: "회원을 찾지 못했습니다.",
      });
      return;
    }

    if (
      targetUser.role === "SUPER_ADMIN" ||
      targetUser.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
    ) {
      response.status(403).json({
        code: "ADMIN_MEMBER_CONTROL_FORBIDDEN",
        message: "총관리자 계정은 정지할 수 없습니다.",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: { status: parsed.data.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    response.json({
      member: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    });
  });

  router.delete("/members/:userId", async (request, response) => {
    const parsed = memberDeleteSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      });
      return;
    }

    const adminPasswordOk = await verifyAdminPassword(
      response.locals.authUser.id,
      parsed.data.adminPassword,
    );

    if (!adminPasswordOk) {
      response.status(401).json({
        code: "ADMIN_PASSWORD_INVALID",
        message: "관리자 비밀번호가 올바르지 않습니다.",
      });
      return;
    }

    const prisma = getDatabase();
    const targetUser = await prisma.user.findUnique({
      where: { id: request.params.userId },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                members: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      response.status(404).json({
        code: "MEMBER_NOT_FOUND",
        message: "회원을 찾지 못했습니다.",
      });
      return;
    }

    if (
      targetUser.role === "SUPER_ADMIN" ||
      targetUser.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
    ) {
      response.status(403).json({
        code: "ADMIN_MEMBER_DELETE_FORBIDDEN",
        message: "총관리자 계정은 삭제할 수 없습니다.",
      });
      return;
    }

    const ownOrganizationIds = targetUser.organizationMembers
      .filter((member) => member.organization.members.length <= 1)
      .map((member) => member.organizationId);
    const sharedOrganizationIds = targetUser.organizationMembers
      .filter((member) => member.organization.members.length > 1)
      .map((member) => member.organizationId);

    await prisma.$transaction(async (transaction) => {
      if (ownOrganizationIds.length > 0) {
        await transaction.organization.deleteMany({
          where: { id: { in: ownOrganizationIds } },
        });
      }

      if (sharedOrganizationIds.length > 0) {
        await transaction.organizationMember.deleteMany({
          where: {
            userId: targetUser.id,
            organizationId: { in: sharedOrganizationIds },
          },
        });
      }

      await transaction.emailVerificationToken.deleteMany({
        where: { email: targetUser.email },
      });

      await transaction.user.delete({
        where: { id: targetUser.id },
      });
    });

    response.json({
      message: "회원을 삭제했습니다.",
    });
  });

  router.get("/overview", async (_request, response) => {
    const prisma = getDatabase();

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalOrganizations,
      totalSites,
      totalScans,
      completedScans,
      totalWorkOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.organization.count(),
      prisma.site.count(),
      prisma.scan.count(),
      prisma.scan.count({ where: { status: "COMPLETED" } }),
      prisma.workOrder.count(),
    ]);

    response.json({
      admin: response.locals.authUser,
      counts: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalOrganizations,
        totalSites,
        totalScans,
        completedScans,
        totalWorkOrders,
      },
      capabilities: {
        noticeManagement: "enabled",
        memberManagement: "enabled",
        paidFeatureTestBypass: "planned",
      },
    });
  });

  return router;
}
