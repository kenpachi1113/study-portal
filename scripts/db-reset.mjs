import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Полное пересоздание локальной базы: удаляет .pgdata целиком.
 *
 * Нужно, если кластер был создан в неправильной кодировке — поменять её
 * у существующего кластера нельзя, только пересоздать.
 *
 * Данные теряются все: студенты, темы, оценки. Локальная база для того
 * и локальная, но спросить всё равно надо.
 */

const DATA_DIR = resolve(process.cwd(), ".pgdata");

if (!existsSync(DATA_DIR)) {
  console.log("\n  .pgdata нет — сбрасывать нечего. Запустите npm run db:up\n");
  process.exit(0);
}

const forced = process.argv.includes("--yes");

if (!forced) {
  console.log(`
  Это удалит локальную базу целиком: студентов, темы, оценки.
  Восстановить будет нечем.

  После сброса:  npm run db:up  →  npm run db:migrate  →  npm run db:seed
`);

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question("  Введите  да  для подтверждения: ");
  rl.close();

  if (answer.trim().toLowerCase() !== "да") {
    console.log("\n  Отменено, ничего не тронул.\n");
    process.exit(0);
  }
}

try {
  rmSync(DATA_DIR, { recursive: true, force: true });
} catch (error) {
  console.error(`
  Не удалось удалить .pgdata: ${error instanceof Error ? error.message : error}

  Скорее всего база ещё запущена — остановите окно с npm run db:up (Ctrl+C)
  и повторите.
`);
  process.exit(1);
}

console.log(`
  База удалена.

  Дальше:  npm run db:up  →  npm run db:migrate  →  npm run db:seed
`);
