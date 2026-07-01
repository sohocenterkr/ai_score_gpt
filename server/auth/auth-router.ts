import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { AuthError, type AuthService } from "./auth-service";
import {
  confirmEmailVerification,
  createEmailVerificationDelivery,
  getEmailVerificationStatus,
} from "./email-verification-service";
import { createMemoryRateLimit } from "./rate-limit";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "./session-cookie";
import type { EmailVerificationMailer } from "../email/email-verification-mailer";

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

const signupSchema = z
  .object({
    email: emailSchema,
    name: z
      .string()
      .trim()
      .min(2, "이름은 2자 이상 입력해 주세요.")
      .max(50, "이름은 50자 이하여야 합니다."),
    password: passwordSchema,
    passwordConfirm: z
      .string()
      .min(1, "비밀번호 확인을 입력해 주세요.")
      .max(128, "비밀번호 확인은 128자 이하여야 합니다."),
    locale: z.enum(["ko", "en"]).default("ko"),
    termsAccepted: z
      .boolean()
      .refine((value) => value, "이용약관에 동의해 주세요."),
    privacyAccepted: z
      .boolean()
      .refine((value) => value, "개인정보처리방침에 동의해 주세요."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirm"],
        message: "비밀번호 확인이 일치하지 않습니다.",
      });
    }

  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(128),
});

const deleteAccountSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "현재 비밀번호를 입력해 주세요.")
    .max(128, "현재 비밀번호는 128자 이하여야 합니다."),
  confirmation: z
    .string()
    .trim()
    .refine(
      (value) => value === "회원탈퇴",
      "회원탈퇴를 정확히 입력해 주세요.",
    ),
});

const emailVerificationSchema = z.object({
  email: emailSchema,
  locale: z.enum(["ko", "en"]).default("ko"),
});

const emailVerificationConfirmSchema = z.object({
  email: emailSchema,
  emailVerificationId: z.string().trim().min(1).max(128),
  emailVerificationToken: z.string().trim().min(20).max(512),
});

const emailVerificationStatusSchema = z.object({
  email: emailSchema,
  emailVerificationId: z.string().trim().min(1).max(128),
});

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

export function createAuthRouter(
  authService: AuthService,
  emailVerificationMailer?: EmailVerificationMailer,
) {
  const router = Router();
  const mutationRateLimit = createMemoryRateLimit({
    windowMs: 15 * 60 * 1_000,
    maxRequests: 20,
  });

  router.post(
    "/email-verification",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const parsed = emailVerificationSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      if (!emailVerificationMailer?.isConfigured()) {
        response.status(503).json({
          code: "EMAIL_NOT_CONFIGURED",
          message: "이메일 인증 메일 설정이 완료되지 않았습니다.",
        });
        return;
      }

      try {
        const delivery = await createEmailVerificationDelivery(
          parsed.data.email,
          parsed.data.locale,
        );

        if (delivery) {
          await emailVerificationMailer.sendEmailVerification(delivery);
        }

        response.status(202).json({
          message:
            "인증 메일을 발송했습니다. 메일의 인증 링크를 눌러 회원가입을 계속해 주세요.",
          verificationId: delivery?.verificationId ?? null,
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/email-verification/confirm",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const parsed = emailVerificationConfirmSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        const verified = await confirmEmailVerification(
          parsed.data.email,
          parsed.data.emailVerificationId,
          parsed.data.emailVerificationToken,
        );

        if (!verified) {
          response.json({
            verified: false,
            message: "이메일 인증 링크가 올바르지 않거나 만료되었습니다.",
          });
          return;
        }

        const result = await authService.createSessionForVerifiedEmail({
          email: parsed.data.email,
        });
        setSessionCookie(response, result.token, result.expiresAt);

        response.json({
          verified: true,
          user: result.user,
          message: "이메일 인증이 완료되었습니다.",
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/email-verification/status",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const parsed = emailVerificationStatusSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        const status = await getEmailVerificationStatus(
          parsed.data.email,
          parsed.data.emailVerificationId,
        );

        response.json(status);
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/signup",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const parsed = signupSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        const result = await authService.signup(parsed.data);
        let emailVerificationSent = false;

        if (emailVerificationMailer?.isConfigured()) {
          const delivery = await createEmailVerificationDelivery(
            result.user.email,
            parsed.data.locale,
          );

          if (delivery) {
            await emailVerificationMailer.sendEmailVerification(delivery);
            emailVerificationSent = true;
          }
        }

        response.status(201).json({
          user: result.user,
          emailVerificationSent,
          message: emailVerificationSent
            ? "회원가입이 완료되었습니다. 이메일 인증 링크를 누르면 자동으로 로그인됩니다."
            : "회원가입이 완료되었습니다. 이메일 인증 메일 설정을 확인해 주세요.",
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/login",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const parsed = loginSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        const result = await authService.login(parsed.data);
        setSessionCookie(response, result.token, result.expiresAt);
        response.json({ user: result.user });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post(
    "/delete-account",
    originGuard,
    mutationRateLimit,
    async (request, response) => {
      const rawToken = readSessionToken(request);

      if (!rawToken) {
        response.status(401).json({
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
        });
        return;
      }

      const parsed = deleteAccountSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response, parsed.error);
        return;
      }

      try {
        await authService.deleteAccount(rawToken, {
          currentPassword: parsed.data.currentPassword,
        });
        clearSessionCookie(response);
        response.json({
          message: "회원탈퇴가 완료되었습니다.",
        });
      } catch (error) {
        handleAuthError(response, error);
      }
    },
  );

  router.post("/logout", originGuard, async (request, response) => {
    const rawToken = readSessionToken(request);

    try {
      if (rawToken) {
        await authService.logout(rawToken);
      }

      clearSessionCookie(response);
      response.status(204).end();
    } catch (error) {
      handleAuthError(response, error);
    }
  });

  router.get("/session", async (request, response) => {
    const rawToken = readSessionToken(request);

    if (!rawToken) {
      response.json({ authenticated: false, user: null });
      return;
    }

    try {
      const user = await authService.getSessionUser(rawToken);
      response.json({
        authenticated: Boolean(user),
        user,
      });
    } catch (error) {
      handleAuthError(response, error);
    }
  });

  return router;
}
