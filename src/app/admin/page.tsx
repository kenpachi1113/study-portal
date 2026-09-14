import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { Card, Empty } from "@/components/ui";

export default async function AdminHome() {
  const teacher = await requireTeacher();

  const [groups, studentCount, notLoggedIn] = await Promise.all([
    prisma.group.findMany({
      where: { archived: false },
      orderBy: [{ academicYear: "desc" }, { title: "asc" }],
      include: {
        subgroups: {
          orderBy: { title: "asc" },
          include: { _count: { select: { students: true } } },
        },
      },
    }),
    prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
    prisma.user.count({
      where: { role: "STUDENT", isActive: true, passwordHash: null },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Здравствуйте, {teacher.firstName}
        </h1>
        <p className="text-sm text-muted">
          Фаза 1: люди и вход. Лекции и журнал появятся следующими.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Студентов" value={studentCount} />
        <Stat label="Ещё не входили" value={notLoggedIn} tone={notLoggedIn > 0 ? "warn" : "ok"} />
        <Stat label="Подгрупп" value={groups.reduce((n, g) => n + g.subgroups.length, 0)} />
      </div>

      <Card
        title="Подгруппы"
        actions={
          <Link href="/admin/groups" className="text-sm text-brand underline-offset-4 hover:underline">
            Управление
          </Link>
        }
      >
        {groups.length === 0 ? (
          <Empty>
            Ещё нет ни одной группы.{" "}
            <Link href="/admin/groups" className="text-brand underline underline-offset-4">
              Создать первую
            </Link>
          </Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {groups.flatMap((group) =>
              group.subgroups.map((sub) => (
                <li key={sub.id}>
                  <Link
                    href={`/admin/subgroups/${sub.id}`}
                    className="flex items-center justify-between rounded border border-line px-4 py-3 transition hover:border-brand"
                  >
                    <span className="font-medium">
                      {group.title} · подгруппа {sub.title}
                    </span>
                    <span className="font-mono text-xs text-muted tabular-nums">
                      {sub._count.students} чел.
                    </span>
                  </Link>
                </li>
              )),
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: "plain" | "ok" | "warn";
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-line bg-surface px-5 py-4">
      <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
        {label}
      </span>
      <span
        className={`text-2xl font-semibold tabular-nums ${
          tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
