import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "./auth-middleware";
import { AuthError } from "./auth-service";
import { createMemoryRateLimit } from "./rate-limit";
import { clearSessionCookie } from "./session-cookie";
import type { PasswordService } from "./password-service";
import type { PasswordResetMailer } from "../email/password-reset-mailer";

const emailSchema = z
  .string()
  .trim()
  .email("올바른 이메일 주소를 입력해 주세요.")
  .max(254, "이메일 주소가 너무 깁니다.");

const passwordSchema = z
  .string()
  .min(10, "비밀번호는 10자 이상이어야 합니다.")
  .max(128, "비밀번호는 128자 이하여야 합니다.")
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    "비밀번호에는 영문자와 숫자가 각각 1개 이상 필요합니다.",
  );

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const validateResetTokenSchema = z.object({
  token: z.string().trim().min(20).max(512),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(512),
  newPassword: passwordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

interface CreatePasswordRouterOptions {
  passwordService: PasswordService;
  passwordResetMailer: PasswordResetMailer;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function originGuard(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const origin = request.get("origin");

  if (!origin) {
    next();
    return;
  }

  try {
    const originHost = new URL(origin).host;
    const requestHost = request.get("host");

    if (requestHost && originHost === requestHost) {
      next();
      return;
    }
  } catch {
    // 아래 공통 거부 응답을 사용합니다.
  }

  response.status(403).json({
    code: "AUTH_CSRF_REJECTED",
    message: "요청 출처를 확인할 수 없습니다.",
  });
}

function validationError(response: Response, error: z.ZodError) {
  response.status(400).json({
    code: "VALIDATION_ERROR",
    message: error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    fields: error.flatten().fieldErrors,
  });
}

function handleAuthError(response: Response, error: unknown) {
  if (error instanceof AuthError) {
    response.status(error.status).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "요청을 처리하는 중 오류가 발생했습니다.",
  });
}

export function createPasswordRouter({
  passwordService,
  passwordResetMailer,
  requireAuth,
}: CreatePasswordRouterOptions) {
  const router = Router();
  const forgotRateLimit = createMemoryRateLimit({
    windowMs: 15 * 60 * 1_000,
    maxRequests: 5,
  });
  const resetRateLimit = createMemoryRateLimit({
    windowMs: 15 * 60 * 1_000,
    maxRequests: 10,
  });
  const validationRateLimit = createMemoryRateLimit({
    windowMs: 15 * 60 * 1_000,
    maxRequests: 30,
  });

  router.post(
    "/forgot-password",
    originGuard,
    forgotRateLimit,
    async (request, response) => {
      const parsed = forgotPasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      if (!passwordResetMailer.isConfigured()) {
        response.status(503).json({
          code: "EMAIL_NOT_CONFIGURED",
          message: "비밀번호 재설정 메일 설정이 완료되지 않았습니다.",
        });
        return;
      }

      try {
        const delivery = await passwordService.createPasswordReset(
          parsed.data.email,
        );

        if (delivery) {
          try {
            await passwordResetMailer.sendPasswordReset(delivery);
          } catch (error) {
            console.error(
              "비밀번호 재설정 메일 발송 실패:",
              error instanceof Error ? error.message : String(error),
            );
          }
        }

        response.status(202).json({
          message:
            "가입된 이메일이라면 비밀번호 재설정 링크를 발송했습니다.",
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/validate-reset-token",
    originGuard,
    validationRateLimit,
    async (request, response) => {
      const parsed = validateResetTokenSchema.safeParse(request.body);

      if (!parsed.success) {
        response.json({ valid: false });
        return;
      }

      try {
        const valid = await passwordService.validatePasswordReset(
          parsed.data.token,
        );
        response.json({ valid });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/reset-password",
    originGuard,
    resetRateLimit,
    async (request, response) => {
      const parsed = resetPasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        await passwordService.resetPassword(
          parsed.data.token,
          parsed.data.newPassword,
        );
        clearSessionCookie(response);
        response.json({
          message: "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.",
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/change-password",
    originGuard,
    resetRateLimit,
    requireAuth,
    async (
      request,
      response: Response<unknown, AuthenticatedResponseLocals>,
    ) => {
      const parsed = changePasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        await passwordService.changePassword(
          response.locals.authUser.id,
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );
        clearSessionCookie(response);
        response.status(204).end();
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  return router;
}
