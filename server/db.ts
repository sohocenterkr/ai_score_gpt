import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";

let prisma: PrismaClient | undefined;

export function getDatabase(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }

  prisma ??= new PrismaClient();
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = undefined;
}
