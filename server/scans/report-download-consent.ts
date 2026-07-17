import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";

export const REPORT_DOWNLOAD_CONSENT_VERSION =
  "diagnostic-report-refund-notice-v1";

const CONSENT_TEXT = {
  ko: "진단 보고서 PDF를 열람하거나 저장하면 유료 디지털 자료의 제공이 시작되어 단순 변심에 의한 청약철회 및 결제 취소가 제한될 수 있습니다. 다만 제공된 자료가 계약 내용 또는 표시·광고 내용과 다른 경우에는 관련 법령과 이용약관에 따릅니다.",
  en: "Opening or saving the diagnostic report PDF starts delivery of the paid digital material, so cancellation or withdrawal based solely on a change of mind may be restricted. If the delivered material differs from the contract, description, or advertising, applicable law and the Terms of Service continue to apply.",
} as const;

export interface ReportDownloadConsentStatus {
  required: boolean;
  acceptedAt: string | null;
  version: string;
}

export async function getReportDownloadConsentStatus(
  userId: string,
  scanId: string,
  required: boolean,
): Promise<ReportDownloadConsentStatus> {
  if (!required) {
    return {
      required: false,
      acceptedAt: null,
      version: REPORT_DOWNLOAD_CONSENT_VERSION,
    };
  }

  const prisma = getDatabase();
  const consent = await prisma.reportDownloadConsent.findUnique({
    where: {
      userId_scanId_consentVersion: {
        userId,
        scanId,
        consentVersion: REPORT_DOWNLOAD_CONSENT_VERSION,
      },
    },
    select: {
      acceptedAt: true,
    },
  });

  return {
    required: true,
    acceptedAt: consent?.acceptedAt.toISOString() ?? null,
    version: REPORT_DOWNLOAD_CONSENT_VERSION,
  };
}

export async function recordReportDownloadConsent(
  user: PublicUser,
  scanId: string,
  locale: "ko" | "en",
): Promise<ReportDownloadConsentStatus> {
  const prisma = getDatabase();

  const entitlement = await prisma.paidEntitlement.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      plan: {
        in: ["BASIC", "CASE_STUDY_DISCOUNT"],
      },
      OR: [
        {
          scanId,
        },
        {
          site: {
            is: {
              scans: {
                some: {
                  id: scanId,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      paymentOrderId: true,
    },
  });

  const consent = await prisma.reportDownloadConsent.upsert({
    where: {
      userId_scanId_consentVersion: {
        userId: user.id,
        scanId,
        consentVersion: REPORT_DOWNLOAD_CONSENT_VERSION,
      },
    },
    create: {
      userId: user.id,
      scanId,
      paymentOrderId: entitlement?.paymentOrderId ?? null,
      consentVersion: REPORT_DOWNLOAD_CONSENT_VERSION,
      consentLocale: locale,
      consentText: CONSENT_TEXT[locale],
    },
    update: {},
    select: {
      acceptedAt: true,
    },
  });

  return {
    required: true,
    acceptedAt: consent.acceptedAt.toISOString(),
    version: REPORT_DOWNLOAD_CONSENT_VERSION,
  };
}
