import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { Prisma, type User } from "@prisma/client";
import { env } from "../config/env";
import { getDatabase } from "../db";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

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
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export interface AuthService {
  signup(input: SignupInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  getSessionUser(rawToken: string): Promise<PublicUser | null>;
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

export function createPrismaAuthService(): AuthService {
  return {
    async signup(input) {
      const prisma = getDatabase();
      const email = normalizeEmail(input.email);
      const name = normalizeName(input.name);
      const passwordHash = await hashPassword(input.password);
      const now = new Date();
      const session = createSessionValues();

      try {
        const user = await prisma.$transaction(async (transaction) => {
          const createdUser = await transaction.user.create({
            data: {
              email,
              name,
              passwordHash,
              termsAcceptedAt: now,
              privacyAcceptedAt: now,
              loginCount: 1,
              lastLoginAt: now,
              authAccounts: {
                create: {
                  provider: "LOCAL",
                  providerAccountId: email,
                },
              },
            },
          });

          await transaction.session.create({
            data: {
              userId: createdUser.id,
              sessionTokenHash: session.tokenHash,
              expiresAt: session.expiresAt,
            },
          });

          return createdUser;
        });

        return {
          user: toPublicUser(user),
          token: session.token,
          expiresAt: session.expiresAt,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AuthError(
            "AUTH_EMAIL_ALREADY_EXISTS",
            "이미 가입된 이메일 주소입니다.",
            409,
          );
        }

        throw error;
      }
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

      const passwordMatches = await verifyPassword(
        user.passwordHash,
        input.password,
      );

      if (!passwordMatches) {
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
            lastLoginAt: new Date(),
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
