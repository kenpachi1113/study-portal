import { existsSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

/**
 * Временная локальная база: Postgres берётся из node_modules, данные лежат
 * в папке проекта (.pgdata). Ничего не устанавливается в систему, прав
 * администратора не нужно, удаляется вместе с папкой.
 *
 * Сервер запускается дочерним процессом и живёт, пока живёт этот скрипт, —
 * как `next dev`. То есть база занимает одно окно терминала, разработка идёт
 * во втором.
 *
 * Когда дойдёт до переезда на облачную базу: данные отсюда снимаются обычным
 * pg_dump, схема переносится миграциями Prisma — они уже лежат в
 * prisma/migrations.
 */

const DATA_DIR = resolve(process.cwd(), ".pgdata");

const options = {
  databaseDir: DATA_DIR,
  user: "study",
  password: "study",
  port: 5433,
  persistent: true,
};

const pg = new EmbeddedPostgres(options);
const firstRun = !existsSync(DATA_DIR);

if (firstRun) {
  console.log("  Первый запуск: создаю кластер в .pgdata …");
  await pg.initialise();
}

await pg.start();

if (firstRun) {
  await pg.createDatabase("study");
  console.log("  База study создана.");
}

console.log(`
  Postgres слушает localhost:${options.port}
  Данные:  .pgdata (в папке проекта, в git не попадает)

  Это окно закрывать нельзя — база живёт, пока работает скрипт.
  Во втором окне:  npm run db:migrate  →  npm run db:seed  →  npm run dev

  Остановить: Ctrl+C
`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\n  Останавливаю базу…");
  try {
    await pg.stop();
  } catch {
    // уже упал — не о чем горевать
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// держим процесс живым
setInterval(() => {}, 1 << 30);
