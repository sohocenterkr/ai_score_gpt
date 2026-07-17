import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { AuthenticatedResponseLocals } from "../auth/auth-middleware";
import {
  hasPaidFeatureAccessForScan,
  sendPaidFeatureRequired,
} from "../billing/paid-feature-access";
import {
  getReportDownloadConsentStatus,
  recordReportDownloadConsent,
} from "./report-download-consent";
import { scanResultPdfFilename } from "./scan-result-pdf";
import {
  ScanReportCacheError,
  type ScanReportCacheService,
} from "./scan-report-cache";
import {
  ScanResultServiceError,
  type ScanResultService,
} from "./scan-result-service";

interface CreateScanResultRouterOptions {
  scanResultService: ScanResultService;
  scanReportCacheService: ScanReportCacheService;
  requireAuth: (
    request: Request,
    response: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => Promise<void>;
}

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readLocaleQuery(value: unknown): "ko" | "en" | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "ko" || raw === "en") {
    return raw;
  }

  return undefined;
}

export function createScanResultRouter(options: CreateScanResultRouterOptions) {
  const router = Router();
  const { scanResultService, scanReportCacheService, requireAuth } = options;

  router.post(
    "/:scanId/report-download-consent",
    requireAuth,
    async (request, response) => {
      const scanId = readRouteParam(request.params.scanId);

      if (
        !(await hasPaidFeatureAccessForScan(response.locals.authUser, scanId))
      ) {
        sendPaidFeatureRequired(
          response,
          "상세 진단 PDF 보고서는 유료 결제 후 제공됩니다.",
        );
        return;
      }

      if (request.body?.accepted !== true) {
        response.status(400).json({
          code: "REPORT_DOWNLOAD_CONSENT_REQUIRED",
          message: "환불 제한 안내를 확인하고 동의해 주세요.",
        });
        return;
      }

      try {
        const result = await scanResultService.getScanResult(
          response.locals.authUser,
          scanId,
        );

        if (result.scan.diagnosticNumber !== 1) {
          response.status(400).json({
            code: "REPORT_DOWNLOAD_CONSENT_NOT_APPLICABLE",
            message: "최초 진단 보고서에만 다운로드 동의가 필요합니다.",
          });
          return;
        }

        const locale = request.body?.locale === "en" ? "en" : "ko";
        const consent = await recordReportDownloadConsent(
          response.locals.authUser,
          scanId,
          locale,
        );

        response.status(200).json({ consent });
      } catch (error) {
        if (error instanceof ScanResultServiceError) {
          response.status(error.status).json({
            code: error.code,
            message: error.message,
          });
          return;
        }

        console.error(
          `[scan-result-consent] Could not record consent for scan ${scanId}`,
          error,
        );
        response.status(500).json({
          code: "INTERNAL_ERROR",
          message: "진단 보고서 다운로드 동의를 기록하지 못했습니다.",
        });
      }
    },
  );

  router.get("/:scanId/export.pdf", requireAuth, async (request, response) => {
    const scanId = readRouteParam(request.params.scanId);

    if (
      !(await hasPaidFeatureAccessForScan(response.locals.authUser, scanId))
    ) {
      sendPaidFeatureRequired(
        response,
        "상세 진단 PDF 보고서는 유료 결제 후 제공됩니다. 결제 기능은 준비 중입니다.",
      );
      return;
    }

    try {
      const result = await scanResultService.getScanResult(
        response.locals.authUser,
        scanId,
      );

      if (result.scan.diagnosticNumber === 1) {
        const consent = await getReportDownloadConsentStatus(
          response.locals.authUser.id,
          scanId,
          true,
        );

        if (!consent.acceptedAt) {
          response.status(409).json({
            code: "REPORT_DOWNLOAD_CONSENT_REQUIRED",
            message:
              "환불 제한 안내를 확인하고 동의한 뒤 진단 보고서 PDF를 저장해 주세요.",
          });
          return;
        }
      }

      const requestedLocale = readLocaleQuery(request.query.locale);
      const pdfResult = requestedLocale
        ? {
            ...result,
            scan: {
              ...result.scan,
              locale: requestedLocale,
            },
          }
        : result;
      const cached = await scanReportCacheService.getOrCreate(pdfResult);
      const pdf = cached.pdf;

      response
        .status(200)
        .type("application/pdf")
        .set({
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${scanResultPdfFilename(
            pdfResult,
          )}"`,
          "Content-Length": String(pdf.length),
          "X-Site-AI-Report-Cache": cached.cacheStatus,
        })
        .send(pdf);
    } catch (error) {
      if (error instanceof ScanResultServiceError) {
        response.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof ScanReportCacheError) {
        response.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }

      console.error(
        `[scan-result-pdf] PDF generation failed for scan ${scanId}`,
        error,
      );

      response.status(500).json({
        code: "INTERNAL_ERROR",
        message: "진단 보고서 PDF를 생성하는 중 오류가 발생했습니다.",
      });
    }
  });

  router.get("/:scanId", requireAuth, async (request, response) => {
    try {
      const scanId = readRouteParam(request.params.scanId);
      const result = await scanResultService.getScanResult(
        response.locals.authUser,
        scanId,
      );
      const paidFeatureAccess = await hasPaidFeatureAccessForScan(
        response.locals.authUser,
        scanId,
      );
      const reportDownloadConsent = await getReportDownloadConsentStatus(
        response.locals.authUser.id,
        scanId,
        paidFeatureAccess && result.scan.diagnosticNumber === 1,
      );

      response.json({
        result: {
          ...result,
          paidFeatureAccess,
          reportDownloadConsent,
        },
      });
    } catch (error) {
      if (error instanceof ScanResultServiceError) {
        response.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }

      response.status(500).json({
        code: "INTERNAL_ERROR",
        message: "검사 결과를 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  return router;
}
