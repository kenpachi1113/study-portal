import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fullName, requireTeacher } from "@/lib/auth";
import { LOGIN_CODE_TTL_DAYS } from "@/lib/password";
import { Card, Empty } from "@/components/ui";
import { ImportPanel } from "./ImportPanel";
import { StudentRow, type StudentRowData } from "./StudentRow";

export const metadata: Metadata = { title: "Подгруппа" };

const dateFormat = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export default async function SubgroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const subgroup = await prisma.subgroup.findUnique({
    where: { id },
    include: {
      group: true,
      students: {
        orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      },
    },
  });

  if (!subgroup) notFound();

  const students: StudentRowData[] = subgroup.students.map((s) => ({
    id: s.id,
    fullName: fullName(s),
    login: s.login,
    isActive: s.isActive,
    hasPassword: Boolean(s.passwordHash),
    lastLoginAt: s.lastLoginAt ? dateFormat.format(s.lastLoginAt) : null,
  }));

  const active = students.filter((s) => s.isActive).length;
  const neverLoggedIn = students.filter(
    (s) => s.isActive && !s.hasPassword,
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/groups"
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink print:hidden"
        >
          ← все группы
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {subgroup.group.title} · подгруппа {subgroup.title}
        </h1>
        <p className="text-sm text-muted">
          {active} активных
          {neverLoggedIn > 0 ? ` · ${neverLoggedIn} ещё не входили` : ""}
        </p>
      </header>

      <Card
        title="Завести студентов"
        description="Вставьте список ФИО — логины и коды сгенерируются сами"
      >
        <ImportPanel subgroupId={subgroup.id} codeTtlDays={LOGIN_CODE_TTL_DAYS} />
      </Card>

      <Card title="Студенты">
        {students.length === 0 ? (
          <Empty>В подгруппе пока никого.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[11px] tracking-widest text-muted uppercase">
                  <th className="px-4 py-2 font-medium">Студент</th>
                  <th className="px-4 py-2 font-medium">Логин</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                  <th className="px-4 py-2 font-medium">Был</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <StudentRow key={student.id} student={student} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
