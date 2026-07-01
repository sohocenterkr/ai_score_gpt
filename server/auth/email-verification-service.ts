import { createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { getDatabase } from "../db";

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1_000;

export interface EmailVerificationDelivery {
  to: string;
  token: string;
  expiresAt: Date;
  locale: "ko" | "en";
}

function requireSessionSecret(): string {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET이 설정되지 않았습니다.");
  }

  return env.SESSION_SECRET;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmailVerificationToken(rawToken: string): string {
  return createHmac("sha256", requireSessionSecret())
    .update(`email-verification:${rawToken}`)
    .digest("hex");
}

export async function createEmailVerificationDelivery(
  rawEmail: string,
  locale: "ko" | "en" = "ko",
): Promise<EmailVerificationDelivery | null> {
  const prisma = getDatabase();
  const email = normalizeEmail(rawEmail);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: {
        email,
        usedAt: null,
      },
      data: { usedAt: now },
    }),
    prisma.emailVerificationToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    to: email,
    token,
    expiresAt,
    locale,
  };
}

export async function consumeEmailVerificationToken(
  rawEmail: string,
  rawToken: string,
): Promise<boolean> {
  const token = rawToken.trim();

  if (!token) {
    return false;
  }

  const prisma = getDatabase();
  const now = new Date();
  const consumed = await prisma.emailVerificationToken.updateMany({
    where: {
      email: normalizeEmail(rawEmail),
      tokenHash: hashEmailVerificationToken(token),
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  return consumed.count === 1;
}
