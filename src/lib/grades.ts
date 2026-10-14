import "server-only";
import { prisma } from "@/lib/prisma";
import { parseDayStart, toDateInput } from "@/lib/format";

/**
 * Колонка журнала для темы у подгруппы.
 *
 * Обычно она уже есть — появляется, когда тему открывают подгруппе. Если её
 * нет (тему открыли до того, как журнал научился заводить колонки сам), она
 * создаётся сегодняшним числом: оценке нужно куда-то лечь.
 */
export async function sessionForTopic(topicId: string, subgroupId: string) {
  const existing = await prisma.classSession.findFirst({
    where: { topicId, subgroupId },
    orderBy: { heldOn: "desc" },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.classSession.create({
    data: {
      topicId,
      subgroupId,
      heldOn: parseDayStart(toDateInput(new Date()))!,
    },
    select: { id: true },
  });
}

/**
 * Выставить оценку за занятие по тем же правилам, что и ручной ввод в журнал:
 * оценки не перезаписываются, повтор — следующая попытка (пересдача),
 * оценка означает, что студент был.
 *
 * Если последняя оценка уже такая же и ни к чему не привязана, новая запись
 * не заводится: это та же оценка, просто поставленная раньше вручную.
 */
export async function recordGrade(input: {
  sessionId: string;
  studentId: string;
  value: number;
  teacherId: string;
  comment?: string;
}): Promise<{ id: string; attempt: number }> {
  const last = await prisma.grade.findFirst({
    where: { sessionId: input.sessionId, studentId: input.studentId },
    orderBy: { attempt: "desc" },
    select: {
      id: true,
      attempt: true,
      value: true,
      quizAttempt: { select: { id: true } },
      submissionId: true,
    },
  });

  if (last && last.value === input.value && !last.quizAttempt && !last.submissionId)
    return { id: last.id, attempt: last.attempt };

  const attempt = (last?.attempt ?? 0) + 1;

  const grade = await prisma.grade.create({
    data: {
      sessionId: input.sessionId,
      studentId: input.studentId,
      value: input.value,
      attempt,
      isRetake: attempt > 1,
      comment: input.comment,
      gradedById: input.teacherId,
    },
    select: { id: true, attempt: true },
  });

  await prisma.attendance.upsert({
    where: {
      sessionId_studentId: { sessionId: input.sessionId, studentId: input.studentId },
    },
    create: { sessionId: input.sessionId, studentId: input.studentId, status: "PRESENT" },
    update: attempt > 1 ? { madeUp: true } : {},
  });

  return grade;
}
