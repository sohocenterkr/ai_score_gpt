import "dotenv/config";
import { z } from "zod";

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function stringToBoolean(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "") {
    return undefined;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalEmail = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().email().optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5_000),
  APP_BASE_URL: z.string().url().default("http://localhost:5000"),
  DATABASE_URL: optionalString,
  SESSION_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(32).optional(),
  ),
  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: optionalEmail,
  RESEND_FROM_NAME: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(100).default("Site AI Score"),
  ),
  SCAN_WORKER_ENABLED: z.preprocess(
    stringToBoolean,
    z.boolean().default(true),
  ),
  SCAN_WORKER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(250)
    .max(60_000)
    .default(1_000),
  RENDERED_DOM_ENABLED: z.preprocess(
    stringToBoolean,
    z.boolean().default(true),
  ),
  CHROMIUM_PATH: optionalString,
  RENDERED_DOM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(60_000)
    .default(30_000),
  RENDERED_DOM_SETTLE_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(3_000),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const summary = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`환경변수 검증 실패: ${summary}`);
}

export const env = parsed.data;
