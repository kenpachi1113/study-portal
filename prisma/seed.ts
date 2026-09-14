import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Создаёт аккаунт преподавателя. Запускать один раз после первой миграции:
 *
 *   npm run db:seed
 *
 * Логин и пароль можно задать переменными TEACHER_LOGIN / TEACHER_PASSWORD,
 * иначе пароль сгенерируется и будет напечатан здесь один раз.
 */
loadEnv({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "\n  Нет строки подключения к базе: заполните DIRECT_URL в .env.local.\n" +
      "  Подробнее — npm run db:migrate, он объяснит по шагам.\n",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Дисциплины по умолчанию — чтобы при первом входе не встречать пустой экран. */
const DISCIPLINES = [
  {
    title: "Информатика",
    description: "ОД.08 · Сестринское дело 34.02.01",
  },
  {
    title: "Информационные технологии в профессиональной деятельности",
    description: "ОП.08 · Лечебное дело 31.02.01",
  },
];

async function seedTeacher() {
  const login = (process.env.TEACHER_LOGIN ?? "teacher").toLowerCase();

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`  Преподаватель «${login}» уже есть — не трогаю.`);
    return;
  }

  const password =
    process.env.TEACHER_PASSWORD ?? randomBytes(9).toString("base64url");

  await prisma.user.create({
    data: {
      login,
      lastName: process.env.TEACHER_LAST_NAME ?? "Преподаватель",
      firstName: process.env.TEACHER_FIRST_NAME ?? "Курса",
      role: "TEACHER",
      passwordHash: await bcrypt.hash(password, 10),
      mustSetPassword: false,
    },
  });

  console.log("\n  Аккаунт преподавателя создан");
  console.log(`  логин:  ${login}`);
  console.log(`  пароль: ${password}`);
  console.log("  Сохраните пароль — второй раз он показан не будет.\n");
}

/**
 * Дисциплины заводятся здесь, чтобы при первом входе не встречал экран
 * «создайте курс». Идемпотентно: существующие не трогаются, названия можно
 * спокойно править в настройках — повторный сид их не вернёт обратно.
 */
async function seedDisciplines() {
  const count = await prisma.course.count();
  if (count > 0) {
    console.log(`  Дисциплины уже заведены (${count}) — не трогаю.`);
    return;
  }

  for (const discipline of DISCIPLINES) {
    await prisma.course.create({ data: discipline });
  }

  console.log(`  Заведено дисциплин: ${DISCIPLINES.length}`);
}

async function main() {
  await seedTeacher();
  await seedDisciplines();
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
