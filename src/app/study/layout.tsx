import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudent, shortName } from "@/lib/auth";
import { signOutAction } from "@/app/auth-actions";

export default async function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await requireStudent();

  const subgroup = await prisma.subgroup.findUnique({
    where: { id: student.subgroupId! },
    include: { group: true },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3">
          <Link
            href="/study"
            className="font-mono text-xs tracking-widest text-brand uppercase"
          >
            Мои занятия
          </Link>
          {subgroup ? (
            <span className="text-xs text-muted">
              {subgroup.group.title} · подгруппа {subgroup.title}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{shortName(student)}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl grow px-6 py-8">{children}</main>
    </div>
  );
}
