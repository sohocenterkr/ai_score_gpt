import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimit(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();

  return function rateLimit(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    const now = Date.now();
    const key = `${request.ip ?? "unknown"}:${request.path}`;
    const current = entries.get(key);

    if (!current || current.resetAt <= now) {
      entries.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    if (current.count >= options.maxRequests) {
      response.status(429).json({
        code: "AUTH_RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    current.count += 1;
    next();
  };
}
