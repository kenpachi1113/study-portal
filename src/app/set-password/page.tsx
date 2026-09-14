import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Новый пароль" };

export default async function SetPasswordPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs tracking-widest text-brand uppercase">
          Первый вход
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Придумайте пароль
        </h1>
        <p className="text-sm text-muted">
          Код, по которому вы вошли, после этого перестанет работать.
        </p>
      </header>

      <div className="rounded border border-line bg-surface p-5">
        <SetPasswordForm />
      </div>
    </main>
  );
}
