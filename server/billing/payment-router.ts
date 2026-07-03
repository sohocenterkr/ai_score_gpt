import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  PaymentServiceError,
  type PaymentService,
} from "./payment-service";

const createPaymentOrderSchema = z.object({
  scanId: z.string().trim().min(1).max(100),
  plan: z.enum(["BASIC", "CASE_STUDY_DISCOUNT"]),
  provider: z.enum(["PORTONE"]).default("PORTONE"),
});

const completePaymentOrderSchema = z.object({
  providerPaymentId: z.string().trim().min(1).max(120),
});

interface CreatePaymentRouterOptions {
  paymentService: PaymentService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function handleError(response: Response, error: unknown): void {
  if (error instanceof PaymentServiceError) {
    response.status(error.status).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "결제 요청을 처리하는 중 오류가 발생했습니다.",
  });
}

export function createPaymentRouter({
  paymentService,
  requireAuth,
}: CreatePaymentRouterOptions) {
  const router = Router();

  router.post("/payment-orders", requireAuth, async (request, response) => {
    const parsed = createPaymentOrderSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: "결제 상품과 진단 결과를 확인해 주세요.",
      });
      return;
    }

    try {
      const result = await paymentService.createPaymentOrder(
        response.locals.authUser,
        parsed.data,
      );
      response.status(201).json(result);
    } catch (error) {
      handleError(response, error);
    }
  });

  router.post(
    "/payment-orders/:paymentOrderId/complete",
    requireAuth,
    async (request, response) => {
      const parsed = completePaymentOrderSchema.safeParse(request.body);

      if (!parsed.success) {
        response.status(400).json({
          code: "VALIDATION_ERROR",
          message: "결제 완료 정보를 확인해 주세요.",
        });
        return;
      }

      try {
        const result = await paymentService.completePaymentOrder(
          response.locals.authUser,
          {
            paymentOrderId:
              typeof request.params.paymentOrderId === "string"
                ? request.params.paymentOrderId
                : "",
            providerPaymentId: parsed.data.providerPaymentId,
          },
        );
        response.status(200).json(result);
      } catch (error) {
        handleError(response, error);
      }
    },
  );

  return router;
}
