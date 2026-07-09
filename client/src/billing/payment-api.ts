export type PaymentPlan = "BASIC" | "CASE_STUDY_DISCOUNT" | "EXTRA_VERIFICATION";
export type PaymentProvider = "PORTONE" | "POLAR";

export interface CreatePaymentOrderResponse {
  paymentOrder: {
    id: string;
    provider: PaymentProvider;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
    plan: PaymentPlan;
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
    workOrder: {
      id: string;
      orderNumber: string;
      version: number;
    } | null;
  };
  portone: {
    configured: boolean;
    storeId: string | null;
    channelKey: string | null;
    paymentId: string;
    orderName: string;
    totalAmount: number;
    currency: "KRW";
    payMethod: "CARD";
  } | null;
  polar: {
    configured: boolean;
    checkoutUrl: string | null;
    checkoutId: string | null;
    productId: string | null;
    currency: "USD";
  } | null;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(data?.message ?? "결제 요청을 처리하지 못했습니다.");
  }

  return data as T;
}

export async function createPaymentOrderRequest(input: {
  scanId?: string;
  workOrderId?: string;
  plan: PaymentPlan;
  provider?: PaymentProvider;
}): Promise<CreatePaymentOrderResponse> {
  const response = await fetch("/api/billing/payment-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      scanId: input.scanId,
      workOrderId: input.workOrderId,
      plan: input.plan,
      provider: input.provider ?? "PORTONE",
    }),
  });

  return readJson<CreatePaymentOrderResponse>(response);
}

export async function completePaymentOrderRequest(input: {
  paymentOrderId: string;
  providerPaymentId: string;
}): Promise<{
  paymentOrder: CreatePaymentOrderResponse["paymentOrder"];
}> {
  const response = await fetch(
    `/api/billing/payment-orders/${encodeURIComponent(
      input.paymentOrderId,
    )}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        providerPaymentId: input.providerPaymentId,
      }),
    },
  );

  return readJson<{
    paymentOrder: CreatePaymentOrderResponse["paymentOrder"];
  }>(response);
}
