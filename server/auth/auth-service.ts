import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { Prisma, type User } from "@prisma/client";
import { env } from "../config/env";
import { getDatabase } from "../db";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const LOGIN_LOCK_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 30 * 60 * 1_000;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "AGENCY" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  emailVerifiedAt: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface DeleteAccountInput {
  currentPassword: string;
}

export interface SignupResult {
  user: PublicUser;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export interface VerifiedEmailLoginInput {
  email: string;
}

export interface AuthService {
  signup(input: SignupInput): Promise<SignupResult>;
  createSessionForVerifiedEmail(
    input: VerifiedEmailLoginInput,
  ): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  getSessionUser(rawToken: string): Promise<PublicUser | null>;
  deleteAccount(rawToken: string, input: DeleteAccountInput): Promise<void>;
  logout(rawToken: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
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

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function hashSessionToken(rawToken: string): string {
  return createHmac("sha256", requireSessionSecret())
    .update(rawToken)
    .digest("hex");
}

function hashDeletedAccountEmail(email: string): string {
  return createHmac("sha256", requireSessionSecret())
    .update(`deleted-account-email:${normalizeEmail(email)}`)
    .digest("hex");
}

function createSessionValues() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    loginCount: user.loginCount,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
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

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifySuperAdminPassword(password: string): Promise<boolean> {
  if (env.SUPER_ADMIN_PASSWORD_HASH) {
    return verifyPassword(env.SUPER_ADMIN_PASSWORD_HASH, password);
  }

  if (env.SUPER_ADMIN_PASSWORD) {
    return safeEqual(env.SUPER_ADMIN_PASSWORD, password);
  }

  return false;
}

async function loginConfiguredSuperAdmin(
  email: string,
  password: string,
): Promise<AuthResult | null> {
  const configuredEmail = env.SUPER_ADMIN_EMAIL
    ? normalizeEmail(env.SUPER_ADMIN_EMAIL)
    : null;

  if (!configuredEmail || email !== configuredEmail) {
    return null;
  }

  if (!env.SUPER_ADMIN_PASSWORD && !env.SUPER_ADMIN_PASSWORD_HASH) {
    throw new AuthError(
      "AUTH_CONFIGURATION_ERROR",
      "수퍼관리자 로그인 설정이 완료되지 않았습니다.",
      503,
    );
  }

  const passwordMatches = await verifySuperAdminPassword(password);

  if (!passwordMatches) {
    throw new AuthError(
      "AUTH_INVALID_CREDENTIALS",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
      401,
    );
  }

  const prisma = getDatabase();
  const now = new Date();
  const session = createSessionValues();
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findUnique({
      where: { email },
    });

    const superAdminData = {
      name: "수퍼관리자",
      passwordHash,
      role: "SUPER_ADMIN" as const,
      status: "ACTIVE" as const,
      emailVerifiedAt: now,
      loginCount: { increment: 1 },
      lastLoginAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    const nextUser = existingUser
      ? await transaction.user.update({
          where: { id: existingUser.id },
          data: superAdminData,
        })
      : await transaction.user.create({
          data: {
            ...(env.SUPER_ADMIN_ID ? { id: env.SUPER_ADMIN_ID } : {}),
            email,
            name: "수퍼관리자",
            passwordHash,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: now,
            termsAcceptedAt: now,
            privacyAcceptedAt: now,
            loginCount: 1,
            lastLoginAt: now,
            authAccounts: {
              create: {
                provider: "SECRET_ADMIN",
                providerAccountId: email,
              },
            },
          },
        });

    await transaction.session.create({
      data: {
        userId: nextUser.id,
        sessionTokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
      },
    });

    return nextUser;
  });

  return {
    user: toPublicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function formatLockRemaining(lockedUntil: Date, now = new Date()): string {
  const remainingMs = Math.max(lockedUntil.getTime() - now.getTime(), 0);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  return `${remainingMinutes}분`;
}

function createAccountLockedError(lockedUntil: Date, now = new Date()): AuthError {
  return new AuthError(
    "AUTH_ACCOUNT_LOCKED",
    `비밀번호를 여러 번 잘못 입력해 계정이 잠겼습니다. ${formatLockRemaining(
      lockedUntil,
      now,
    )} 후 다시 시도해 주세요.`,
    423,
  );
}

export function createPrismaAuthService(): AuthService {
  return {
    async signup(input) {
      const prisma = getDatabase();
      const email = normalizeEmail(input.email);
      const name = normalizeName(input.name);
      const now = new Date();
      const deletedAccount = await prisma.deletedAccountEmail.findUnique({
        where: { emailHash: hashDeletedAccountEmail(email) },
        select: { id: true },
      });

      if (deletedAccount) {
        throw new AuthError(
          "AUTH_EMAIL_WITHDRAWN",
          "탈퇴한 이메일 아이디로는 다시 가입할 수 없습니다.",
          409,
        );
      }

      const passwordHash = await hashPassword(input.password);

      try {
        const user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            termsAcceptedAt: now,
            privacyAcceptedAt: now,
            emailVerifiedAt: null,
            loginCount: 0,
            lastLoginAt: null,
            authAccounts: {
              create: {
                provider: "LOCAL",
                providerAccountId: email,
              },
            },
          },
        });

        return {
          user: toPublicUser(user),
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AuthError(
            "AUTH_EMAIL_EXISTS",
            "이미 가입된 이메일입니다.",
            409,
          );
        }

        throw error;
      }
    },

    async createSessionForVerifiedEmail(input) {
      const prisma = getDatabase();
      const email = normalizeEmail(input.email);
      const now = new Date();
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user?.emailVerifiedAt) {
        throw new AuthError(
          "AUTH_EMAIL_VERIFICATION_REQUIRED",
          "이메일 인증을 완료한 뒤 로그인할 수 있습니다.",
          403,
        );
      }

      if (user.status === "SUSPENDED") {
        throw new AuthError(
          "AUTH_ACCOUNT_SUSPENDED",
          "정지된 계정입니다. 관리자에게 문의해 주세요.",
          403,
        );
      }

      const session = createSessionValues();
      const updatedUser = await prisma.$transaction(async (transaction) => {
        const nextUser = await transaction.user.update({
          where: { id: user.id },
          data: {
            loginCount: { increment: 1 },
            lastLoginAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        await transaction.session.create({
          data: {
            userId: user.id,
            sessionTokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
          },
        });

        return nextUser;
      });

      return {
        user: toPublicUser(updatedUser),
        token: session.token,
        expiresAt: session.expiresAt,
      };
    },

    async login(input) {
      const email = normalizeEmail(input.email);
      const superAdminResult = await loginConfiguredSuperAdmin(
        email,
        input.password,
      );

      if (superAdminResult) {
        return superAdminResult;
      }

      const prisma = getDatabase();
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user?.passwordHash) {
        throw new AuthError(
          "AUTH_INVALID_CREDENTIALS",
          "이메일 또는 비밀번호가 올바르지 않습니다.",
          401,
        );
      }

      if (user.status === "SUSPENDED") {
        throw new AuthError(
          "AUTH_ACCOUNT_SUSPENDED",
          "정지된 계정입니다. 관리자에게 문의해 주세요.",
          403,
        );
      }

      if (!user.emailVerifiedAt) {
        throw new AuthError(
          "AUTH_EMAIL_NOT_VERIFIED",
          "이메일 인증을 완료한 뒤 로그인해 주세요.",
          403,
        );
      }

      const now = new Date();

      if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
        throw createAccountLockedError(user.lockedUntil, now);
      }

      const passwordMatches = await verifyPassword(
        user.passwordHash,
        input.password,
      );

      if (!passwordMatches) {
        const previousFailureCount =
          user.lockedUntil && user.lockedUntil.getTime() <= now.getTime()
            ? 0
            : user.failedLoginAttempts;
        const nextFailureCount = previousFailureCount + 1;
        const nextLockedUntil =
          nextFailureCount >= LOGIN_LOCK_MAX_FAILURES
            ? new Date(now.getTime() + LOGIN_LOCK_MS)
            : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: nextFailureCount,
            lockedUntil: nextLockedUntil,
          },
        });

        if (nextLockedUntil) {
          throw createAccountLockedError(nextLockedUntil, now);
        }

        throw new AuthError(
          "AUTH_INVALID_CREDENTIALS",
          "이메일 또는 비밀번호가 올바르지 않습니다.",
          401,
        );
      }

      const session = createSessionValues();
      const updatedUser = await prisma.$transaction(async (transaction) => {
        const nextUser = await transaction.user.update({
          where: { id: user.id },
          data: {
            loginCount: { increment: 1 },
            lastLoginAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        await transaction.session.create({
          data: {
            userId: user.id,
            sessionTokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
          },
        });

        return nextUser;
      });

      return {
        user: toPublicUser(updatedUser),
        token: session.token,
        expiresAt: session.expiresAt,
      };
    },

    async getSessionUser(rawToken) {
      const prisma = getDatabase();
      const session = await prisma.session.findUnique({
        where: {
          sessionTokenHash: hashSessionToken(rawToken),
        },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        session.user.status !== "ACTIVE"
      ) {
        return null;
      }

      return toPublicUser(session.user);
    },

    async deleteAccount(rawToken, input) {
      const prisma = getDatabase();
      const sessionTokenHash = hashSessionToken(rawToken);
      const session = await prisma.session.findUnique({
        where: { sessionTokenHash },
        include: {
          user: {
            include: {
              organizationMembers: {
                include: {
                  organization: {
                    include: {
                      members: { select: { userId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new AuthError(
          "AUTH_REQUIRED",
          "로그인이 필요합니다.",
          401,
        );
      }

      const user = session.user;

      if (user.role === "SUPER_ADMIN") {
        throw new AuthError(
          "AUTH_SUPER_ADMIN_DELETE_FORBIDDEN",
          "수퍼관리자 계정은 회원탈퇴할 수 없습니다.",
          403,
        );
      }

      if (!user.passwordHash) {
        throw new AuthError(
          "AUTH_PASSWORD_REQUIRED",
          "비밀번호 로그인 계정만 회원탈퇴할 수 있습니다.",
          400,
        );
      }

      const passwordMatches = await verifyPassword(
        user.passwordHash,
        input.currentPassword,
      );

      if (!passwordMatches) {
        throw new AuthError(
          "AUTH_INVALID_PASSWORD",
          "현재 비밀번호가 올바르지 않습니다.",
          401,
        );
      }

      const ownOrganizationIds = user.organizationMembers
        .filter((member) => member.organization.members.length <= 1)
        .map((member) => member.organizationId);
      const sharedOrganizationIds = user.organizationMembers
        .filter((member) => member.organization.members.length > 1)
        .map((member) => member.organizationId);
      const emailHash = hashDeletedAccountEmail(user.email);

      await prisma.$transaction(async (transaction) => {
        await transaction.deletedAccountEmail.upsert({
          where: { emailHash },
          update: {},
          create: { emailHash },
        });

        if (ownOrganizationIds.length > 0) {
          await transaction.organization.deleteMany({
            where: { id: { in: ownOrganizationIds } },
          });
        }

        if (sharedOrganizationIds.length > 0) {
          await transaction.organizationMember.deleteMany({
            where: {
              userId: user.id,
              organizationId: { in: sharedOrganizationIds },
            },
          });
        }

        await transaction.emailVerificationToken.deleteMany({
          where: { email: user.email },
        });

        await transaction.user.delete({
          where: { id: user.id },
        });
      });
    },

    async logout(rawToken) {
      const prisma = getDatabase();
      await prisma.session.updateMany({
        where: {
          sessionTokenHash: hashSessionToken(rawToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    },
  };
}
