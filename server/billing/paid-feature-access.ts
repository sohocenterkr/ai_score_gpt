import type { Response } from "express";
import type { PublicUser } from "../auth/auth-service";

export const PAID_FEATURE_REQUIRED_CODE = "PAID_FEATURE_REQUIRED";

export function hasPaidFeatureAccess(user: PublicUser): boolean {
  return (
    user.role === "SUPER_ADMIN" &&
    user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com"
  );
}

export function sendPaidFeatureRequired(
  response: Response,
  message =
    "상세 보고서와 수정 작업지시서는 유료 결제 후 제공됩니다. 결제 기능은 준비 중입니다.",
): void {
  response.status(402).json({
    code: PAID_FEATURE_REQUIRED_CODE,
    message,
  });
}
