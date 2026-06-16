import express from "express";
import path from "node:path";
import { createApp } from "./app";
import { env } from "./config/env";
import { disconnectDatabase } from "./db";
import {
  startScanBackgroundWorker,
  type ScanBackgroundWorker,
} from "./scans/scan-background-worker";

const app = createApp();

async function configureFrontend(): Promise<void> {
  if (env.NODE_ENV === "production") {
    const publicDirectory = path.resolve(process.cwd(), "dist/public");
    app.use(express.static(publicDirectory));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }
      response.sendFile(path.join(publicDirectory, "index.html"));
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

await configureFrontend();

let scanWorker: ScanBackgroundWorker | null = null;
let shuttingDown = false;

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Site AI Score 개발 서버가 포트 ${env.PORT}에서 실행 중입니다.`);

  if (env.SCAN_WORKER_ENABLED) {
    scanWorker = startScanBackgroundWorker({
      pollIntervalMs: env.SCAN_WORKER_POLL_INTERVAL_MS,
    });
  } else {
    console.log("자동 검사 워커가 비활성화되어 있습니다.");
  }
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} 신호를 받아 서버를 종료합니다.`);

  await scanWorker?.stop();

  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
