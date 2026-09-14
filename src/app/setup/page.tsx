import { envReport } from "@/lib/env";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Пока в системе нет ни одного пользователя, страница открыта — иначе
 * первичную настройку не пройти, войти-то ещё некем. Как только появился
 * первый аккаунт, она закрывается на преподавателя: детали окружения и
 * тексты ошибок базы посторонним видеть незачем.
 */
async function guard(): Promise<void> {
  let userCount = 0;
  try {
    const { prisma } = await import("@/lib/prisma");
    userCount = await prisma.user.count();
  } catch {
    return; // базы ещё нет — настройка только начинается
  }
  if (userCount > 0) await requireTeacher();
}

type Check = { label: string; ok: boolean; detail: string };

async function checkDatabase(): Promise<Check> {
  if (!process.env.DATABASE_URL) {
    return {
      label: "База данных",
      ok: false,
      detail: "DATABASE_URL не задан",
    };
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`select 1`;

    const url = process.env.DATABASE_URL;
    const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
    const pooled = url.includes("-pooler");

    return {
      label: "База данных",
      ok: true,
      detail: isLocal
        ? "подключение есть, база локальная"
        : pooled
          ? "подключение есть, строка pooled — верно"
          : "подключение есть, но строка НЕ pooled — на Vercel нужен хост с «-pooler»",
    };
  } catch (e) {
    return {
      label: "База данных",
      ok: false,
      detail: e instanceof Error ? e.message.split("\n")[0] : "нет соединения",
    };
  }
}

async function checkStorage(): Promise<Check> {
  const keys = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ];
  const missing = keys.filter((k) => !process.env[k]);
  return {
    label: "Хранилище файлов",
    ok: missing.length === 0,
    detail: missing.length
      ? `не задано: ${missing.join(", ")}`
      : "ключи R2 на месте",
  };
}

function checkSecret(): Check {
  const secret = process.env.AUTH_SECRET;
  return {
    label: "Секрет сессий",
    ok: Boolean(secret && secret.length >= 32),
    detail: secret
      ? secret.length >= 32
        ? "задан"
        : "короче 32 символов"
      : "AUTH_SECRET не задан — openssl rand -base64 32",
  };
}

export default async function SetupPage() {
  await guard();

  const checks: Check[] = [
    await checkDatabase(),
    await checkStorage(),
    checkSecret(),
  ];
  const env = envReport();
  const ready = checks.every((c) => c.ok);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-widest text-brand uppercase">
          Фаза 0 · каркас
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Учебный портал медколледжа
        </h1>
        <p className="text-muted">
          {ready
            ? "Окружение настроено. Можно переходить к фазе 1: люди и вход."
            : "Каркас развёрнут. Ниже — что осталось подключить."}
        </p>
      </header>

      <section className="overflow-hidden rounded border border-line bg-surface">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start gap-3 border-b border-line px-5 py-4 last:border-b-0"
          >
            <span
              aria-hidden
              className={`mt-2 size-2 shrink-0 rounded-full ${
                check.ok ? "bg-ok" : "bg-warn"
              }`}
            />
            <div className="flex flex-col">
              <span className="font-medium">{check.label}</span>
              <span className="text-sm text-muted">{check.detail}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Переменные окружения
        </h2>
        <ul className="flex flex-wrap gap-2">
          {env.map(({ key, set }) => (
            <li
              key={key}
              className={`rounded border px-2.5 py-1 font-mono text-xs ${
                set
                  ? "border-transparent bg-ok-soft text-ok"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {key}
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-sm text-muted">
        Эта страница временная — её заменит вход, как только появится фаза 1.
      </footer>
    </main>
  );
}
