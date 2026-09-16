import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { Card, Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Журнал" };

export default async function JournalIndexPage() {
  await requireTeacher();

  const subgroups = await prisma.subgroup.findMany({
    where: { group: { archived: false } },
    orderBy: [{ group: { title: "asc" } }, { title: "asc" }],
    include: {
      group: true,
      _count: { select: { students: true, sessions: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Журнал</h1>
        <p className="text-sm text-muted">
          У каждой подгруппы свой журнал: одна тема идёт у разных подгрупп
          в разные даты.
        </p>
      </header>

      <Card>
        {subgroups.length === 0 ? (
          <Empty>
            Сначала{" "}
            <Link
              href="/admin/groups"
              className="text-brand underline underline-offset-4"
            >
              заведите группы
            </Link>
            .
          </Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {subgroups.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/admin/journal/${sub.id}`}
                  className="flex items-center justify-between gap-3 rounded border border-line px-4 py-3 transition hover:border-brand"
                >
                  <span className="font-medium">
                    {sub.group.title} · подгруппа {sub.title}
                  </span>
                  <span className="font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                    {sub._count.students} чел. · {sub._count.sessions} зан.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
