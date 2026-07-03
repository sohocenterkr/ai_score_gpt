import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { Prisma } from "@prisma/client";
import { Webhook } from "@portone/server-sdk";
import { Polar } from "@polar-sh/sdk";
import type { PublicUser } from "../auth/auth-service";
import { env } from "../config/env";
import { getDatabase } from "../db";

export type PaymentPlan = "BASIC" | "CASE_STUDY_DISCOUNT";
export type PaymentProviderCode = "PORTONE" | "POLAR";

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

export interface PolarCheckoutReady {
  configured: boolean;
  checkoutUrl: string | null;
  checkoutId: string | null;
  productId: string | null;
  currency: "USD";
}

export interface CreatePaymentOrderResult {
  paymentOrder: PublicPaymentOrder;
  portone: PortOneCheckoutReady | null;
  polar: PolarCheckoutReady | null;
}

export interface CompletePaymentOrderInput {
  paymentOrderId: string;
  providerPaymentId: string;
}

export interface HandlePortOneWebhookInput {
  payload: string;
  headers: IncomingHttpHeaders;
}

export interface HandlePortOneWebhookResult {
  received: true;
  processed: boolean;
  paymentId: string | null;
  reason?: string;
}

export interface HandlePolarWebhookInput {
  payload: string;
  headers: IncomingHttpHeaders;
}

export interface HandlePolarWebhookResult {
  received: true;
  processed: boolean;
  eventType: string | null;
  paymentOrderId: string | null;
  reason?: string;
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

  handlePortOneWebhook(
    input: HandlePortOneWebhookInput,
  ): Promise<HandlePortOneWebhookResult>;

  handlePolarWebhook(
    input: HandlePolarWebhookInput,
  ): Promise<HandlePolarWebhookResult>;
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
  BASIC: 165_000,
  CASE_STUDY_DISCOUNT: 110_000,
};

const POLAR_PRICES: Record<PaymentPlan, number> = {
  BASIC: 10_000,
  CASE_STUDY_DISCOUNT: 7_000,
};

function polarProductId(plan: PaymentPlan): string | null {
  return plan === "CASE_STUDY_DISCOUNT"
    ? env.POLAR_CASE_STUDY_DISCOUNT_PRODUCT_ID ?? null
    : env.POLAR_BASIC_PRODUCT_ID ?? null;
}

function polarConfigured(plan: PaymentPlan): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN && polarProductId(plan));
}

function createPolarClient(): Polar {
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new PaymentServiceError(
      "POLAR_ACCESS_TOKEN_REQUIRED",
      "Polar Access Token이 설정되지 않았습니다.",
      503,
    );
  }

  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
  });
}

function stringFromUnknownRecord(
  record: unknown,
  key: string,
): string | null {
  if (!isRecord(record)) {
    return null;
  }

  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function extractPaymentIdFromWebhookPayload(payload: string): string | null {
  const parsed = JSON.parse(payload) as unknown;

  if (!isRecord(parsed)) {
    return null;
  }

  const data = isRecord(parsed.data) ? parsed.data : parsed;
  const direct =
    stringField(data, "paymentId") ??
    stringField(data, "payment_id") ??
    stringField(data, "id");

  if (direct) {
    return direct;
  }

  const payment = data.payment;

  if (isRecord(payment)) {
    return (
      stringField(payment, "paymentId") ??
      stringField(payment, "payment_id") ??
      stringField(payment, "id")
    );
  }

  return null;
}

async function verifyPortOneWebhook(
  payload: string,
  headers: IncomingHttpHeaders,
): Promise<void> {
  if (!env.PORTONE_WEBHOOK_SECRET) {
    throw new PaymentServiceError(
      "PORTONE_WEBHOOK_SECRET_REQUIRED",
      "PortOne 웹훅 시크릿이 설정되지 않았습니다.",
      503,
    );
  }

  try {
    await Webhook.verify(
      env.PORTONE_WEBHOOK_SECRET,
      payload,
      headers as Parameters<typeof Webhook.verify>[2],
    );
  } catch {
    throw new PaymentServiceError(
      "PORTONE_WEBHOOK_SIGNATURE_INVALID",
      "PortOne 웹훅 서명을 확인하지 못했습니다.",
      401,
    );
  }
}

const POLAR_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  const value = headers[name.toLowerCase()] ?? headers[name];

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim() ?? null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function polarWebhookSecretBytes(secret: string): Buffer {
  const trimmed = secret.trim();

  if (trimmed.startsWith("whsec_")) {
    return Buffer.from(trimmed.slice("whsec_".length), "base64");
  }

  return Buffer.from(trimmed, "utf8");
}

function parseStandardWebhookSignatureHeader(
  signatureHeader: string,
): string[] {
  return signatureHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [version, signature] = part.split(",", 2);
      return version === "v1" && signature ? signature : null;
    })
    .filter((signature): signature is string => Boolean(signature));
}

function constantTimeBase64Equal(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "base64");
  const rightBuffer = Buffer.from(right, "base64");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function verifyPolarWebhook(
  payload: string,
  headers: IncomingHttpHeaders,
): Promise<void> {
  if (!env.POLAR_WEBHOOK_SECRET) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_SECRET_REQUIRED",
      "Polar 웹훅 시크릿이 설정되지 않았습니다.",
      503,
    );
  }

  const webhookId = headerValue(headers, "webhook-id");
  const webhookTimestamp = headerValue(headers, "webhook-timestamp");
  const webhookSignature = headerValue(headers, "webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_HEADERS_MISSING",
      "Polar 웹훅 서명 헤더가 누락되었습니다.",
      401,
    );
  }

  if (webhookId.includes(".") || webhookTimestamp.includes(".")) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_HEADERS_INVALID",
      "Polar 웹훅 서명 헤더 형식이 올바르지 않습니다.",
      401,
    );
  }

  const timestampSeconds = Number(webhookTimestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_TIMESTAMP_INVALID",
      "Polar 웹훅 타임스탬프가 올바르지 않습니다.",
      401,
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    Math.abs(nowSeconds - timestampSeconds) > POLAR_WEBHOOK_TOLERANCE_SECONDS
  ) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE",
      "Polar 웹훅 타임스탬프 허용 범위를 벗어났습니다.",
      401,
    );
  }

  const expectedSignature = createHmac(
    "sha256",
    polarWebhookSecretBytes(env.POLAR_WEBHOOK_SECRET),
  )
    .update(`${webhookId}.${webhookTimestamp}.${payload}`, "utf8")
    .digest("base64");

  const signatures = parseStandardWebhookSignatureHeader(webhookSignature);
  const valid = signatures.some((signature) =>
    constantTimeBase64Equal(signature, expectedSignature),
  );

  if (!valid) {
    throw new PaymentServiceError(
      "POLAR_WEBHOOK_SIGNATURE_INVALID",
      "Polar 웹훅 서명을 확인하지 못했습니다.",
      401,
    );
  }
}

function parsePolarWebhookPayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;

  return isRecord(parsed) ? parsed : {};
}

function polarEventType(event: Record<string, unknown>): string | null {
  return stringField(event, "type") ?? stringField(event, "event");
}

function polarEventData(event: Record<string, unknown>): Record<string, unknown> {
  return isRecord(event.data) ? event.data : event;
}

function polarEventMetadata(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const data = polarEventData(event);

  if (isRecord(data.metadata)) {
    return data.metadata;
  }

  if (isRecord(data.checkout) && isRecord(data.checkout.metadata)) {
    return data.checkout.metadata;
  }

  if (isRecord(data.order) && isRecord(data.order.metadata)) {
    return data.order.metadata;
  }

  return {};
}

function extractPolarPaymentOrderId(
  event: Record<string, unknown>,
): string | null {
  const metadata = polarEventMetadata(event);

  return (
    stringField(metadata, "paymentOrderId") ??
    stringField(metadata, "payment_order_id")
  );
}

function polarWebhookPaidAt(event: Record<string, unknown>): Date {
  const data = polarEventData(event);
  const candidates = [
    data.paidAt,
    data.paid_at,
    data.createdAt,
    data.created_at,
    event.timestamp,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const parsed = new Date(candidate);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function polarWebhookAmount(event: Record<string, unknown>): number | null {
  const data = polarEventData(event);
  const candidates = [
    data.totalAmount,
    data.total_amount,
    data.amount,
    data.subtotalAmount,
    data.subtotal_amount,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function polarWebhookCurrency(event: Record<string, unknown>): string | null {
  const data = polarEventData(event);
  const currency = data.currency;

  return typeof currency === "string" && currency.trim()
    ? currency.trim().toUpperCase()
    : null;
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
      if (input.provider !== "PORTONE" && input.provider !== "POLAR") {
        throw new PaymentServiceError(
          "PAYMENT_PROVIDER_NOT_SUPPORTED",
          "지원하지 않는 결제 수단입니다.",
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

      const isPolar = input.provider === "POLAR";
        const amount = isPolar ? POLAR_PRICES[input.plan] : DOMESTIC_PRICES[input.plan];
      const providerPaymentId = createProviderPaymentId();
      const title = orderName(scan.site.name, input.plan);
        const configured = isPolar
          ? polarConfigured(input.plan)
          : Boolean(env.PORTONE_STORE_ID && env.PORTONE_CHANNEL_KEY);
        const productId = isPolar ? polarProductId(input.plan) : null;

      const order = await prisma.paymentOrder.create({
        data: {
          userId: user.id,
          siteId: scan.siteId,
          scanId: scan.id,
          provider: input.provider,
          status: "PENDING",
          plan: input.plan,
          amount,
          currency: isPolar ? "USD" : "KRW",
          providerPaymentId,
          idempotencyKey: providerPaymentId,
          metadata: {
              provider: input.provider,
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
        if (isPolar) {
          let checkoutUrl: string | null = null;
          let checkoutId: string | null = null;

          if (configured && productId) {
            const polar = createPolarClient();
            const baseUrl = env.APP_BASE_URL.replace(/\/+$/, "");
            const scanQuery = encodeURIComponent(scan.id);
            const orderQuery = encodeURIComponent(order.id);

            const checkout = await polar.checkouts.create({
              products: [productId],
              successUrl: `${baseUrl}/ko/checkout?scanId=${scanQuery}&paymentOrderId=${orderQuery}&polarCheckoutId={CHECKOUT_ID}`,
              returnUrl: `${baseUrl}/ko/checkout?scanId=${scanQuery}`,
              customerEmail: user.email,
              externalCustomerId: user.id,
              metadata: {
                source: "checkout",
                provider: "POLAR",
                paymentOrderId: order.id,
                providerPaymentId,
                scanId: scan.id,
                siteId: scan.siteId,
                userId: user.id,
                plan: input.plan,
              },
            });

            checkoutUrl = stringFromUnknownRecord(checkout, "url");
            checkoutId = stringFromUnknownRecord(checkout, "id");
          }

          return {
            paymentOrder: publicOrder(order),
            portone: null,
            polar: {
              configured,
              checkoutUrl,
              checkoutId,
              productId,
              currency: "USD",
            },
          };
        }


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
          polar: null,
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

    async handlePortOneWebhook(input) {
      const payload = input.payload.trim();

      if (!payload) {
        throw new PaymentServiceError(
          "PORTONE_WEBHOOK_EMPTY_PAYLOAD",
          "PortOne 웹훅 본문이 비어 있습니다.",
          400,
        );
      }

      await verifyPortOneWebhook(payload, input.headers);

      const providerPaymentId = extractPaymentIdFromWebhookPayload(payload);

      if (!providerPaymentId) {
        return {
          received: true,
          processed: false,
          paymentId: null,
          reason: "PAYMENT_ID_NOT_FOUND",
        };
      }

      const prisma = getDatabase();
      const order = await prisma.paymentOrder.findFirst({
        where: {
          provider: "PORTONE",
          providerPaymentId,
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
        return {
          received: true,
          processed: false,
          paymentId: providerPaymentId,
          reason: "PAYMENT_ORDER_NOT_FOUND",
        };
      }

      if (order.status === "PAID") {
        return {
          received: true,
          processed: true,
          paymentId: providerPaymentId,
          reason: "ALREADY_PAID",
        };
      }

      const payment = await fetchPortOnePayment(providerPaymentId);
      const paymentStatus =
        typeof payment.status === "string" ? payment.status : "";

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

        return {
          received: true,
          processed: false,
          paymentId: providerPaymentId,
          reason: "PAYMENT_NOT_PAID",
        };
      }

      const totalAmount = paymentAmountTotal(payment);
      const currency = normalizePaymentCurrency(payment.currency);

      if (totalAmount !== order.amount || currency !== order.currency) {
        throw new PaymentServiceError(
          "PAYMENT_AMOUNT_MISMATCH",
          "결제 금액 또는 통화가 주문 정보와 일치하지 않습니다.",
          409,
        );
      }

      const paidAt = paymentPaidAt(payment);

      await prisma.$transaction(async (transaction) => {
        await transaction.paymentOrder.update({
          where: {
            id: order.id,
          },
          data: {
            status: "PAID",
            paidAt,
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
      });

      return {
        received: true,
        processed: true,
        paymentId: providerPaymentId,
      };
    },

    async handlePolarWebhook(input) {
      const payload = input.payload;

      if (!payload.trim()) {
        throw new PaymentServiceError(
          "POLAR_WEBHOOK_EMPTY_PAYLOAD",
          "Polar 웹훅 본문이 비어 있습니다.",
          400,
        );
      }

      await verifyPolarWebhook(payload, input.headers);

      const event = parsePolarWebhookPayload(payload);
      const eventType = polarEventType(event);

      if (eventType !== "order.paid") {
        return {
          received: true,
          processed: false,
          eventType,
          paymentOrderId: null,
          reason: "EVENT_NOT_HANDLED",
        };
      }

      const paymentOrderId = extractPolarPaymentOrderId(event);

      if (!paymentOrderId) {
        return {
          received: true,
          processed: false,
          eventType,
          paymentOrderId: null,
          reason: "PAYMENT_ORDER_ID_NOT_FOUND",
        };
      }

      const prisma = getDatabase();
      const order = await prisma.paymentOrder.findFirst({
        where: {
          id: paymentOrderId,
          provider: "POLAR",
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
        return {
          received: true,
          processed: false,
          eventType,
          paymentOrderId,
          reason: "PAYMENT_ORDER_NOT_FOUND",
        };
      }

      if (order.status === "PAID") {
        return {
          received: true,
          processed: true,
          eventType,
          paymentOrderId,
          reason: "ALREADY_PAID",
        };
      }

      const totalAmount = polarWebhookAmount(event);
      const currency = polarWebhookCurrency(event);

      if (
        (totalAmount !== null && totalAmount !== order.amount) ||
        (currency !== null && currency !== order.currency)
      ) {
        throw new PaymentServiceError(
          "PAYMENT_AMOUNT_MISMATCH",
          "결제 금액 또는 통화가 주문 정보와 일치하지 않습니다.",
          409,
        );
      }

      const paidAt = polarWebhookPaidAt(event);

      await prisma.$transaction(async (transaction) => {
        await transaction.paymentOrder.update({
          where: {
            id: order.id,
          },
          data: {
            status: "PAID",
            paidAt,
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
      });

      return {
        received: true,
        processed: true,
        eventType,
        paymentOrderId,
      };
    }
  };
}
