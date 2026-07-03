import compression from "compression";
import express from "express";
import helmet from "helmet";
import { createRequireAuth } from "./auth/auth-middleware";
import { createAuthRouter } from "./auth/auth-router";
import {
  createPrismaAuthService,
  type AuthService,
} from "./auth/auth-service";
import { createPasswordRouter } from "./auth/password-router";
import {
  createPrismaPasswordService,
  type PasswordService,
} from "./auth/password-service";
import {
  createResendPasswordResetMailer,
  type PasswordResetMailer,
} from "./email/password-reset-mailer";
import {
  createResendEmailVerificationMailer,
  type EmailVerificationMailer,
} from "./email/email-verification-mailer";
import { env } from "./config/env";
import { getDatabaseHealth } from "./services/database-health";
import { createScanResultRouter } from "./scans/scan-result-router";
import {
  createPrismaScanResultService,
  type ScanResultService,
} from "./scans/scan-result-service";
import {
  createPrismaScanReportCacheService,
  type ScanReportCacheService,
} from "./scans/scan-report-cache";
import { createWorkOrderRouter } from "./work-orders/work-order-router";
import {
  createPrismaWorkOrderService,
  type WorkOrderService,
} from "./work-orders/work-order-service";
import {
  createDeepDiagnosticAdminRouter,
} from "./deep-diagnostics/deep-diagnostic-admin-router";
import {
  createPrismaDeepDiagnosticAdminService,
  type DeepDiagnosticAdminService,
} from "./deep-diagnostics/deep-diagnostic-admin-service";
import { createSiteRouter } from "./sites/site-router";
import {
  createPrismaSiteService,
  type SiteService,
} from "./sites/site-service";
import { getNowKST } from "../shared/kst";
import { getRenderedDomCollectorRuntimeStatus } from "./scans/scan-worker";
import { createAdminRouter } from "./admin/admin-router";
import { createNoticeRouter } from "./notices/notice-router";
import {
  createPaymentRouter,
  createPolarWebhookRouter,
  createPortOneWebhookRouter,
} from "./billing/payment-router";
import {
  createPrismaPaymentService,
  type PaymentService,
} from "./billing/payment-service";

interface CreateAppOptions {
  authService?: AuthService;
  passwordService?: PasswordService;
  passwordResetMailer?: PasswordResetMailer;
  emailVerificationMailer?: EmailVerificationMailer;
  siteService?: SiteService;
  deepDiagnosticAdminService?: DeepDiagnosticAdminService;
  scanResultService?: ScanResultService;
  scanReportCacheService?: ScanReportCacheService;
  workOrderService?: WorkOrderService;
  paymentService?: PaymentService;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const authService = options.authService ?? createPrismaAuthService();
  const passwordService =
    options.passwordService ?? createPrismaPasswordService();
  const passwordResetMailer =
    options.passwordResetMailer ?? createResendPasswordResetMailer();
  const emailVerificationMailer =
    options.emailVerificationMailer ?? createResendEmailVerificationMailer();
  const siteService = options.siteService ?? createPrismaSiteService();
  const deepDiagnosticAdminService =
    options.deepDiagnosticAdminService ??
    createPrismaDeepDiagnosticAdminService();
  const scanResultService =
    options.scanResultService ?? createPrismaScanResultService();
  const scanReportCacheService =
    options.scanReportCacheService ??
    createPrismaScanReportCacheService();
  const workOrderService =
    options.workOrderService ?? createPrismaWorkOrderService();
  const paymentService =
    options.paymentService ?? createPrismaPaymentService();
  const requireAuth = createRequireAuth(authService);

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    "/api/billing/portone-webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    createPortOneWebhookRouter({
      paymentService,
    }),
  );
  app.use(
    "/api/billing/polar-webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    createPolarWebhookRouter({
      paymentService,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_request, response) => {
    const database = await getDatabaseHealth();
    const healthy = database.status !== "error";

    response.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      service: "site-ai-score",
      environment: env.NODE_ENV,
      deployment: {
        vercel: process.env.VERCEL === "1",
        commit:
          process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
      renderedDom: getRenderedDomCollectorRuntimeStatus(),
      timestampKST: getNowKST(),
      database,
    });
  });

  app.use("/api/notices", createNoticeRouter());

  app.use("/api/auth", createAuthRouter(authService, emailVerificationMailer));
  app.use(
    "/api/auth",
    createPasswordRouter({
      passwordService,
      passwordResetMailer,
      requireAuth,
    }),
  );
  app.use(
    "/api/admin",
    createAdminRouter({
      requireAuth,
    }),
  );
  app.use(
    "/api/sites",
    createSiteRouter({
      siteService,
      requireAuth,
    }),
  );
  app.use(
    "/api/billing",
    createPaymentRouter({
      paymentService,
      requireAuth,
    }),
  );
  app.use(
    "/api/deep-diagnostics",
    createDeepDiagnosticAdminRouter({
      service: deepDiagnosticAdminService,
      requireAuth,
    }),
  );
  app.use(
    "/api/scan-results",
    createScanResultRouter({
      scanResultService,
      scanReportCacheService,
      requireAuth,
    }),
  );
  app.use(
    "/api/work-orders",
    createWorkOrderRouter({
      workOrderService,
      requireAuth,
    }),
  );

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
