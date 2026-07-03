import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { env } from "../config/env";
import { getDatabase } from "../db";

export type PaymentPlan = "BASIC" | "CASE_STUDY_DISCOUNT";
export type PaymentProviderCode = "PORTONE";

export interface CreatePaymentOrderInput {
  scanId: string;
  plan: PaymentPlan;
  provider: PaymentProviderCode;
}

export interface PublicPaymentOrder {
  id: string;
  provider: "PORTONE" | "POLAR";
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  plan: "BASIC" | "CASE_STUDY_DISCOUNT";
  amount: number;
  currency: string;
  providerPaymentId: string | null;
  site: {
    id: string;
    name: string;
    baseUrl: string;
    finalUrl: string | null;
  };
  scan: {
    id: string;
  } | null;
}

export interface PortOneCheckoutReady {
  configured: boolean;
  storeId: string | null;
  channelKey: string | null;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: "KRW";
  payMethod: "CARD";
}

export interface CreatePaymentOrderResult {
  paymentOrder: PublicPaymentOrder;
  portone: PortOneCheckoutReady;
}

export interface CompletePaymentOrderInput {
  paymentOrderId: string;
  providerPaymentId: string;
}

export interface PaymentService {
  createPaymentOrder(
    user: PublicUser,
    input: CreatePaymentOrderInput,
  ): Promise<CreatePaymentOrderResult>;

  completePaymentOrder(
    user: PublicUser,
    input: CompletePaymentOrderInput,
  ): Promise<{ paymentOrder: PublicPaymentOrder }>;
}

export class PaymentServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

const DOMESTIC_PRICES: Record<PaymentPlan, number> = {
  BASIC: 140_000,
  CASE_STUDY_DISCOUNT: 100_000,
};

function normalizeId(value: string): string {
  return value.trim();
}

function createProviderPaymentId(): string {
  return `sas_${Date.now()}_${randomBytes(8).toString("hex")}`;
}

function orderName(siteName: string, plan: PaymentPlan): string {
  const suffix =
    plan === "CASE_STUDY_DISCOUNT" ? "개선 사례 활용 동의" : "기본";
  const compactSiteName = siteName.trim().slice(0, 24) || "사이트";
  return `Site AI Score 상세 보고서 - ${compactSiteName} (${suffix})`;
}

interface PortOnePaymentLookupResponse {
  payment?: unknown;
  id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  paidAt?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function paymentFromLookupResponse(
  data: PortOnePaymentLookupResponse,
): Record<string, unknown> {
  const candidate = isRecord(data.payment) ? data.payment : data;
  return isRecord(candidate) ? candidate : {};
}

function paymentAmountTotal(payment: Record<string, unknown>): number | null {
  const amount = payment.amount;

  if (typeof amount === "number") {
    return amount;
  }

  if (!isRecord(amount)) {
    return null;
  }

  const total = amount.total;
  return typeof total === "number" ? total : null;
}

function normalizePaymentCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value === "CURRENCY_KRW" ? "KRW" : value;
}

function paymentPaidAt(payment: Record<string, unknown>): Date {
  const paidAt = payment.paidAt;

  if (typeof paidAt === "string") {
    const parsed = new Date(paidAt);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

async function fetchPortOnePayment(
  providerPaymentId: string,
): Promise<Record<string, unknown>> {
  if (!env.PORTONE_API_SECRET) {
    throw new PaymentServiceError(
      "PORTONE_API_SECRET_REQUIRED",
      "PortOne API Secret이 설정되지 않아 결제 완료 검증을 할 수 없습니다.",
      503,
    );
  }

  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(
      providerPaymentId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `PortOne ${env.PORTONE_API_SECRET}`,
      },
    },
  );

  const data = (await response.json().catch(() => null)) as
    | PortOnePaymentLookupResponse
    | null;

  if (!response.ok || !data) {
    throw new PaymentServiceError(
      "PORTONE_PAYMENT_LOOKUP_FAILED",
      "PortOne 결제 정보를 확인하지 못했습니다.",
      502,
    );
  }

  return paymentFromLookupResponse(data);
}

function publicOrder(record: {
  id: string;
  provider: "PORTONE" | "POLAR";
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  plan: "BASIC" | "CASE_STUDY_DISCOUNT";
  amount: number;
  currency: string;
  providerPaymentId: string | null;
  site: {
    id: string;
    name: string;
    baseUrl: string;
    finalUrl: string | null;
  };
  scan: {
    id: string;
  } | null;
}): PublicPaymentOrder {
  return {
    id: record.id,
    provider: record.provider,
    status: record.status,
    plan: record.plan,
    amount: record.amount,
    currency: record.currency,
    providerPaymentId: record.providerPaymentId,
    site: record.site,
    scan: record.scan,
  };
}

export function createPrismaPaymentService(): PaymentService {
  return {
    async createPaymentOrder(user, input) {
      if (input.provider !== "PORTONE") {
        throw new PaymentServiceError(
          "PAYMENT_PROVIDER_NOT_SUPPORTED",
          "현재 국내 결제는 PortOne만 준비 중입니다.",
          400,
        );
      }

      const scanId = normalizeId(input.scanId);

      if (!scanId) {
        throw new PaymentServiceError(
          "PAYMENT_SCAN_REQUIRED",
          "결제할 진단 결과를 확인해 주세요.",
          400,
        );
      }

      const prisma = getDatabase();
      const scan = await prisma.scan.findFirst({
        where: {
          id: scanId,
          status: {
            in: ["COMPLETED", "PARTIAL"],
          },
          score: {
            not: null,
          },
          site: {
            status: "ACTIVE",
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
        include: {
          site: true,
        },
      });

      if (!scan) {
        throw new PaymentServiceError(
          "PAYMENT_SCAN_NOT_FOUND",
          "결제 가능한 진단 결과를 찾을 수 없습니다.",
          404,
        );
      }

      const existingEntitlement =
        await prisma.paidEntitlement.findFirst({
          where: {
            userId: user.id,
            status: "ACTIVE",
            OR: [
              {
                scanId: scan.id,
              },
              {
                siteId: scan.siteId,
              },
            ],
          },
          select: {
            id: true,
          },
        });

      if (existingEntitlement) {
        throw new PaymentServiceError(
          "PAID_ENTITLEMENT_EXISTS",
          "이미 유료 산출물 접근 권한이 열려 있습니다.",
          409,
        );
      }

      const amount = DOMESTIC_PRICES[input.plan];
      const providerPaymentId = createProviderPaymentId();
      const title = orderName(scan.site.name, input.plan);
      const configured = Boolean(
        env.PORTONE_STORE_ID && env.PORTONE_CHANNEL_KEY,
      );

      const order = await prisma.paymentOrder.create({
        data: {
          userId: user.id,
          siteId: scan.siteId,
          scanId: scan.id,
          provider: "PORTONE",
          status: "PENDING",
          plan: input.plan,
          amount,
          currency: "KRW",
          providerPaymentId,
          idempotencyKey: providerPaymentId,
          metadata: {
            source: "checkout",
            scanId: scan.id,
            siteId: scan.siteId,
            siteName: scan.site.name,
          } satisfies Prisma.InputJsonValue,
        },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              baseUrl: true,
              finalUrl: true,
            },
          },
          scan: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        paymentOrder: publicOrder(order),
        portone: {
          configured,
          storeId: env.PORTONE_STORE_ID ?? null,
          channelKey: env.PORTONE_CHANNEL_KEY ?? null,
          paymentId: providerPaymentId,
          orderName: title,
          totalAmount: amount,
          currency: "KRW",
          payMethod: "CARD",
        },
      };
    },

    async completePaymentOrder(user, input) {
      const paymentOrderId = normalizeId(input.paymentOrderId);
      const providerPaymentId = normalizeId(input.providerPaymentId);

      if (!paymentOrderId || !providerPaymentId) {
        throw new PaymentServiceError(
          "PAYMENT_COMPLETION_INVALID",
          "결제 완료 정보를 확인해 주세요.",
          400,
        );
      }

      const prisma = getDatabase();
      const order = await prisma.paymentOrder.findFirst({
        where: {
          id: paymentOrderId,
          userId: user.id,
          provider: "PORTONE",
        },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              baseUrl: true,
              finalUrl: true,
            },
          },
          scan: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!order) {
        throw new PaymentServiceError(
          "PAYMENT_ORDER_NOT_FOUND",
          "결제 주문을 찾을 수 없습니다.",
          404,
        );
      }

      if (order.providerPaymentId !== providerPaymentId) {
        throw new PaymentServiceError(
          "PAYMENT_ID_MISMATCH",
          "결제 주문과 결제창 결과가 일치하지 않습니다.",
          409,
        );
      }

      if (order.status === "PAID") {
        return {
          paymentOrder: publicOrder(order),
        };
      }

      const payment = await fetchPortOnePayment(providerPaymentId);
      const paymentStatus =
        typeof payment.status === "string" ? payment.status : "";
      const totalAmount = paymentAmountTotal(payment);
      const currency = normalizePaymentCurrency(payment.currency);

      if (paymentStatus !== "PAID") {
        if (
          paymentStatus === "FAILED" ||
          paymentStatus === "CANCELED" ||
          paymentStatus === "CANCELLED"
        ) {
          await prisma.paymentOrder.update({
            where: {
              id: order.id,
            },
            data: {
              status:
                paymentStatus === "FAILED" ? "FAILED" : "CANCELED",
              failedAt:
                paymentStatus === "FAILED" ? new Date() : undefined,
              canceledAt:
                paymentStatus === "FAILED" ? undefined : new Date(),
            },
          });
        }

        throw new PaymentServiceError(
          "PAYMENT_NOT_PAID",
          "결제가 완료된 상태가 아닙니다.",
          409,
        );
      }

      if (totalAmount !== order.amount || currency !== order.currency) {
        throw new PaymentServiceError(
          "PAYMENT_AMOUNT_MISMATCH",
          "결제 금액 또는 통화가 주문 정보와 일치하지 않습니다.",
          409,
        );
      }

      const paidAt = paymentPaidAt(payment);

      const paidOrder = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.paymentOrder.update({
          where: {
            id: order.id,
          },
          data: {
            status: "PAID",
            paidAt,
          },
          include: {
            site: {
              select: {
                id: true,
                name: true,
                baseUrl: true,
                finalUrl: true,
              },
            },
            scan: {
              select: {
                id: true,
              },
            },
          },
        });

        await transaction.paidEntitlement.upsert({
          where: {
            paymentOrderId: order.id,
          },
          update: {
            status: "ACTIVE",
            revokedAt: null,
          },
          create: {
            userId: order.userId,
            siteId: order.siteId,
            scanId: order.scanId,
            paymentOrderId: order.id,
            plan: order.plan,
            status: "ACTIVE",
            grantedAt: paidAt,
          },
        });

        return updated;
      });

      return {
        paymentOrder: publicOrder(paidOrder),
      };
    },
  };
}
