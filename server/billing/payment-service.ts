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

export interface PaymentService {
  createPaymentOrder(
    user: PublicUser,
    input: CreatePaymentOrderInput,
  ): Promise<CreatePaymentOrderResult>;
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
  };
}
