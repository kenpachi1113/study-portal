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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          {/* не ссылка: вести на ту же страницу, что и «Сводка», незачем */}
          <span className="font-mono text-xs tracking-widest text-brand uppercase">
            Портал · преподаватель
          </span>

          <AdminNav />

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{shortName(user)}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-muted underline-offset-4 hover:text-ink hover:underline">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl grow px-6 py-8">{children}</main>
    </div>
  );
}
