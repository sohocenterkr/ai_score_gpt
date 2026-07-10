import { describe, expect, it, vi } from "vitest";
import type { PublicScanResult } from "./scan-result-service";
import {
  buildScanReportCacheIdentity,
  createScanReportCacheService,
  type ScanReportCacheRepository,
} from "./scan-report-cache";

const sampleResult: PublicScanResult = {
  site: {
    id: "site-1",
    name: "예제 사이트",
    baseUrl: "https://example.com/",
    finalUrl: "https://example.com/ko",
    siteType: "기업 홈페이지",
    country: "KR",
    region: "서울",
    primaryLocale: "ko",
  },
  scan: {
    id: "scan-1",
    type: "QUICK",
    diagnosticNumber: 1,
    status: "COMPLETED",
    rulesVersion: "2026.06-core-v2",
    locale: "ko",
    score: 77,
    grade: "B",
    startedAt: "2026-06-15T00:00:00.000Z",
    completedAt: "2026-06-15T00:00:04.000Z",
    errorCode: null,
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  scoreSummary: null,
  currentRulesVersion: "2026.06-core-v3",
  isOutdatedRulesVersion: false,
  understandingSummary: "예제 사이트 요약",
  foundInformation: [],
  missingInformation: [],
  primaryIssues: [],
  pages: [],
  findings: [
    {
      id: "finding-1",
      ruleCode: "ACCESS-HTTP-001",
      category: "접근 및 수집 정책",
      severity: "INFO",
      status: "PASS",
      title: "HTTP 접근",
      description: "공개 URL이 정상 응답했습니다.",
      evidence: {
        message: "Authorization: Bearer secret-token-value",
      },
      recommendation: null,
      scoreDelta: 0,
      weight: 6,
    },
  ],
};

function createMemoryRepository(): ScanReportCacheRepository {
  let record: {
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
  } | null = null;

  return {
    async find(scanId, reportType) {
      return record?.scanId === scanId && record.reportType === reportType
        ? record
        : null;
    },

    async tryCreateClaim(input) {
      if (record) {
        return false;
      }

      record = {
        id: "cache-1",
        scanId: input.scanId,
        reportType: input.reportType,
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
      };
      return true;
    },

    async tryClaim(input) {
      if (!record) {
        return false;
      }

      const expired =
        !record.lockExpiresAt ||
        record.lockExpiresAt.getTime() < input.now.getTime();
      const claimable =
        record.status !== "GENERATING" ||
        expired ||
        record.cacheKey !== input.cacheKey;

      if (!claimable) {
        return false;
      }

      record = {
        ...record,
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
      };
      return true;
    },

    async storeReady(input) {
      if (
        !record ||
        record.generationToken !== input.generationToken ||
        record.status !== "GENERATING"
      ) {
        return false;
      }

      record = {
        ...record,
        status: "READY",
        pdfBytes: Buffer.from(input.pdf),
        pdfSha256: input.pdfSha256,
        sizeBytes: input.pdf.length,
        generationToken: null,
        lockExpiresAt: null,
      };
      return true;
    },

    async storeFailed(input) {
      if (record?.generationToken !== input.generationToken) {
        return;
      }

      record = {
        ...record,
        status: "FAILED",
        pdfBytes: null,
        pdfSha256: null,
        sizeBytes: null,
        generationToken: null,
        lockExpiresAt: null,
      };
    },

    async touch() {
      return;
    },
  };
}

describe("scan report cache", () => {
  it("최초 생성 후 동일 결과는 저장된 PDF를 반환한다", async () => {
    const repository = createMemoryRepository();
    const service = createScanReportCacheService(repository, {
      pollIntervalMs: 1,
      waitTimeoutMs: 100,
    });
    const renderer = vi
      .fn()
      .mockResolvedValue(Buffer.from("%PDF-cached-report"));

    const first = await service.getOrCreate(sampleResult, renderer);
    const second = await service.getOrCreate(sampleResult, renderer);

    expect(first.cacheStatus).toBe("MISS");
    expect(second.cacheStatus).toBe("HIT");
    expect(second.pdf.equals(first.pdf)).toBe(true);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it("검사 결과가 바뀌면 캐시 키가 달라져 다시 생성한다", async () => {
    const repository = createMemoryRepository();
    const service = createScanReportCacheService(repository);
    const renderer = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("%PDF-first"))
      .mockResolvedValueOnce(Buffer.from("%PDF-second"));

    const changedResult: PublicScanResult = {
      ...sampleResult,
      scan: {
        ...sampleResult.scan,
        score: 78,
      },
    };

    const firstIdentity = buildScanReportCacheIdentity(sampleResult);
    const changedIdentity = buildScanReportCacheIdentity(changedResult);

    await service.getOrCreate(sampleResult, renderer);
    const changed = await service.getOrCreate(changedResult, renderer);

    expect(firstIdentity.cacheKey).not.toBe(changedIdentity.cacheKey);
    expect(changed.cacheStatus).toBe("MISS");
    expect(changed.pdf.toString()).toBe("%PDF-second");
    expect(renderer).toHaveBeenCalledTimes(2);
  });

  it("같은 검사라도 PDF locale이 다르면 캐시를 분리한다", () => {
    const englishResult: PublicScanResult = {
      ...sampleResult,
      scan: {
        ...sampleResult.scan,
        locale: "en",
      },
    };

    const koreanIdentity = buildScanReportCacheIdentity(sampleResult);
    const englishIdentity = buildScanReportCacheIdentity(englishResult);

    expect(koreanIdentity.reportType).toBe("DIAGNOSTIC_KO");
    expect(englishIdentity.reportType).toBe("DIAGNOSTIC_EN");
    expect(koreanIdentity.cacheKey).not.toBe(englishIdentity.cacheKey);
  });

  it("동시에 같은 보고서를 요청해도 한 번만 생성한다", async () => {
    const repository = createMemoryRepository();
    const service = createScanReportCacheService(repository, {
      pollIntervalMs: 1,
      waitTimeoutMs: 200,
    });
    const renderer = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Buffer.from("%PDF-single-flight");
    });

    const [first, second] = await Promise.all([
      service.getOrCreate(sampleResult, renderer),
      service.getOrCreate(sampleResult, renderer),
    ]);

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(first.pdf.equals(second.pdf)).toBe(true);
    expect([first.cacheStatus, second.cacheStatus].sort()).toEqual([
      "HIT",
      "MISS",
    ]);
  });

  it("캐시 저장본의 민감정보와 무결성을 검증한다", async () => {
    const repository = createMemoryRepository();
    const service = createScanReportCacheService(repository);
    const renderer = vi.fn(async (safeResult: PublicScanResult) =>
      Buffer.from(JSON.stringify(safeResult), "utf8"),
    );

    const first = await service.getOrCreate(sampleResult, renderer);
    const second = await service.getOrCreate(sampleResult, renderer);
    const firstText = first.pdf.toString("utf8");
    const secondText = second.pdf.toString("utf8");

    expect(firstText).not.toContain("secret-token-value");
    expect(secondText).not.toContain("secret-token-value");
    expect(firstText).toContain("[보안상 숨김]");
    expect(secondText).toContain("[보안상 숨김]");
    expect(first.pdf.equals(second.pdf)).toBe(true);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it("저장된 PDF의 크기나 해시가 맞지 않으면 다시 생성한다", async () => {
    const repository = createMemoryRepository();
    const originalFind = repository.find.bind(repository);
    let returnCorruptedPdf = false;

    repository.find = async (scanId, reportType) => {
      const record = await originalFind(scanId, reportType);

      if (!returnCorruptedPdf || !record || !record.pdfBytes) {
        return record;
      }

      return {
        ...record,
        pdfBytes: Buffer.from("%PDF-corrupted"),
      };
    };

    const service = createScanReportCacheService(repository);
    const renderer = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("%PDF-original"))
      .mockResolvedValueOnce(Buffer.from("%PDF-regenerated"));

    const first = await service.getOrCreate(sampleResult, renderer);
    returnCorruptedPdf = true;
    const second = await service.getOrCreate(sampleResult, renderer);

    expect(first.cacheStatus).toBe("MISS");
    expect(second.cacheStatus).toBe("MISS");
    expect(second.pdf.toString()).toBe("%PDF-regenerated");
    expect(renderer).toHaveBeenCalledTimes(2);
  });

  it("PDF 생성 실패 메시지의 인증정보를 숨겨 저장한다", async () => {
    const repository = createMemoryRepository();
    const originalStoreFailed = repository.storeFailed.bind(repository);
    const storeFailed = vi.fn(originalStoreFailed);

    repository.storeFailed = storeFailed;

    const service = createScanReportCacheService(repository);
    const renderer = vi
      .fn()
      .mockRejectedValue(
        new Error("Authorization: Bearer failure-secret-token"),
      );

    await expect(service.getOrCreate(sampleResult, renderer)).rejects.toThrow();

    expect(storeFailed).toHaveBeenCalledTimes(1);

    const failedInput = storeFailed.mock.calls[0]?.[0];
    expect(failedInput?.errorMessage).not.toContain("failure-secret-token");
    expect(failedInput?.errorMessage).toContain("[보안상 숨김]");
  });
});
