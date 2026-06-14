import type { NextFunction, Request, Response } from "express";
import type { AuthService, PublicUser } from "./auth-service";
import { readSessionToken } from "./session-cookie";

export interface AuthenticatedResponseLocals {
  authUser: PublicUser;
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

      response.locals.authUser = user;
      next();
    } catch {
      response.status(500).json({
        code: "INTERNAL_ERROR",
        message: "요청을 처리하는 중 오류가 발생했습니다.",
      });
    }
  };
}
