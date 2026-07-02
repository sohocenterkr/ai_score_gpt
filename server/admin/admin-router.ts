import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import type {
  AuthenticatedResponseLocals,
  createRequireAuth,
} from "../auth/auth-middleware";
import { getDatabase } from "../db";

const SUPER_ADMIN_EMAIL = "sohocenter.kr@gmail.com";

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
        noticeManagement: "planned",
        memberManagement: "planned",
        paidFeatureTestBypass: "planned",
      },
    });
  });

  return router;
}
