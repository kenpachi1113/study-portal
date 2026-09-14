import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs tracking-widest text-brand uppercase">
          Учебный портал
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
      </header>

      <div className="rounded border border-line bg-surface p-5">
        <LoginForm next={next ?? ""} />
      </div>

      <p className="text-xs text-muted">
        Забыли пароль — подойдите к преподавателю, он выдаст новый код.
        Восстановления по почте здесь нет: почта в системе не хранится.
      </p>
    </main>
  );
}
