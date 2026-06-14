import type { Request, Response } from "express";
import { env } from "../config/env";

export const SESSION_COOKIE_NAME = "siteaiscore_session";

const commonCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookie(
  response: Response,
  rawToken: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE_NAME, rawToken, {
    ...commonCookieOptions,
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, commonCookieOptions);
}

export function readSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = entry.trim().split("=");

    if (rawName !== SESSION_COOKIE_NAME) {
      continue;
    }

    const value = rawValueParts.join("=");

    if (!value) {
      return undefined;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
