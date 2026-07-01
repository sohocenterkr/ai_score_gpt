import {
  Prisma,
  type ScanStatus,
  type ScanType,
} from "@prisma/client";
import { env } from "../config/env";
import { getDatabase } from "../db";
import { SiteUrlError } from "../sites/url-safety";
import {
  createSafeHttpFetcher,
  HttpFetchError,
  type SafeHttpFetcher,
} from "./http-fetcher";
import { collectSiteScan } from "./scan-engine";
import {
  createPlaywrightRenderedDomCollector,
  type RenderedDomCollector,
} from "./rendered-dom";
import { applyScoreToFindings } from "./scoring";
import { evaluateVerification } from "../work-orders/verification-evaluator";
import {
  DeepDiagnosticRunnerError,
  runDeepAnswerDiagnostic,
} from "../deep-diagnostics/deep-diagnostic-runner";

export interface ScanRunSummary {
  scanId: string;
  siteId: string;
  siteName: string;
  status: ScanStatus;
  finalUrl: string | null;
  pageId: string | null;
  findingsCount: number;
  score: number | null;
  grade: string | null;
  errorCode: string | null;
}

export function scanExecutionUrl(scan: {
  targetUrl: string | null;
  site: {
    baseUrl: string;
  };
}): string {
  return scan.targetUrl ?? scan.site.baseUrl;
}

export function shouldUpdateSiteFinalUrl(type: ScanType): boolean {
  return type !== "VERIFICATION";
}

function configuredRenderedDomCollector():
  | RenderedDomCollector
  | undefined {
  if (env.NODE_ENV === "test" || !env.RENDERED_DOM_ENABLED) {
    return undefined;
  }

  return createPlaywrightRenderedDomCollector({
    executablePath: env.CHROMIUM_PATH,
    navigationTimeoutMs: env.RENDERED_DOM_TIMEOUT_MS,
    settleMs: env.RENDERED_DOM_SETTLE_MS,
  });
}

function errorCodeFrom(error: unknown): string {
  if (error instanceof HttpFetchError) {
    return error.code;
  }

  if (error instanceof SiteUrlError) {
    return error.code;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `PRISMA_${error.code}`;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "PRISMA_INITIALIZATION_ERROR";
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return "PRISMA_UNKNOWN_REQUEST";
  }

  if (error instanceof TypeError) {
    return "TYPE_ERROR";
  }

  return "SCAN_INTERNAL_ERROR";
}

async function claimNextQueuedScan(): Promise<string | null> {
  const prisma = getDatabase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = await prisma.scan.findFirst({
      where: {
        status: "QUEUED",
        site: {
          status: "ACTIVE",
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
      },
    });

    if (!candidate) {
      return null;
    }

    const claimedAt = new Date();
    const claimed = await prisma.scan.updateMany({
      where: {
        id: candidate.id,
        status: "QUEUED",
      },
      data: {
        status: "RUNNING",
        startedAt: claimedAt,
        completedAt: null,
        errorCode: null,
      },
    });

    if (claimed.count === 1) {
      await prisma.verificationAttempt.updateMany({
        where: {
          scanId: candidate.id,
          status: "QUEUED",
        },
        data: {
          status: "RUNNING",
          startedAt: claimedAt,
          errorCode: null,
        },
      });
      return candidate.id;
    }
  }

  return null;
}

async function persistSuccessfulScan(
  scanId: string,
  result: Awaited<ReturnType<typeof collectSiteScan>>,
  options: {
    deferCompletion?: boolean;
  } = {},
): Promise<ScanRunSummary> {
  const prisma = getDatabase();
  const scored = applyScoreToFindings(result.findings);

  return prisma.$transaction(async (transaction) => {
    const scan = await transaction.scan.findUniqueOrThrow({
      where: { id: scanId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await transaction.finding.deleteMany({
      where: { scanId },
    });
    await transaction.scanPage.deleteMany({
      where: { scanId },
    });

    const page = await transaction.scanPage.create({
      data: {
        scanId,
        url: result.page.url,
        statusCode: result.page.statusCode,
        finalUrl: result.page.finalUrl,
        contentType: result.page.contentType,
        rawHtmlHash: result.page.rawHtmlHash,
        initialTextLength: result.page.initialTextLength,
        iframeCount: result.page.iframeCount,
      },
    });

    if (scored.findings.length > 0) {
      await transaction.finding.createMany({
        data: scored.findings.map((item) => ({
          scanId,
          scanPageId: page.id,
          ruleCode: item.ruleCode,
          category: item.category,
          severity: item.severity,
          status: item.status,
          title: item.title,
          description: item.description,
          evidenceJson:
            item.evidence as Prisma.InputJsonValue,
          recommendation: item.recommendation,
          scoreDelta: item.scoreDelta,
        })),
      });
    }

    if (shouldUpdateSiteFinalUrl(scan.type)) {
      await transaction.site.update({
        where: { id: scan.site.id },
        data: {
          finalUrl: result.finalUrl,
        },
      });
    }

    const completedAt = new Date();
    const completed = await transaction.scan.update({
      where: { id: scanId },
      data: options.deferCompletion
        ? {
            status: "RUNNING",
            score: scored.summary.score,
            grade: scored.summary.grade,
            completedAt: null,
            errorCode: null,
          }
        : {
            status: result.status,
            score: scored.summary.score,
            grade: scored.summary.grade,
            completedAt,
            errorCode: null,
          },
    });

    if (scan.type === "VERIFICATION") {
      const attempt =
        await transaction.verificationAttempt.findUnique({
          where: {
            scanId,
          },
          include: {
            workOrder: {
              include: {
                items: {
                  include: {
                    finding: {
                      select: {
                        ruleCode: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
                initialScan: {
                  include: {
                    findings: {
                      select: {
                        ruleCode: true,
                        status: true,
                        evidenceJson: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      if (attempt) {
        const evaluation = evaluateVerification({
          items: attempt.workOrder.items.map((item) => ({
            id: item.id,
            itemCode: item.itemCode,
            isRequired: item.isRequired,
            acceptanceCriteriaJson:
              item.acceptanceCriteriaJson,
            finding: item.finding,
          })),
          initialFindings:
            attempt.workOrder.initialScan.findings,
          verificationFindings: scored.findings,
          submittedUrl: attempt.submittedUrl,
          scanTargetUrl: scan.targetUrl,
        });

        await transaction.verificationItemResult.deleteMany({
          where: {
            verificationAttemptId: attempt.id,
          },
        });

        for (const itemResult of evaluation.itemResults) {
          await transaction.verificationItemResult.create({
            data: {
              verificationAttemptId: attempt.id,
              workOrderItemId:
                itemResult.workOrderItemId,
              status: itemResult.status,
              criteriaResultsJson:
                itemResult.criteriaResults as unknown as Prisma.InputJsonValue,
              evidenceJson:
                itemResult.evidence as Prisma.InputJsonValue,
              message: itemResult.message,
            },
          });

          await transaction.workOrderItem.update({
            where: {
              id: itemResult.workOrderItemId,
            },
            data: {
              status: itemResult.nextItemStatus,
            },
          });
        }

        await transaction.verificationAttempt.update({
          where: {
            id: attempt.id,
          },
          data: {
            status: evaluation.status,
            scoreAfter: completed.score,
            gradeAfter: completed.grade,
            completedAt,
            errorCode: null,
          },
        });

        await transaction.workOrder.update({
          where: {
            id: attempt.workOrderId,
          },
          data: {
            status: evaluation.workOrderStatus,
          },
        });
      }
    }

    return {
      scanId: completed.id,
      siteId: scan.site.id,
      siteName: scan.site.name,
      status: completed.status,
      finalUrl: result.finalUrl,
      pageId: page.id,
      findingsCount: scored.findings.length,
      score: completed.score,
      grade: completed.grade,
      errorCode: null,
    };
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });
}

async function persistFailedScan(
  scanId: string,
  error: unknown,
): Promise<ScanRunSummary> {
  const prisma = getDatabase();
  const errorCode = errorCodeFrom(error);

  const completedAt = new Date();
  const scan = await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "FAILED",
      score: null,
      grade: null,
      completedAt,
      errorCode,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          finalUrl: true,
        },
      },
    },
  });

  const attempt =
    await prisma.verificationAttempt.findUnique({
      where: {
        scanId,
      },
      select: {
        id: true,
        workOrderId: true,
      },
    });

  if (attempt) {
    await prisma.$transaction([
      prisma.verificationAttempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status: "FAILED",
          completedAt,
          errorCode,
        },
      }),
      prisma.workOrder.update({
        where: {
          id: attempt.workOrderId,
        },
        data: {
          status: "REWORK_REQUIRED",
        },
      }),
    ]);
  }

  return {
    scanId: scan.id,
    siteId: scan.site.id,
    siteName: scan.site.name,
    status: scan.status,
    finalUrl: scan.targetUrl ?? scan.site.finalUrl,
    pageId: null,
    findingsCount: 0,
    score: null,
    grade: null,
    errorCode,
  };
}

export async function runClaimedScan(
  scanId: string,
  fetcher: SafeHttpFetcher = createSafeHttpFetcher(),
  renderedDomCollector:
    | RenderedDomCollector
    | undefined = configuredRenderedDomCollector(),
): Promise<ScanRunSummary> {
  const prisma = getDatabase();
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      site: true,
    },
  });

  if (
    !scan ||
    scan.status !== "RUNNING" ||
    scan.site.status !== "ACTIVE"
  ) {
    throw new Error(
      "실행할 수 있는 RUNNING 상태의 검사 작업이 아닙니다.",
    );
  }

  try {
    const result = await collectSiteScan(
      scanExecutionUrl(scan),
      fetcher,
      {
        renderedDomCollector,
      },
    );
    const technical = await persistSuccessfulScan(
      scanId,
      result,
      {
        deferCompletion: scan.type === "DEEP",
      },
    );

    if (scan.type !== "DEEP") {
      return technical;
    }

    try {
      const deepResult = await runDeepAnswerDiagnostic(scanId);
      const completed = await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: deepResult.status,
          completedAt: new Date(),
          errorCode: deepResult.errorCode,
        },
      });

      return {
        ...technical,
        status: completed.status,
        errorCode: completed.errorCode,
      };
    } catch (error) {
      const errorCode =
        error instanceof DeepDiagnosticRunnerError
          ? error.code
          : "DEEP_ANSWER_INTERNAL_ERROR";
      const completed = await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "PARTIAL",
          completedAt: new Date(),
          errorCode,
        },
      });

      return {
        ...technical,
        status: completed.status,
        errorCode: completed.errorCode,
      };
    }
  } catch (error) {
    console.error("[scan-worker] runClaimedScan failed", {
      scanId,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });

    return persistFailedScan(scanId, error);
  }
}

async function claimQueuedScanById(scanId: string): Promise<string | null> {
  const prisma = getDatabase();
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      status: true,
      site: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!scan || scan.status !== "QUEUED" || scan.site.status !== "ACTIVE") {
    return null;
  }

  const claimedAt = new Date();
  const claimed = await prisma.scan.updateMany({
    where: {
      id: scanId,
      status: "QUEUED",
    },
    data: {
      status: "RUNNING",
      startedAt: claimedAt,
      completedAt: null,
      errorCode: null,
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  await prisma.verificationAttempt.updateMany({
    where: {
      scanId,
      status: "QUEUED",
    },
    data: {
      status: "RUNNING",
      startedAt: claimedAt,
      errorCode: null,
    },
  });

  return scanId;
}

export async function runQueuedScanById(
  scanId: string,
  fetcher: SafeHttpFetcher = createSafeHttpFetcher(),
  renderedDomCollector:
    | RenderedDomCollector
    | undefined = configuredRenderedDomCollector(),
): Promise<ScanRunSummary | null> {
  const claimedScanId = await claimQueuedScanById(scanId);

  if (!claimedScanId) {
    return null;
  }

  return runClaimedScan(claimedScanId, fetcher, renderedDomCollector);
}

export async function runNextQueuedScan(
  fetcher: SafeHttpFetcher = createSafeHttpFetcher(),
  renderedDomCollector:
    | RenderedDomCollector
    | undefined = configuredRenderedDomCollector(),
): Promise<ScanRunSummary | null> {
  const scanId = await claimNextQueuedScan();

  if (!scanId) {
    return null;
  }

  return runClaimedScan(
    scanId,
    fetcher,
    renderedDomCollector,
  );
}
