import {
  Prisma,
  type ScanStatus,
} from "@prisma/client";
import { getDatabase } from "../db";
import { SiteUrlError } from "../sites/url-safety";
import {
  createSafeHttpFetcher,
  HttpFetchError,
  type SafeHttpFetcher,
} from "./http-fetcher";
import { collectSiteScan } from "./scan-engine";

export interface ScanRunSummary {
  scanId: string;
  siteId: string;
  siteName: string;
  status: ScanStatus;
  finalUrl: string | null;
  pageId: string | null;
  findingsCount: number;
  errorCode: string | null;
}

function errorCodeFrom(error: unknown): string {
  if (error instanceof HttpFetchError) {
    return error.code;
  }

  if (error instanceof SiteUrlError) {
    return error.code;
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

    const claimed = await prisma.scan.updateMany({
      where: {
        id: candidate.id,
        status: "QUEUED",
      },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        completedAt: null,
        errorCode: null,
      },
    });

    if (claimed.count === 1) {
      return candidate.id;
    }
  }

  return null;
}

async function persistSuccessfulScan(
  scanId: string,
  result: Awaited<ReturnType<typeof collectSiteScan>>,
): Promise<ScanRunSummary> {
  const prisma = getDatabase();

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

    for (const item of result.findings) {
      await transaction.finding.create({
        data: {
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
        },
      });
    }

    await transaction.site.update({
      where: { id: scan.site.id },
      data: {
        finalUrl: result.finalUrl,
      },
    });

    const completed = await transaction.scan.update({
      where: { id: scanId },
      data: {
        status: result.status,
        completedAt: new Date(),
        errorCode: null,
      },
    });

    return {
      scanId: completed.id,
      siteId: scan.site.id,
      siteName: scan.site.name,
      status: completed.status,
      finalUrl: result.finalUrl,
      pageId: page.id,
      findingsCount: result.findings.length,
      errorCode: null,
    };
  });
}

async function persistFailedScan(
  scanId: string,
  error: unknown,
): Promise<ScanRunSummary> {
  const prisma = getDatabase();
  const errorCode = errorCodeFrom(error);

  const scan = await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
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

  return {
    scanId: scan.id,
    siteId: scan.site.id,
    siteName: scan.site.name,
    status: scan.status,
    finalUrl: scan.site.finalUrl,
    pageId: null,
    findingsCount: 0,
    errorCode,
  };
}

export async function runClaimedScan(
  scanId: string,
  fetcher: SafeHttpFetcher = createSafeHttpFetcher(),
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
      scan.site.baseUrl,
      fetcher,
    );
    return await persistSuccessfulScan(scanId, result);
  } catch (error) {
    return persistFailedScan(scanId, error);
  }
}

export async function runNextQueuedScan(
  fetcher: SafeHttpFetcher = createSafeHttpFetcher(),
): Promise<ScanRunSummary | null> {
  const scanId = await claimNextQueuedScan();

  if (!scanId) {
    return null;
  }

  return runClaimedScan(scanId, fetcher);
}
