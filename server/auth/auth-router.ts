import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { AuthError, type AuthService } from "./auth-service";
import { createMemoryRateLimit } from "./rate-limit";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "./session-cookie";

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

const signupSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .min(2, "이름은 2자 이상 입력해 주세요.")
    .max(50, "이름은 50자 이하여야 합니다."),
  password: passwordSchema,
  termsAccepted: z
    .boolean()
    .refine((value) => value, "이용약관에 동의해 주세요."),
  privacyAccepted: z
    .boolean()
    .refine((value) => value, "개인정보처리방침에 동의해 주세요."),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(128),
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

export function createAuthRouter(authService: AuthService) {
  const router = Router();
  const mutationRateLimit = createMemoryRateLimit({
    windowMs: 15 * 60 * 1_000,
    maxRequests: 20,
  });

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
        setSessionCookie(response, result.token, result.expiresAt);
        response.status(201).json({ user: result.user });
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
