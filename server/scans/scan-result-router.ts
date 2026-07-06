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

function readRouteParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readLocaleQuery(
  value: unknown,
): "ko" | "en" | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "ko" || raw === "en") {
    return raw;
  }

  return undefined;
}


export function createScanResultRouter(
  options: CreateScanResultRouterOptions,
) {
  const router = Router();
  const {
    scanResultService,
    scanReportCacheService,
    requireAuth,
  } = options;

  router.get(
    "/:scanId/export.pdf",
    requireAuth,
    async (request, response) => {
      const scanId = readRouteParam(request.params.scanId);

      if (
        !(await hasPaidFeatureAccessForScan(
          response.locals.authUser,
          scanId,
        ))
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
        const cached =
          await scanReportCacheService.getOrCreate(pdfResult);
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

        response.status(500).json({
          code: "INTERNAL_ERROR",
          message: "진단 보고서 PDF를 생성하는 중 오류가 발생했습니다.",
        });
      }
    },
  );

  router.get("/:scanId", requireAuth, async (request, response) => {
    try {
      const result = await scanResultService.getScanResult(
        response.locals.authUser,
        readRouteParam(request.params.scanId),
      );
      response.json({ result });
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
