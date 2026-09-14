import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Создаёт .env.local с нуля: строки подключения, случайный секрет сессий
 * и учётку преподавателя для сида.
 *
 * Существующий файл не трогает никогда — секрет в нём уже подписал все
 * выданные сессии, и перезапись разлогинила бы всех разом.
 *
 * Параметры (все необязательные):
 *   npm run setup:env -- --port 5432 --user postgres --password секрет --db study
 */

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const target = resolve(process.cwd(), ".env.local");

if (existsSync(target)) {
  console.log("\n  .env.local уже есть — оставляю как есть.");
  console.log("  Если нужно пересоздать, удалите файл и запустите снова.\n");
  process.exit(0);
}

const host = arg("host", "localhost");
const port = arg("port", "5433");
const user = arg("user", "study");
const password = arg("password", "study");
const db = arg("db", "study");

const url = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
const secret = randomBytes(32).toString("base64");
const teacherLogin = arg("teacher", "teacher");
const teacherPassword = randomBytes(9).toString("base64url");

const content = `# Создан скриптом npm run setup:env. В git не попадает.
#
#   npm run db:migrate   создать таблицы
#   npm run db:seed      завести аккаунт преподавателя
#   npm run dev

# Локально пулера нет, поэтому обе строки одинаковые. На боевой базе они
# разойдутся: DATABASE_URL — хост с «-pooler», DIRECT_URL — без него.
DATABASE_URL="${url}"
DIRECT_URL="${url}"

# Сгенерирован случайно для этой машины. Для боевого деплоя сделайте новый.
AUTH_SECRET="${secret}"

# Понадобятся под загрузку материалов. Пока пусто — всё остальное работает.
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="study-materials"

# Аккаунт преподавателя, который создаст npm run db:seed.
# Фамилию и имя можно дописать — тогда они подставятся вместо умолчаний.
TEACHER_LOGIN="${teacherLogin}"
TEACHER_PASSWORD="${teacherPassword}"
# TEACHER_LAST_NAME=""
# TEACHER_FIRST_NAME=""
`;

writeFileSync(target, content, "utf8");

console.log(`
  .env.local создан.

  База:   ${host}:${port}, пользователь ${user}, база ${db}
  Секрет: сгенерирован

  Аккаунт преподавателя (создастся на npm run db:seed):

      логин:  ${teacherLogin}
      пароль: ${teacherPassword}

  Он же лежит в .env.local, так что не потеряется.

  Дальше:  npm run db:migrate  →  npm run db:seed  →  npm run dev
`);
