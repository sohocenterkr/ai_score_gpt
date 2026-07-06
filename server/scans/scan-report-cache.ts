import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getDatabase } from "../db";
import {
  renderScanResultPdf,
  sanitizeEvidenceValue,
  sanitizeScanResultForPdf,
  scanResultPdfFontHash,
  SCAN_RESULT_PDF_RENDERER_VERSION,
} from "./scan-result-pdf";
import type { PublicScanResult } from "./scan-result-service";

const REPORT_TYPE_PREFIX = "DIAGNOSTIC";

function reportTypeForLocale(locale: string): string {
  return locale === "en" ? `${REPORT_TYPE_PREFIX}_EN` : `${REPORT_TYPE_PREFIX}_KO`;
}
const DEFAULT_LOCK_TTL_MS = 90_000;
const DEFAULT_WAIT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 250;

export type ScanReportCacheStatus = "HIT" | "MISS";

export interface ScanReportCacheResponse {
  pdf: Buffer;
  cacheStatus: ScanReportCacheStatus;
}

export interface ScanReportCacheService {
  getOrCreate(
    result: PublicScanResult,
    renderer?: (result: PublicScanResult) => Promise<Buffer>,
  ): Promise<ScanReportCacheResponse>;
}

export class ScanReportCacheError extends Error {
  constructor(
    public readonly code:
      | "SCAN_REPORT_CACHE_TIMEOUT"
      | "SCAN_REPORT_CACHE_WRITE_CONFLICT",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScanReportCacheError";
  }
}

export interface ScanReportCacheIdentity {
  scanId: string;
  reportType: string;
  cacheKey: string;
  sourceHash: string;
  rendererVersion: string;
  fontHash: string;
}

interface CacheRecord {
  id: string;
  scanId: string;
  reportType: string;
  cacheKey: string;
  sourceHash: string;
  rendererVersion: string;
  fontHash: string;
  status: "GENERATING" | "READY" | "FAILED";
  pdfBytes: Uint8Array | null;
  pdfSha256: string | null;
  sizeBytes: number | null;
  generationToken: string | null;
  lockExpiresAt: Date | null;
}

interface ClaimInput extends ScanReportCacheIdentity {
  generationToken: string;
  now: Date;
  lockExpiresAt: Date;
}

interface ReadyInput {
  scanId: string;
  reportType: string;
  generationToken: string;
  pdf: Buffer;
  pdfSha256: string;
  now: Date;
}

interface FailedInput {
  scanId: string;
  reportType: string;
  generationToken: string;
  errorMessage: string;
  now: Date;
}

export interface ScanReportCacheRepository {
  find(scanId: string, reportType: string): Promise<CacheRecord | null>;
  tryCreateClaim(input: ClaimInput): Promise<boolean>;
  tryClaim(input: ClaimInput): Promise<boolean>;
  storeReady(input: ReadyInput): Promise<boolean>;
  storeFailed(input: FailedInput): Promise<void>;
  touch(id: string, now: Date): Promise<void>;
}

interface CreateScanReportCacheServiceOptions {
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  lockTtlMs?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(record[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function buildScanReportCacheIdentity(
  result: PublicScanResult,
): ScanReportCacheIdentity {
  const safeResult = sanitizeScanResultForPdf(result);
  const sourceHash = sha256(stableStringify(safeResult));
  const rendererVersion = SCAN_RESULT_PDF_RENDERER_VERSION;
  const fontHash = scanResultPdfFontHash();
  const cacheKey = sha256(
    [
      reportTypeForLocale(result.scan.locale),
      result.scan.id,
      result.scan.locale,
      result.scan.rulesVersion,
      result.scan.completedAt ?? "not-completed",
      sourceHash,
      rendererVersion,
      fontHash,
    ].join(":"),
  );

  return {
    scanId: result.scan.id,
    reportType: reportTypeForLocale(result.scan.locale),
    cacheKey,
    sourceHash,
    rendererVersion,
    fontHash,
  };
}

function isReadyHit(
  record: CacheRecord | null,
  identity: ScanReportCacheIdentity,
): record is CacheRecord & { pdfBytes: Uint8Array } {
  return Boolean(
    record &&
      record.status === "READY" &&
      record.cacheKey === identity.cacheKey &&
      record.sourceHash === identity.sourceHash &&
      record.rendererVersion === identity.rendererVersion &&
      record.fontHash === identity.fontHash &&
      record.pdfBytes &&
      record.pdfBytes.length > 0 &&
      record.sizeBytes === record.pdfBytes.length &&
      record.pdfSha256 === sha256(Buffer.from(record.pdfBytes)),
  );
}

function errorMessage(error: unknown): string {
  const value =
    error instanceof Error
      ? error.message
      : String(error ?? "알 수 없는 오류");
  const sanitized = sanitizeEvidenceValue(value);

  return (
    typeof sanitized === "string"
      ? sanitized
      : "[오류 메시지 숨김]"
  ).slice(0, 500);
}

export function createScanReportCacheService(
  repository: ScanReportCacheRepository,
  options: CreateScanReportCacheServiceOptions = {},
): ScanReportCacheService {
  const now = options.now ?? (() => new Date());
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const waitTimeoutMs =
    options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  async function readHit(
    identity: ScanReportCacheIdentity,
  ): Promise<ScanReportCacheResponse | null> {
    const record = await repository.find(
      identity.scanId,
      identity.reportType,
    );

    if (!isReadyHit(record, identity)) {
      return null;
    }

    try {
      await repository.touch(record.id, now());
    } catch {
      // 마지막 접근 시각 갱신 실패는 정상 PDF 다운로드를 막지 않는다.
    }

    return {
      pdf: Buffer.from(record.pdfBytes),
      cacheStatus: "HIT",
    };
  }

  async function acquireClaim(
    identity: ScanReportCacheIdentity,
  ): Promise<string | null> {
    const claimedAt = now();
    const generationToken = randomUUID();
    const input: ClaimInput = {
      ...identity,
      generationToken,
      now: claimedAt,
      lockExpiresAt: new Date(claimedAt.getTime() + lockTtlMs),
    };

    if (await repository.tryCreateClaim(input)) {
      return generationToken;
    }

    if (await repository.tryClaim(input)) {
      return generationToken;
    }

    return null;
  }

  async function generateAndStore(
    result: PublicScanResult,
    identity: ScanReportCacheIdentity,
    generationToken: string,
    renderer: (result: PublicScanResult) => Promise<Buffer>,
  ): Promise<ScanReportCacheResponse> {
    try {
      const safeResult = sanitizeScanResultForPdf(result);
      const pdf = await renderer(safeResult);
      const stored = await repository.storeReady({
        scanId: identity.scanId,
        reportType: identity.reportType,
        generationToken,
        pdf,
        pdfSha256: sha256(pdf),
        now: now(),
      });

      if (!stored) {
        const winner = await readHit(identity);
        if (winner) {
          return winner;
        }

        throw new ScanReportCacheError(
          "SCAN_REPORT_CACHE_WRITE_CONFLICT",
          "진단 보고서 캐시 저장 중 다른 생성 작업과 충돌했습니다.",
          503,
        );
      }

      return {
        pdf,
        cacheStatus: "MISS",
      };
    } catch (error) {
      try {
        await repository.storeFailed({
          scanId: identity.scanId,
          reportType: identity.reportType,
          generationToken,
          errorMessage: errorMessage(error),
          now: now(),
        });
      } catch {
        // 원래 생성 오류를 유지한다.
      }

      throw error;
    }
  }

  return {
    async getOrCreate(
      result,
      renderer = renderScanResultPdf,
    ): Promise<ScanReportCacheResponse> {
      const identity = buildScanReportCacheIdentity(result);
      const immediateHit = await readHit(identity);

      if (immediateHit) {
        return immediateHit;
      }

      let generationToken = await acquireClaim(identity);

      if (generationToken) {
        return generateAndStore(
          result,
          identity,
          generationToken,
          renderer,
        );
      }

      const deadline = now().getTime() + waitTimeoutMs;

      while (now().getTime() < deadline) {
        await sleep(pollIntervalMs);

        const waitedHit = await readHit(identity);
        if (waitedHit) {
          return waitedHit;
        }

        generationToken = await acquireClaim(identity);
        if (generationToken) {
          return generateAndStore(
            result,
            identity,
            generationToken,
            renderer,
          );
        }
      }

      throw new ScanReportCacheError(
        "SCAN_REPORT_CACHE_TIMEOUT",
        "같은 진단 보고서를 생성 중입니다. 잠시 후 다시 시도해 주세요.",
        503,
      );
    },
  };
}

export function createPrismaScanReportCacheRepository(): ScanReportCacheRepository {
  return {
    async find(scanId, reportType) {
      const prisma = getDatabase();
      return prisma.scanReportCache.findUnique({
        where: {
          scanId_reportType: {
            scanId,
            reportType,
          },
        },
      });
    },

    async tryCreateClaim(input) {
      const prisma = getDatabase();

      try {
        await prisma.scanReportCache.create({
          data: {
            scanId: input.scanId,
            reportType: input.reportType,
            cacheKey: input.cacheKey,
            sourceHash: input.sourceHash,
            rendererVersion: input.rendererVersion,
            fontHash: input.fontHash,
            status: "GENERATING",
            generationToken: input.generationToken,
            lockExpiresAt: input.lockExpiresAt,
          },
        });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return false;
        }

        throw error;
      }
    },

    async tryClaim(input) {
      const prisma = getDatabase();
      const claimed = await prisma.scanReportCache.updateMany({
        where: {
          scanId: input.scanId,
          reportType: input.reportType,
          OR: [
            { status: { not: "GENERATING" } },
            { lockExpiresAt: null },
            { lockExpiresAt: { lt: input.now } },
            { cacheKey: { not: input.cacheKey } },
          ],
        },
        data: {
          cacheKey: input.cacheKey,
          sourceHash: input.sourceHash,
          rendererVersion: input.rendererVersion,
          fontHash: input.fontHash,
          status: "GENERATING",
          pdfBytes: null,
          pdfSha256: null,
          sizeBytes: null,
          generationToken: input.generationToken,
          lockExpiresAt: input.lockExpiresAt,
          generatedAt: null,
          lastAccessedAt: null,
          errorMessage: null,
        },
      });

      return claimed.count === 1;
    },

    async storeReady(input) {
      const prisma = getDatabase();
      const stored = await prisma.scanReportCache.updateMany({
        where: {
          scanId: input.scanId,
          reportType: input.reportType,
          status: "GENERATING",
          generationToken: input.generationToken,
        },
        data: {
          status: "READY",
          pdfBytes: Uint8Array.from(input.pdf),
          pdfSha256: input.pdfSha256,
          sizeBytes: input.pdf.length,
          generationToken: null,
          lockExpiresAt: null,
          generatedAt: input.now,
          lastAccessedAt: input.now,
          errorMessage: null,
        },
      });

      return stored.count === 1;
    },

    async storeFailed(input) {
      const prisma = getDatabase();
      await prisma.scanReportCache.updateMany({
        where: {
          scanId: input.scanId,
          reportType: input.reportType,
          generationToken: input.generationToken,
        },
        data: {
          status: "FAILED",
          pdfBytes: null,
          pdfSha256: null,
          sizeBytes: null,
          generationToken: null,
          lockExpiresAt: null,
          errorMessage: input.errorMessage,
          lastAccessedAt: input.now,
        },
      });
    },

    async touch(id, accessedAt) {
      const prisma = getDatabase();
      await prisma.scanReportCache.updateMany({
        where: { id },
        data: { lastAccessedAt: accessedAt },
      });
    },
  };
}

export function createPrismaScanReportCacheService(): ScanReportCacheService {
  return createScanReportCacheService(
    createPrismaScanReportCacheRepository(),
  );
}
