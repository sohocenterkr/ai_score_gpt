import type { Request } from "express";
import type { PublicUser } from "./auth-service";

export const DEV_USER_PREVIEW_HEADER = "x-site-ai-dev-user-preview";
export const DEV_USER_PREVIEW_QUERY = "devUserPreview";
export const DEV_USER_PREVIEW_EMAIL =
  "regular-user-preview@siteaiscore.invalid";

const DEFAULT_SUPER_ADMIN_EMAIL = "sohocenter.kr@gmail.com";

interface ResolveDevUserPreviewInput {
  nodeEnv: string;
  configuredSuperAdminEmail?: string | null;
  method: string;
  headerValue?: string;
  queryValue?: unknown;
  user: PublicUser;
}

export interface DevUserPreviewResolution {
  active: boolean;
  readOnlyViolation: boolean;
  user: PublicUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readQueryFlag(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => item === "1");
  }

  return value === "1";
}

function isReadOnlyMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isDevUserPreviewPublicUser(user: Pick<PublicUser, "email">) {
  return normalizeEmail(user.email) === DEV_USER_PREVIEW_EMAIL;
}

export function resolveDevUserPreview(
  input: ResolveDevUserPreviewInput,
): DevUserPreviewResolution {
  const configuredEmail = normalizeEmail(
    input.configuredSuperAdminEmail || DEFAULT_SUPER_ADMIN_EMAIL,
  );
  const isActualSuperAdmin =
    input.user.role === "SUPER_ADMIN" &&
    normalizeEmail(input.user.email) === configuredEmail;
  const requested =
    input.headerValue === "1" || readQueryFlag(input.queryValue);
  const active =
    input.nodeEnv === "development" && isActualSuperAdmin && requested;

  if (!active) {
    return {
      active: false,
      readOnlyViolation: false,
      user: input.user,
    };
  }

  return {
    active: true,
    readOnlyViolation: !isReadOnlyMethod(input.method),
    user: {
      ...input.user,
      email: DEV_USER_PREVIEW_EMAIL,
      role: "USER",
    },
  };
}

export function resolveDevUserPreviewFromRequest(
  request: Request,
  user: PublicUser,
  nodeEnv: string,
  configuredSuperAdminEmail?: string | null,
): DevUserPreviewResolution {
  return resolveDevUserPreview({
    nodeEnv,
    configuredSuperAdminEmail,
    method: request.method,
    headerValue: request.get(DEV_USER_PREVIEW_HEADER),
    queryValue: request.query[DEV_USER_PREVIEW_QUERY],
    user,
  });
}
