export type PaymentPlan = "BASIC" | "CASE_STUDY_DISCOUNT";

export interface CreatePaymentOrderResponse {
  paymentOrder: {
    id: string;
    provider: "PORTONE" | "POLAR";
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
  };
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
  scanId: string;
  plan: PaymentPlan;
}): Promise<CreatePaymentOrderResponse> {
  const response = await fetch("/api/billing/payment-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      scanId: input.scanId,
      plan: input.plan,
      provider: "PORTONE",
    }),
  });

  return readJson<CreatePaymentOrderResponse>(response);
}
