import compression from "compression";
import express from "express";
import helmet from "helmet";
import { createRequireAuth } from "./auth/auth-middleware";
import { createAuthRouter } from "./auth/auth-router";
import {
  createPrismaAuthService,
  type AuthService,
} from "./auth/auth-service";
import { env } from "./config/env";
import { getDatabaseHealth } from "./services/database-health";
import { getNowKST } from "../shared/kst";

interface CreateAppOptions {
  authService?: AuthService;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const authService = options.authService ?? createPrismaAuthService();
  const requireAuth = createRequireAuth(authService);

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_request, response) => {
    const database = await getDatabaseHealth();
    const healthy = database.status !== "error";

    response.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      service: "site-ai-score",
      environment: env.NODE_ENV,
      timestampKST: getNowKST(),
      database,
    });
  });

  app.use("/api/auth", createAuthRouter(authService));

  app.get("/api/me", requireAuth, (_request, response) => {
    response.json({ user: response.locals.authUser });
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({
      code: "API_NOT_FOUND",
      message: "요청한 API를 찾을 수 없습니다.",
    });
  });

  return app;
}
