import { createHmac, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { env } from "../config/env";
import { getDatabase } from "../db";
import { AuthError } from "./auth-service";

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1_000;

export interface PasswordResetDelivery {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
}

export interface PasswordService {
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
  createPasswordReset(
    email: string,
  ): Promise<PasswordResetDelivery | null>;
  validatePasswordReset(rawToken: string): Promise<boolean>;
  resetPassword(rawToken: string, newPassword: string): Promise<void>;
}

function requireSessionSecret(): string {
  if (!env.SESSION_SECRET) {
    throw new AuthError(
      "AUTH_CONFIGURATION_ERROR",
      "로그인 설정이 완료되지 않았습니다.",
      503,
    );
  }

  return env.SESSION_SECRET;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashResetToken(rawToken: string): string {
  return createHmac("sha256", requireSessionSecret())
    .update(`password-reset:${rawToken}`)
    .digest("hex");
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function createPrismaPasswordService(): PasswordService {
  return {
    async changePassword(userId, currentPassword, newPassword) {
      const prisma = getDatabase();
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user?.passwordHash) {
        throw new AuthError(
          "AUTH_PASSWORD_NOT_AVAILABLE",
          "이 계정에는 변경할 로컬 비밀번호가 없습니다.",
          400,
        );
      }

      const currentMatches = await verifyPassword(
        user.passwordHash,
        currentPassword,
      );

      if (!currentMatches) {
        throw new AuthError(
          "AUTH_CURRENT_PASSWORD_INVALID",
          "현재 비밀번호가 올바르지 않습니다.",
          401,
        );
      }

      if (await verifyPassword(user.passwordHash, newPassword)) {
        throw new AuthError(
          "AUTH_NEW_PASSWORD_SAME",
          "새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.",
          400,
        );
      }

      const passwordHash = await hashPassword(newPassword);
      const now = new Date();

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
        }),
        prisma.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        }),
      ]);
    },

    async createPasswordReset(email) {
      const prisma = getDatabase();
      const user = await prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
      });

      if (!user || user.status !== "ACTIVE") {
        return null;
      }

      // AUTH_PASSWORD_RESET_GOOGLE_ONLY_ALLOWED
      // Google로 가입해 로컬 비밀번호가 아직 없는 계정도 이 링크로
      // 비밀번호를 새로 설정하고 LOCAL 로그인 방식을 연결할 수 있습니다.
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(token);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: { usedAt: now },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        }),
      ]);

      return {
        to: user.email,
        name: user.name,
        token,
        expiresAt,
      };
    },

    async validatePasswordReset(rawToken) {
      const prisma = getDatabase();
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: {
          tokenHash: hashResetToken(rawToken),
        },
        select: {
          usedAt: true,
          expiresAt: true,
          user: {
            select: {
              status: true,
            },
          },
        },
      });

      return Boolean(
        resetToken &&
          !resetToken.usedAt &&
          resetToken.expiresAt.getTime() > Date.now() &&
          resetToken.user.status === "ACTIVE",
      );
    },

    async resetPassword(rawToken, newPassword) {
      const prisma = getDatabase();
      const tokenHash = hashResetToken(rawToken);
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !resetToken ||
        resetToken.usedAt ||
        resetToken.expiresAt.getTime() <= Date.now() ||
        resetToken.user.status !== "ACTIVE"
      ) {
        throw new AuthError(
          "AUTH_RESET_TOKEN_INVALID",
          "재설정 링크가 올바르지 않거나 만료되었습니다.",
          400,
        );
      }

      const passwordHash = await hashPassword(newPassword);
      const now = new Date();

      await prisma.$transaction(async (transaction) => {
        const consumed = await transaction.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });

        if (consumed.count !== 1) {
          throw new AuthError(
            "AUTH_RESET_TOKEN_INVALID",
            "재설정 링크가 올바르지 않거나 만료되었습니다.",
            400,
          );
        }

        await transaction.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
        });

        await transaction.authAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: "LOCAL",
              providerAccountId: resetToken.user.email,
            },
          },
          update: {},
          create: {
            userId: resetToken.userId,
            provider: "LOCAL",
            providerAccountId: resetToken.user.email,
          },
        });

        await transaction.session.updateMany({
          where: {
            userId: resetToken.userId,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      });
    },
  };
}
