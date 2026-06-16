import {
  runNextQueuedScan,
  type ScanRunSummary,
} from "./scan-worker";

interface ScanWorkerLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface StartScanBackgroundWorkerOptions {
  pollIntervalMs?: number;
  runNext?: () => Promise<ScanRunSummary | null>;
  logger?: ScanWorkerLogger;
}

export interface ScanBackgroundWorker {
  stop(): Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 1_000;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function startScanBackgroundWorker(
  options: StartScanBackgroundWorkerOptions = {},
): ScanBackgroundWorker {
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const runNext = options.runNext ?? (() => runNextQueuedScan());
  const logger = options.logger ?? console;

  let stopped = false;
  let cancelDelay: (() => void) | null = null;

  async function waitForNextPoll(): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollIntervalMs);

      cancelDelay = () => {
        clearTimeout(timer);
        resolve();
      };
    });

    cancelDelay = null;
  }

  async function runLoop(): Promise<void> {
    logger.info(
      `자동 검사 워커가 시작되었습니다. 대기 간격: ${pollIntervalMs}ms`,
    );

    while (!stopped) {
      try {
        const result = await runNext();

        if (result) {
          logger.info(
            `자동 검사 처리 완료: ${result.scanId} / ${result.status}`,
          );
          continue;
        }
      } catch (error) {
        logger.error(
          `자동 검사 워커 오류: ${errorName(error)}`,
        );
      }

      if (!stopped) {
        await waitForNextPoll();
      }
    }

    logger.info("자동 검사 워커가 중지되었습니다.");
  }

  const loopPromise = runLoop();

  return {
    async stop(): Promise<void> {
      if (stopped) {
        await loopPromise;
        return;
      }

      stopped = true;
      cancelDelay?.();
      await loopPromise;
    },
  };
}
