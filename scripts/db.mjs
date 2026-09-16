import { existsSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

/**
 * Временная локальная база: Postgres берётся из node_modules, данные лежат
 * в папке проекта (.pgdata). Ничего не устанавливается в систему, прав
 * администратора не нужно, удаляется вместе с папкой.
 *
 * Сервер запускается дочерним процессом и живёт, пока живёт этот скрипт, —
 * как `next dev`. То есть база занимает одно окно терминала, разработка идёт
 * во втором.
 */

const DATA_DIR = resolve(process.cwd(), ".pgdata");
const DB_NAME = "study";

const options = {
  databaseDir: DATA_DIR,
  user: "study",
  password: "study",
  port: 5433,
  persistent: true,
  /**
   * Кодировку задаём явно.
   *
   * На Windows initdb берёт её из системной локали и на русской системе
   * создаёт кластер в WIN1251. Тогда любой символ вне этой кодировки —
   * стрелка →, длинное тире, эмодзи — не сохраняется вообще: база отвечает
   * «character has no equivalent in encoding WIN1251». Для текстов лекций
   * это смертельно.
   */
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
};

const pgServer = new EmbeddedPostgres(options);
const firstRun = !existsSync(DATA_DIR);

if (firstRun) {
  console.log("  Первый запуск: создаю кластер в .pgdata …");
  await pgServer.initialise();
}

await pgServer.start();

if (firstRun) {
  await pgServer.createDatabase(DB_NAME);
  console.log(`  База ${DB_NAME} создана.`);
}

/** Кластер мог быть создан раньше, ещё без явной кодировки. */
async function checkEncoding() {
  const client = new pg.Client({
    connectionString: `postgresql://${options.user}:${options.password}@localhost:${options.port}/${DB_NAME}`,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      "select pg_encoding_to_char(encoding) as enc from pg_database where datname = $1",
      [DB_NAME],
    );
    return rows[0]?.enc ?? null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

const encoding = await checkEncoding();

if (encoding && encoding !== "UTF8") {
  console.log(`
  ВНИМАНИЕ: база создана в кодировке ${encoding}, а не UTF8.

  В такой базе не сохранятся стрелки, длинные тире и эмодзи — при
  сохранении темы вы получите ошибку «no equivalent in encoding».

  Лечится пересозданием базы (данные будут потеряны):

      Ctrl+C, затем
      npm run db:reset
      npm run db:up
`);
}

console.log(`
  Postgres слушает localhost:${options.port}
  Кодировка: ${encoding ?? "неизвестна"}
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
    await pgServer.stop();
  } catch {
    // уже упал — не о чем горевать
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// держим процесс живым
setInterval(() => {}, 1 << 30);
