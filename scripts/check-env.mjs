import { config as loadEnv } from "dotenv";

/**
 * Проверка окружения перед командами, которым нужна база.
 * Без неё Prisma и node-postgres падают с EACCES и «datasource.url is required» —
 * технически верно, но по этим словам не догадаться, что просто не заполнен
 * .env.local.
 */
loadEnv({ path: [".env.local", ".env"], quiet: true });

const DIRECT = {
  key: "DIRECT_URL",
  why: "строка подключения к базе — по ней идут миграции",
};
const SECRET = {
  key: "AUTH_SECRET",
  why: "секрет для подписи сессий, минимум 32 символа",
};

const MODES = {
  db: [DIRECT],
  seed: [DIRECT, SECRET],
};

const mode = process.argv[2] ?? "db";
const required = MODES[mode] ?? MODES.db;

const missing = required.filter(({ key }) => !process.env[key]);

const shortSecret =
  mode === "seed" &&
  process.env.AUTH_SECRET &&
  process.env.AUTH_SECRET.length < 32;

if (missing.length === 0 && !shortSecret) process.exit(0);

console.error("\n  Не хватает настроек окружения.\n");

for (const { key, why } of missing) {
  console.error(`  ✗ ${key} — ${why}`);
}
if (shortSecret) {
  console.error("  ✗ AUTH_SECRET — короче 32 символов");
}

console.error(`
  Файла .env.local нет или он неполный. Создать его одной командой:

      npm run setup:env

  По умолчанию он пропишет базу на localhost:5433. Если Postgres у вас
  на другом порту или с другим паролем — передайте их:

      npm run setup:env -- --port 5432 --user postgres --password ваш_пароль

  Ключи R2 нужны только под загрузку файлов — без них работает всё остальное.
`);

process.exit(1);
