import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 не читает .env сам. Next берёт .env.local, поэтому грузим оба:
// первый найденный выигрывает.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  // Только для миграций и introspection. Прямой хост, без «-pooler»:
  // через pgBouncer миграции не проходят.
  // Приложение сюда не смотрит — оно ходит через адаптер в src/lib/prisma.ts.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
