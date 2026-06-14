import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5_000),
  APP_BASE_URL: z.string().url().default("http://localhost:5000"),
  DATABASE_URL: z.string().trim().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const summary = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`환경변수 검증 실패: ${summary}`);
}

export const env = {
  ...parsed.data,
  DATABASE_URL: parsed.data.DATABASE_URL || undefined,
};
