import { describe, expect, it, vi } from "vitest";
import {
  startScanBackgroundWorker,
  type StartScanBackgroundWorkerOptions,
} from "./scan-background-worker";
import type { ScanRunSummary } from "./scan-worker";

const completedScan: ScanRunSummary = {
  scanId: "scan-1",
  siteId: "site-1",
  siteName: "테스트 사이트",
  status: "COMPLETED",
  finalUrl: "https://example.com/",
  pageId: "page-1",
  findingsCount: 25,
  score: 71,
  grade: "B",
  errorCode: null,
};

function createLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

function startForTest(
  options: Partial<StartScanBackgroundWorkerOptions>,
) {
  return startScanBackgroundWorker({
    pollIntervalMs: 5,
    logger: createLogger(),
    ...options,
  });
}

describe("scan background worker", () => {
  it("대기 중인 검사를 순차적으로 모두 처리한다", async () => {
    let resolveIdle:
      | ((value: ScanRunSummary | null) => void)
      | undefined;

    const idleResult = new Promise<ScanRunSummary | null>(
      (resolve) => {
        resolveIdle = resolve;
      },
    );

    const runNext = vi
      .fn()
      .mockResolvedValueOnce(completedScan)
      .mockResolvedValueOnce({
        ...completedScan,
        scanId: "scan-2",
      })
      .mockImplementation(() => idleResult);

    const worker = startForTest({ runNext });

    await vi.waitFor(() => {
      expect(runNext).toHaveBeenCalledTimes(3);
    });

    resolveIdle?.(null);
    await worker.stop();
  });

  it("한 검사가 끝나기 전에 다음 검사를 중복 실행하지 않는다", async () => {
    let resolveRun:
      | ((value: ScanRunSummary | null) => void)
      | undefined;

    const runNext = vi.fn(
      () =>
        new Promise<ScanRunSummary | null>((resolve) => {
          resolveRun = resolve;
        }),
    );

    const worker = startForTest({ runNext });

    await vi.waitFor(() => {
      expect(runNext).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runNext).toHaveBeenCalledTimes(1);

    resolveRun?.(null);
    await worker.stop();
  });

  it("일시적인 워커 오류 후에도 다음 대기 작업을 확인한다", async () => {
    const logger = createLogger();
    const runNext = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue(null);

    const worker = startScanBackgroundWorker({
      pollIntervalMs: 5,
      runNext,
      logger,
    });

    await vi.waitFor(() => {
      expect(runNext.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "자동 검사 워커 오류: Error",
    );

    await worker.stop();
  });

  it("중지 요청 시 대기 타이머를 깨우고 종료한다", async () => {
    const runNext = vi.fn().mockResolvedValue(null);
    const worker = startScanBackgroundWorker({
      pollIntervalMs: 60_000,
      runNext,
      logger: createLogger(),
    });

    await vi.waitFor(() => {
      expect(runNext).toHaveBeenCalledTimes(1);
    });

    await expect(worker.stop()).resolves.toBeUndefined();
  });
});
