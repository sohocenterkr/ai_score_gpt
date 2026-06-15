import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  SiteServiceError,
  SiteUrlError,
  type SiteService,
} from "./site-service";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || undefined);

const nullableOptionalText = (maxLength: number) =>
  z
    .union([z.string().trim().max(maxLength), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) {
        return value;
      }

      return value || null;
    });

const createSiteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z.string().trim().min(1).max(2_048),
  siteType: optionalText(80),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).default("KR"),
  region: optionalText(100),
  primaryLocale: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .default("ko"),
});

const updateSiteSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    baseUrl: z.string().trim().min(1).max(2_048).optional(),
    siteType: nullableOptionalText(80),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
    region: nullableOptionalText(100),
    primaryLocale: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "수정할 값을 입력해 주세요.",
  );

const scanSchema = z.object({
  type: z.enum(["QUICK", "DEEP"]).default("QUICK"),
});

interface CreateSiteRouterOptions {
  siteService: SiteService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function handleError(response: Response, error: unknown): void {
  if (error instanceof SiteServiceError || error instanceof SiteUrlError) {
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

function validationError(response: Response): void {
  response.status(400).json({
    code: "VALIDATION_ERROR",
    message: "입력값을 확인해 주세요.",
  });
}

function readRouteParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function createSiteRouter(options: CreateSiteRouterOptions) {
  const router = Router();
  const { siteService, requireAuth } = options;

  router.get("/", requireAuth, async (_request, response) => {
    try {
      const sites = await siteService.listSites(response.locals.authUser);
      response.json({ sites });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.post("/", requireAuth, async (request, response) => {
    const parsed = createSiteSchema.safeParse(request.body);

    if (!parsed.success) {
      validationError(response);
      return;
    }

    try {
      const site = await siteService.createSite(
        response.locals.authUser,
        parsed.data,
      );
      response.status(201).json({ site });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.get("/:siteId", requireAuth, async (request, response) => {
    try {
      const site = await siteService.getSite(
        response.locals.authUser,
        readRouteParam(request.params.siteId),
      );
      response.json({ site });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.patch("/:siteId", requireAuth, async (request, response) => {
    const parsed = updateSiteSchema.safeParse(request.body);

    if (!parsed.success) {
      validationError(response);
      return;
    }

    try {
      const site = await siteService.updateSite(
        response.locals.authUser,
        readRouteParam(request.params.siteId),
        parsed.data,
      );
      response.json({ site });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.delete("/:siteId", requireAuth, async (request, response) => {
    try {
      await siteService.archiveSite(
        response.locals.authUser,
        readRouteParam(request.params.siteId),
      );
      response.status(204).end();
    } catch (error) {
      handleError(response, error);
    }
  });

  router.get(
    "/:siteId/scans",
    requireAuth,
    async (request, response) => {
      try {
        const scans = await siteService.listScans(
          response.locals.authUser,
          readRouteParam(request.params.siteId),
        );
        response.json({ scans });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/:siteId/scans",
    requireAuth,
    async (request, response) => {
      const parsed = scanSchema.safeParse(request.body);

      if (!parsed.success) {
        validationError(response);
        return;
      }

      try {
        const scan = await siteService.queueScan(
          response.locals.authUser,
          readRouteParam(request.params.siteId),
          parsed.data.type,
        );
        response.status(201).json({ scan });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  return router;
}
