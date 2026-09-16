import Link from "next/link";
import { requireTeacher, shortName } from "@/lib/auth";
import { signOutAction } from "@/app/auth-actions";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTeacher();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          {/* не ссылка: вести на ту же страницу, что и «Сводка», незачем */}
          <span className="font-mono text-xs tracking-widest text-brand uppercase">
            Портал · преподаватель
          </span>

          <AdminNav />

          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link
              href="/set-password"
              title="Сменить пароль"
              className="text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {shortName(user)}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="text-muted underline-offset-4 hover:text-ink hover:underline">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl grow px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
