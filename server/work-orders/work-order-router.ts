import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  renderWorkOrderPdf,
  workOrderPdfFilename,
} from "./work-order-pdf";
import {
  WorkOrderServiceError,
  type WorkOrderService,
} from "./work-order-service";

const createSchema = z.object({
  scanId: z.string().trim().min(1).max(100),
  findingIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(50),
});

interface CreateWorkOrderRouterOptions {
  workOrderService: WorkOrderService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function readRouteParam(
  value: string | string[] | undefined,
): string {
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

export function createWorkOrderRouter(
  options: CreateWorkOrderRouterOptions,
) {
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

  router.post("/", requireAuth, async (request, response) => {
    const parsed = createSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: "검사와 작업지시서 대상 문제를 확인해 주세요.",
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
  });

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
    "/:workOrderId/revise",
    requireAuth,
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
    async (request, response) => {
      try {
        const workOrder = await workOrderService.getWorkOrder(
          response.locals.authUser,
          readRouteParam(request.params.workOrderId),
        );
        const pdf = await renderWorkOrderPdf(workOrder);

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
