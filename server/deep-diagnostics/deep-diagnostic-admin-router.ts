import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  DeepDiagnosticAdminServiceError,
  SITE_FACT_KEYS,
  type DeepDiagnosticAdminService,
} from "./deep-diagnostic-admin-service";

const factKeySchema = z.enum(SITE_FACT_KEYS);
const questionKindSchema = z.enum([
  "BRAND",
  "DISCOVERY",
  "FEATURE",
  "USE_CASE",
  "TRUST",
  "COMPARISON",
  "CUSTOM",
]);
const questionStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
const factKeysSchema = z
  .array(factKeySchema)
  .max(SITE_FACT_KEYS.length)
  .transform((values) => [...new Set(values)]);

const saveFactSchema = z.object({
  value: z.string().trim().min(1).max(4_000),
});

const createQuestionSchema = z.object({
  kind: questionKindSchema,
  question: z.string().trim().min(5).max(500),
  expectedFactKeys: factKeysSchema,
  isRequired: z.boolean().default(true),
});

const updateQuestionSchema = z
  .object({
    kind: questionKindSchema.optional(),
    question: z.string().trim().min(5).max(500).optional(),
    expectedFactKeys: factKeysSchema.optional(),
    isRequired: z.boolean().optional(),
    status: questionStatusSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "수정할 값을 입력해 주세요.",
  );

interface CreateDeepDiagnosticAdminRouterOptions {
  service: DeepDiagnosticAdminService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function routeParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function validationError(response: Response): void {
  response.status(400).json({
    code: "VALIDATION_ERROR",
    message: "입력값을 확인해 주세요.",
  });
}

function handleError(response: Response, error: unknown): void {
  if (error instanceof DeepDiagnosticAdminServiceError) {
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

export function createDeepDiagnosticAdminRouter(
  options: CreateDeepDiagnosticAdminRouterOptions,
) {
  const router = Router();
  const { service, requireAuth } = options;

  router.get(
    "/sites/:siteId/setup",
    requireAuth,
    async (request, response) => {
      try {
        const setup = await service.getSetup(
          response.locals.authUser,
          routeParam(request.params.siteId),
        );
        response.json({ setup });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.put(
    "/sites/:siteId/facts/:factKey",
    requireAuth,
    async (request, response) => {
      const factKey = factKeySchema.safeParse(
        routeParam(request.params.factKey),
      );
      const body = saveFactSchema.safeParse(request.body);

      if (!factKey.success || !body.success) {
        validationError(response);
        return;
      }

      try {
        const fact = await service.saveFact(
          response.locals.authUser,
          routeParam(request.params.siteId),
          factKey.data,
          body.data.value,
        );
        response.json({ fact });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.delete(
    "/sites/:siteId/facts/:factKey",
    requireAuth,
    async (request, response) => {
      const factKey = factKeySchema.safeParse(
        routeParam(request.params.factKey),
      );

      if (!factKey.success) {
        validationError(response);
        return;
      }

      try {
        await service.deleteFact(
          response.locals.authUser,
          routeParam(request.params.siteId),
          factKey.data,
        );
        response.status(204).end();
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/sites/:siteId/runs",
    requireAuth,
    async (request, response) => {
      try {
        const scan = await service.startDiagnostic(
          response.locals.authUser,
          routeParam(request.params.siteId),
        );
        response.status(201).json({ scan });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/sites/:siteId/questions/defaults",
    requireAuth,
    async (request, response) => {
      try {
        const questions = await service.ensureDefaultQuestions(
          response.locals.authUser,
          routeParam(request.params.siteId),
        );
        response.json({ questions });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/sites/:siteId/questions",
    requireAuth,
    async (request, response) => {
      const body = createQuestionSchema.safeParse(request.body);

      if (!body.success) {
        validationError(response);
        return;
      }

      try {
        const question = await service.createQuestion(
          response.locals.authUser,
          routeParam(request.params.siteId),
          body.data,
        );
        response.status(201).json({ question });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.patch(
    "/sites/:siteId/questions/:questionId",
    requireAuth,
    async (request, response) => {
      const body = updateQuestionSchema.safeParse(request.body);

      if (!body.success) {
        validationError(response);
        return;
      }

      try {
        const question = await service.updateQuestion(
          response.locals.authUser,
          routeParam(request.params.siteId),
          routeParam(request.params.questionId),
          body.data,
        );
        response.json({ question });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  return router;
}
