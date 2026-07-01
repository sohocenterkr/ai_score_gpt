import { createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { getDatabase } from "../db";

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1_000;

export interface EmailVerificationDelivery {
  verificationId: string;
  to: string;
  token: string;
  expiresAt: Date;
  locale: "ko" | "en";
}

export interface EmailVerificationStatus {
  verified: boolean;
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

  const createdToken = await prisma.$transaction(async (transaction) => {
    await transaction.emailVerificationToken.updateMany({
      where: {
        email,
        usedAt: null,
      },
      data: { usedAt: now },
    });

    return transaction.emailVerificationToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    });
  });

  return {
    verificationId: createdToken.id,
    to: email,
    token,
    expiresAt,
    locale,
  };
}

export async function confirmEmailVerification(
  rawEmail: string,
  verificationId: string,
  rawToken: string,
): Promise<boolean> {
  const token = rawToken.trim();

  if (!verificationId.trim() || !token) {
    return false;
  }

  const prisma = getDatabase();
  const now = new Date();
  const confirmed = await prisma.emailVerificationToken.updateMany({
    where: {
      id: verificationId.trim(),
      email: normalizeEmail(rawEmail),
      tokenHash: hashEmailVerificationToken(token),
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { verifiedAt: now },
  });

  return confirmed.count === 1;
}

export async function getEmailVerificationStatus(
  rawEmail: string,
  verificationId: string,
): Promise<EmailVerificationStatus> {
  if (!verificationId.trim()) {
    return { verified: false };
  }

  const prisma = getDatabase();
  const verification = await prisma.emailVerificationToken.findFirst({
    where: {
      id: verificationId.trim(),
      email: normalizeEmail(rawEmail),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { verifiedAt: true },
  });

  return { verified: Boolean(verification?.verifiedAt) };
}

export async function consumeEmailVerification(
  rawEmail: string,
  input: {
    token?: string;
    verificationId?: string;
  },
): Promise<boolean> {
  const prisma = getDatabase();
  const now = new Date();
  const email = normalizeEmail(rawEmail);

  if (input.token?.trim()) {
    const consumed = await prisma.emailVerificationToken.updateMany({
      where: {
        email,
        tokenHash: hashEmailVerificationToken(input.token.trim()),
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    return consumed.count === 1;
  }

  if (input.verificationId?.trim()) {
    const consumed = await prisma.emailVerificationToken.updateMany({
      where: {
        id: input.verificationId.trim(),
        email,
        verifiedAt: { not: null },
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    return consumed.count === 1;
  }

  return false;
}
