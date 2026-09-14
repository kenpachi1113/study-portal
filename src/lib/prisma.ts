import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Один экземпляр клиента на процесс.
 *
 * Зачем синглтон: в dev каждый hot-reload создаёт новый PrismaClient, старые
 * не закрываются — за час разработки можно самому исчерпать лимит соединений
 * Neon без всякой нагрузки.
 *
 * Зачем max: 1: на Vercel каждый инстанс функции — отдельный процесс со своим
 * пулом. Реальный пул держит pgBouncer на стороне Neon (хост с -pooler),
 * функции достаточно одного соединения.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
