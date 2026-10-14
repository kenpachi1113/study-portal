import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher, shortName } from "@/lib/auth";
import { compareNames, toDateInput } from "@/lib/format";
import {
  ATTENDANCE_MARK,
  ATTENDANCE_TITLE,
  averageGrade,
  finalGrade,
  isFailing,
} from "@/lib/journal";
import { Card } from "@/components/ui";
import {
  JournalGrid,
  type GridCell,
  type GridSession,
  type GridStudent,
} from "./JournalGrid";
import { AddSessionForm, SessionRow } from "./SessionTools";

export const metadata: Metadata = { title: "Журнал" };

const dayShort = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
});

export default async function JournalPage({
  params,
}: {
  params: Promise<{ subgroupId: string }>;
}) {
  await requireTeacher();
  const { subgroupId } = await params;

  const subgroup = await prisma.subgroup.findUnique({
    where: { id: subgroupId },
    include: {
      group: true,
      students: { where: { isActive: true } },
    },
  });
  if (!subgroup) notFound();

  subgroup.students.sort(compareNames);

  const sessions = await prisma.classSession.findMany({
    where: { subgroupId },
    orderBy: [{ heldOn: "asc" }],
    include: {
      topic: { include: { course: true } },
      grades: true,
      attendance: true,
    },
  });

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });

  // ── сборка сетки ────────────────────────────────────────────────────
  const cells: Record<string, GridCell> = {};
  const finalsByStudent = new Map<string, (number | null)[]>();
  const absencesByStudent = new Map<string, number>();

  for (const session of sessions) {
    const rule = session.topic.course.gradeRule;
    const maxGrade = session.topic.course.maxGrade;

    for (const student of subgroup.students) {
      const attempts = session.grades
        .filter((g) => g.studentId === student.id)
        .map((g) => ({ value: g.value, attempt: g.attempt, gradedAt: g.gradedAt }));

      const mark = session.attendance.find((a) => a.studentId === student.id);
      const final = finalGrade(attempts, rule);

      const finals = finalsByStudent.get(student.id) ?? [];
      finals.push(final);
      finalsByStudent.set(student.id, finals);

      if (mark?.status === "ABSENT" && !mark.madeUp) {
        absencesByStudent.set(
          student.id,
          (absencesByStudent.get(student.id) ?? 0) + 1,
        );
      }

      let cell: GridCell;

      if (final !== null) {
        const history = attempts
          .sort((a, b) => a.attempt - b.attempt)
          .map((a) => `${a.value} (${dayShort.format(a.gradedAt)})`)
          .join(" → ");

        cell = {
          value: String(final),
          hint:
            attempts.length > 1
              ? `Попытки: ${history}`
              : `${session.topic.title} · ${dayShort.format(session.heldOn)}`,
          tone:
            attempts.length > 1
              ? "retake"
              : isFailing(final, maxGrade)
                ? "fail"
                : "plain",
        };
      } else if (mark && mark.status !== "PRESENT") {
        cell = {
          value: ATTENDANCE_MARK[mark.status],
          hint: `${ATTENDANCE_TITLE[mark.status]}${mark.madeUp ? ", отработано" : ""}`,
          tone: mark.status === "ABSENT" ? "absent" : "plain",
        };
      } else {
        cell = {
          value: mark ? ATTENDANCE_MARK.PRESENT : "",
          hint: session.topic.title,
          tone: "plain",
        };
      }

      cells[`${session.id}:${student.id}`] = cell;
    }
  }

  const gridSessions: GridSession[] = sessions.map((s) => ({
    id: s.id,
    dateLabel: dayShort.format(s.heldOn),
    topicTitle: s.topic.title,
    isPractice: s.topic.type !== "LECTURE",
  }));

  const gridStudents: GridStudent[] = subgroup.students.map((student) => {
    const average = averageGrade(finalsByStudent.get(student.id) ?? []);
    return {
      id: student.id,
      name: shortName(student),
      average: average === null ? "—" : average.toFixed(1),
      absences: absencesByStudent.get(student.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/journal"
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← все подгруппы
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Журнал · {subgroup.group.title}, подгруппа {subgroup.title}
        </h1>
        <p className="text-sm text-muted">
          {subgroup.students.length} студентов · {sessions.length} занятий
        </p>
      </header>

      <Card>
        <JournalGrid
          sessions={gridSessions}
          students={gridStudents}
          cells={cells}
        />
      </Card>

      <Card
        title="Занятия"
        description="Колонка появляется сама, когда тема открывается подгруппе"
      >
        <div className="flex flex-col gap-5">
          {sessions.length > 0 ? (
            <ul className="flex flex-col">
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={{
                    id: s.id,
                    dateInput: toDateInput(s.heldOn),
                    dateLabel: dayShort.format(s.heldOn),
                    topicTitle: s.topic.title,
                    isPractice: s.topic.type !== "LECTURE",
                    marks: s.grades.length + s.attendance.length,
                  }}
                />
              ))}
            </ul>
          ) : null}

          <AddSessionForm
            subgroupId={subgroup.id}
            today={toDateInput(new Date())}
            topics={topics.map((t) => ({
              id: t.id,
              label:
                t.type === "PRACTICE"
                  ? `${t.title} · практическая`
                  : t.type === "TEST"
                    ? `${t.title} · тест`
                    : t.title,
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
