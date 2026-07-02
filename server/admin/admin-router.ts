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
import { getDatabase } from "../db";

const SUPER_ADMIN_EMAIL = "sohocenter.kr@gmail.com";

const noticeInputSchema = z.object({
  title: z.string().trim().min(1, "공지 제목을 입력해 주세요.").max(100),
  content: z.string().trim().min(1, "공지 내용을 입력해 주세요.").max(2000),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
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


type RequireAuthMiddleware = ReturnType<typeof createRequireAuth>;

interface CreateAdminRouterOptions {
  requireAuth: RequireAuthMiddleware;
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

export function createAdminRouter({ requireAuth }: CreateAdminRouterOptions) {
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
        memberManagement: "planned",
        paidFeatureTestBypass: "planned",
      },
    });
  });

  return router;
}
