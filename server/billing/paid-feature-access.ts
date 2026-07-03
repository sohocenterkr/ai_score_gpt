import type { Response } from "express";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";

export const PAID_FEATURE_REQUIRED_CODE = "PAID_FEATURE_REQUIRED";

const SUPER_ADMIN_EMAIL = "sohocenter.kr@gmail.com";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasAdministrativePaidFeatureAccess(
  user: PublicUser,
): boolean {
  return (
    user.role === "SUPER_ADMIN" ||
    normalizeEmail(user.email) === SUPER_ADMIN_EMAIL
  );
}

export async function hasPaidFeatureAccessForScan(
  user: PublicUser,
  scanId: string,
): Promise<boolean> {
  if (hasAdministrativePaidFeatureAccess(user)) {
    return true;
  }

  const normalizedScanId = scanId.trim();

  if (!normalizedScanId) {
    return false;
  }

  const prisma = getDatabase();
  const entitlement = await prisma.paidEntitlement.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      OR: [
        {
          scanId: normalizedScanId,
        },
        {
          site: {
            is: {
              scans: {
                some: {
                  id: normalizedScanId,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return entitlement !== null;
}

export async function hasPaidFeatureAccessForWorkOrder(
  user: PublicUser,
  workOrderId: string,
): Promise<boolean> {
  if (hasAdministrativePaidFeatureAccess(user)) {
    return true;
  }

  const normalizedWorkOrderId = workOrderId.trim();

  if (!normalizedWorkOrderId) {
    return false;
  }

  const prisma = getDatabase();
  const entitlement = await prisma.paidEntitlement.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      OR: [
        {
          site: {
            is: {
              workOrders: {
                some: {
                  id: normalizedWorkOrderId,
                },
              },
            },
          },
        },
        {
          scan: {
            is: {
              initialWorkOrders: {
                some: {
                  id: normalizedWorkOrderId,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return entitlement !== null;
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
