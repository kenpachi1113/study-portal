/**
 * Доступ к переменным окружения.
 *
 * Специально без падения на импорте: `next build` должен проходить и без
 * подключённой базы. Всё, что обязательно, проверяется в момент реального
 * использования — через requireEnv().
 */

export const ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

export function requireEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Переменная окружения ${key} не задана. Заполните .env.local (локально) или Environment Variables в Vercel.`,
    );
  }
  return value;
}

export function hasEnv(key: EnvKey): boolean {
  return Boolean(process.env[key]);
}

/** Что уже настроено, а что нет — для стартовой страницы состояния. */
export function envReport(): { key: EnvKey; set: boolean }[] {
  return ENV_KEYS.map((key) => ({ key, set: hasEnv(key) }));
}
