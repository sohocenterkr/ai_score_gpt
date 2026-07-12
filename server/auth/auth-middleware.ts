import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import type { AuthService, PublicUser } from "./auth-service";
import { resolveDevUserPreviewFromRequest } from "./dev-user-preview";
import { readSessionToken } from "./session-cookie";

export interface AuthenticatedResponseLocals {
  authUser: PublicUser;
  devUserPreview?: boolean;
}

export function createRequireAuth(authService: AuthService) {
  return async function requireAuth(
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) {
    try {
      const rawToken = readSessionToken(request);
      const user = rawToken
        ? await authService.getSessionUser(rawToken)
        : null;

      if (!user) {
        response.status(401).json({
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
        });
        return;
      }

      const preview = resolveDevUserPreviewFromRequest(
        request,
        user,
        env.NODE_ENV,
        env.SUPER_ADMIN_EMAIL,
      );

      if (preview.readOnlyViolation) {
        response.status(409).json({
          code: "DEV_USER_PREVIEW_READ_ONLY",
          message:
            "일반 사용자 미리보기에서는 데이터 변경 요청을 실행할 수 없습니다.",
        });
        return;
      }

      response.locals.authUser = preview.user;
      response.locals.devUserPreview = preview.active;

      if (preview.active) {
        response.setHeader("X-Site-AI-Dev-User-Preview", "active");
      }

      next();
    } catch {
      response.status(500).json({
        code: "INTERNAL_ERROR",
        message: "요청을 처리하는 중 오류가 발생했습니다.",
      });
    }
  };
}
