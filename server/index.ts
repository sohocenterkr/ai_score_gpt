import express from "express";
import path from "node:path";
import { createApp } from "./app";
import { env } from "./config/env";
import { disconnectDatabase } from "./db";

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

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Site AI Score 개발 서버가 포트 ${env.PORT}에서 실행 중입니다.`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} 신호를 받아 서버를 종료합니다.`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
