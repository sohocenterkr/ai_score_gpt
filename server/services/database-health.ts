import { env } from "../config/env";

interface PrismaConnection {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
  $disconnect(): Promise<void>;
}

let prisma: PrismaConnection | undefined;

export type DatabaseHealth =
  | { status: "not_configured"; message: string }
  | { status: "connected" }
  | { status: "error"; message: string };

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (!env.DATABASE_URL) {
    return {
      status: "not_configured",
      message: "DATABASE_URL이 아직 설정되지 않았습니다.",
    };
  }

  try {
    if (!prisma) {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
    }
    await prisma.$queryRawUnsafe("SELECT 1");
    return { status: "connected" };
  } catch {
    return {
      status: "error",
      message: "데이터베이스 연결을 확인할 수 없습니다.",
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
