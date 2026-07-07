import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  hasPaidFeatureAccessForScan,
  hasPaidFeatureAccessForWorkOrder,
  sendPaidFeatureRequired,
} from "../billing/paid-feature-access";
import { renderWorkOrderPdf, workOrderPdfFilename } from "./work-order-pdf";
import { createSafeHttpFetcher } from "../scans/http-fetcher";
import { runQueuedScanById } from "../scans/scan-worker";
import {
  WorkOrderServiceError,
  type WorkOrderService,
} from "./work-order-service";

const renderedImprovementCodeSchema = z.enum([
  "RENDERED-ADDED-CONTENT",
  "RENDERED-INCONSISTENT-INFORMATION",
  "INITIAL-HTML-MISSING-CORE",
]);

const verificationSchema = z.object({
  submittedUrl: z.string().trim().min(1).max(2_048),
});

const createSchema = z
  .object({
    scanId: z.string().trim().min(1).max(100),
    findingIds: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    renderedImprovementCodes: z
      .array(renderedImprovementCodeSchema)
      .max(3)
      .default([]),
    locale: z.enum(["ko", "en"]).default("ko"),
  })
  .superRefine((value, context) => {
    const total =
      value.findingIds.length + value.renderedImprovementCodes.length;

    if (total < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "작업지시서 대상 항목을 1개 이상 선택해 주세요.",
      });
    }

    if (total > 50) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "작업지시서 대상 항목은 최대 50개입니다.",
      });
    }
  });

interface CreateWorkOrderRouterOptions {
  workOrderService: WorkOrderService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function handleError(response: Response, error: unknown): void {
  if (error instanceof WorkOrderServiceError) {
    response.status(error.status).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "작업지시서 요청을 처리하는 중 오류가 발생했습니다.",
  });
}

function filename(orderNumber: string, version: number, extension: string) {
  return `${orderNumber}-v${version}.${extension}`.replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
}

async function requirePaidWorkOrderFeature(
  request: Request,
  response: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
): Promise<void> {
  const workOrderId = readRouteParam(request.params.workOrderId);
  const body = request.body as { scanId?: unknown } | undefined;
  const scanId = typeof body?.scanId === "string" ? body.scanId.trim() : "";

  if (!workOrderId && !scanId) {
    next();
    return;
  }

  try {
    const hasAccess = workOrderId
      ? await hasPaidFeatureAccessForWorkOrder(
          response.locals.authUser,
          workOrderId,
        )
      : await hasPaidFeatureAccessForScan(response.locals.authUser, scanId);

    if (hasAccess) {
      next();
      return;
    }

    sendPaidFeatureRequired(
      response,
      "수정 작업지시서는 유료 결제 후 제공됩니다. 결제 기능은 준비 중입니다.",
    );
  } catch {
    response.status(500).json({
      code: "INTERNAL_ERROR",
      message: "유료 기능 접근 권한을 확인하는 중 오류가 발생했습니다.",
    });
  }
}

export function createWorkOrderRouter(options: CreateWorkOrderRouterOptions) {
  const router = Router();
  const { workOrderService, requireAuth } = options;

  router.get("/", requireAuth, async (_request, response) => {
    try {
      const workOrders = await workOrderService.listWorkOrders(
        response.locals.authUser,
      );
      response.json({ workOrders });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.post(
    "/",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      const parsed = createSchema.safeParse(request.body);

      if (!parsed.success) {
        response.status(400).json({
          code: "VALIDATION_ERROR",
          message: "검사와 작업지시서 대상 항목을 확인해 주세요.",
        });
        return;
      }

      try {
        const workOrder = await workOrderService.createWorkOrder(
          response.locals.authUser,
          parsed.data,
        );
        response.status(201).json({ workOrder });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.get("/:workOrderId", requireAuth, async (request, response) => {
    try {
      const workOrder = await workOrderService.getWorkOrder(
        response.locals.authUser,
        readRouteParam(request.params.workOrderId),
      );
      response.json({ workOrder });
    } catch (error) {
      handleError(response, error);
    }
  });

  router.post(
    "/:workOrderId/issue",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        const workOrder = await workOrderService.issueWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        response.json({ workOrder });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/:workOrderId/verifications",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      const parsed = verificationSchema.safeParse(request.body);

      if (!parsed.success) {
        response.status(400).json({
          code: "VALIDATION_ERROR",
          message: "검수할 공개 배포 URL을 확인해 주세요.",
        });
        return;
      }

      try {
        const workOrderId = readRouteParam(request.params.workOrderId);
        const workOrder = await workOrderService.submitVerification(
          response.locals.authUser,
          workOrderId,
          parsed.data,
        );

        const queuedAttempt = workOrder.verificationAttempts.find(
          (attempt) => attempt.status === "QUEUED",
        );

        if (process.env.VERCEL === "1" && queuedAttempt) {
          await runQueuedScanById(
            queuedAttempt.scan.id,
            createSafeHttpFetcher(),
          );

          const refreshedWorkOrder = await workOrderService.getWorkOrder(
            response.locals.authUser,
            workOrderId,
          );

          response.status(201).json({ workOrder: refreshedWorkOrder });
          return;
        }

        response.status(201).json({ workOrder });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.post(
    "/:workOrderId/revise",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        const workOrder = await workOrderService.reviseWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        response.status(201).json({ workOrder });
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.delete(
    "/:workOrderId",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        await workOrderService.cancelWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        response.status(204).end();
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.get(
    "/:workOrderId/export.json",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        const exported = await workOrderService.exportJson(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        response
          .status(200)
          .type("application/json")
          .set(
            "Content-Disposition",
            `attachment; filename="${filename(
              exported.workOrder.orderNumber,
              exported.workOrder.version,
              "json",
            )}"`,
          )
          .send(JSON.stringify(exported, null, 2));
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.get(
    "/:workOrderId/export.pdf",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        const workOrder = await workOrderService.getWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        const locale = request.query.locale === "en" ? "en" : "ko";
        const pdf = await renderWorkOrderPdf(workOrder, { locale });

        response
          .status(200)
          .type("application/pdf")
          .set({
            "Cache-Control": "private, no-store",
            "Content-Disposition": `attachment; filename="${workOrderPdfFilename(
              workOrder,
            )}"`,
            "Content-Length": String(pdf.length),
          })
          .send(pdf);
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  router.get(
    "/:workOrderId/export.csv",
    requireAuth,
    requirePaidWorkOrderFeature,
    async (request, response) => {
      try {
        const workOrder = await workOrderService.getWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        const csv = await workOrderService.exportCsv(
          response.locals.authUser,
          workOrder.id,
        );

        response
          .status(200)
          .type("text/csv")
          .set(
            "Content-Disposition",
            `attachment; filename="${filename(
              workOrder.orderNumber,
              workOrder.version,
              "csv",
            )}"`,
          )
          .send(csv);
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  return router;
}
