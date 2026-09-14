import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { Card, Empty } from "@/components/ui";
import { AddSubgroupForm, CreateGroupForm } from "./GroupForms";

export const metadata: Metadata = { title: "Группы" };

function currentAcademicYear(now = new Date()): string {
  // учебный год начинается в сентябре
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

export default async function GroupsPage() {
  await requireTeacher();

  const groups = await prisma.group.findMany({
    where: { archived: false },
    orderBy: [{ academicYear: "desc" }, { title: "asc" }],
    include: {
      subgroups: {
        orderBy: { title: "asc" },
        include: {
          _count: { select: { students: true } },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Группы</h1>
        <p className="text-sm text-muted">
          Подгруппа — это то, на что выдаётся доступ к темам. Студент всегда
          принадлежит ровно одной.
        </p>
      </header>

      <Card title="Новая группа">
        <CreateGroupForm defaultYear={currentAcademicYear()} />
      </Card>

      {groups.length === 0 ? (
        <Empty>Пока ни одной группы. Создайте первую формой выше.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <Card
              key={group.id}
              title={group.title}
              description={`Учебный год ${group.academicYear}`}
            >
              <div className="flex flex-col gap-4">
                {group.subgroups.length === 0 ? (
                  <Empty>У группы нет подгрупп.</Empty>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {group.subgroups.map((sub) => (
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
                    ))}
                  </ul>
                )}

                <AddSubgroupForm groupId={group.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
