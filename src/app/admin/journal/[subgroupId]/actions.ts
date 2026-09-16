"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseDayStart } from "@/lib/format";
import { parseCell } from "@/lib/journal";

export type CellResult =
  | { ok: true; kind: "empty" | "grade" | "attendance"; attempt?: number }
  | { ok: false; error: string };

/**
 * Одна ячейка журнала: и оценка, и отметка посещаемости.
 *
 * Оценка никогда не перезаписывается — повторный ввод по тому же занятию
 * заводит следующую попытку. Так пересдача остаётся видимой, а не стирает
 * историю: «тройка была, потом четвёрка» отличается от «всегда была четвёрка».
 */
export async function setCellAction(input: {
  sessionId: string;
  studentId: string;
  raw: string;
}): Promise<CellResult> {
  const teacher = await requireTeacher();

  const session = await prisma.classSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      subgroupId: true,
      topic: { select: { course: { select: { maxGrade: true } } } },
    },
  });
  if (!session) return { ok: false, error: "Занятие не найдено" };

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, subgroupId: session.subgroupId },
    select: { id: true },
  });
  if (!student) return { ok: false, error: "Студент не из этой подгруппы" };

  const maxGrade = session.topic.course.maxGrade;
  const parsed = parseCell(input.raw, maxGrade);

  if (parsed.kind === "invalid")
    return {
      ok: false,
      error: `Оценка от 1 до ${maxGrade}, либо н — не был, о — опоздал, у — по уважительной`,
    };

  if (parsed.kind === "empty") {
    // чистим и оценки, и отметку: пустая ячейка значит «ничего не было»
    await prisma.grade.deleteMany({
      where: { sessionId: session.id, studentId: student.id },
    });
    await prisma.attendance.deleteMany({
      where: { sessionId: session.id, studentId: student.id },
    });
    await audit({
      actorId: teacher.id,
      action: "journal.clear",
      entity: "ClassSession",
      entityId: session.id,
      before: { studentId: student.id },
    });
    revalidatePath(`/admin/journal/${session.subgroupId}`);
    return { ok: true, kind: "empty" };
  }

  if (parsed.kind === "attendance") {
    await prisma.attendance.upsert({
      where: {
        sessionId_studentId: { sessionId: session.id, studentId: student.id },
      },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: parsed.status,
      },
      update: { status: parsed.status },
    });
    await audit({
      actorId: teacher.id,
      action: "attendance.set",
      entity: "ClassSession",
      entityId: session.id,
      after: { studentId: student.id, status: parsed.status },
    });
    revalidatePath(`/admin/journal/${session.subgroupId}`);
    return { ok: true, kind: "attendance" };
  }

  const last = await prisma.grade.findFirst({
    where: { sessionId: session.id, studentId: student.id },
    orderBy: { attempt: "desc" },
    select: { attempt: true, value: true },
  });

  // та же оценка второй раз — это опечатка, а не пересдача
  if (last && last.value === parsed.value)
    return { ok: true, kind: "grade", attempt: last.attempt };

  const attempt = (last?.attempt ?? 0) + 1;

  await prisma.grade.create({
    data: {
      sessionId: session.id,
      studentId: student.id,
      value: parsed.value,
      attempt,
      isRetake: attempt > 1,
      gradedById: teacher.id,
    },
  });

  // оценка за занятие значит, что студент был
  await prisma.attendance.upsert({
    where: {
      sessionId_studentId: { sessionId: session.id, studentId: student.id },
    },
    create: {
      sessionId: session.id,
      studentId: student.id,
      status: "PRESENT",
    },
    update: attempt > 1 ? { madeUp: true } : {},
  });

  await audit({
    actorId: teacher.id,
    action: attempt > 1 ? "grade.retake" : "grade.set",
    entity: "ClassSession",
    entityId: session.id,
    before: last ?? undefined,
    after: { studentId: student.id, value: parsed.value, attempt },
  });

  revalidatePath(`/admin/journal/${session.subgroupId}`);
  return { ok: true, kind: "grade", attempt };
}

export type SessionState = { error?: string };

export async function addSessionAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const teacher = await requireTeacher();

  const subgroupId = String(formData.get("subgroupId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const heldOnRaw = String(formData.get("heldOn") ?? "");

  const heldOn = parseDayStart(heldOnRaw);
  if (!heldOn) return { error: "Укажите дату" };
  if (!topicId) return { error: "Выберите тему" };

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true },
  });
  if (!topic) return { error: "Тема не найдена" };

  const session = await prisma.classSession.create({
    data: { topicId, subgroupId, heldOn },
  });

  await audit({
    actorId: teacher.id,
    action: "session.create",
    entity: "ClassSession",
    entityId: session.id,
    after: { topicId, subgroupId, heldOn },
  });

  revalidatePath(`/admin/journal/${subgroupId}`);
  return {};
}

export async function moveSessionAction(input: {
  sessionId: string;
  heldOn: string;
}): Promise<{ ok: boolean; error?: string }> {
  const teacher = await requireTeacher();

  const heldOn = parseDayStart(input.heldOn);
  if (!heldOn) return { ok: false, error: "Непонятная дата" };

  const session = await prisma.classSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, subgroupId: true, heldOn: true },
  });
  if (!session) return { ok: false, error: "Занятие не найдено" };

  await prisma.classSession.update({
    where: { id: session.id },
    data: { heldOn },
  });

  await audit({
    actorId: teacher.id,
    action: "session.move",
    entity: "ClassSession",
    entityId: session.id,
    before: { heldOn: session.heldOn },
    after: { heldOn },
  });

  revalidatePath(`/admin/journal/${session.subgroupId}`);
  return { ok: true };
}

export async function deleteSessionAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const teacher = await requireTeacher();

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      subgroupId: true,
      _count: { select: { grades: true, attendance: true } },
    },
  });
  if (!session) return { error: "Занятие не найдено" };

  // Удаление занятия унесло бы оценки и отметки за эту пару.
  if (session._count.grades > 0 || session._count.attendance > 0)
    return {
      error: "По занятию уже есть отметки — сначала очистите колонку",
    };

  await prisma.classSession.delete({ where: { id: session.id } });

  await audit({
    actorId: teacher.id,
    action: "session.delete",
    entity: "ClassSession",
    entityId: session.id,
  });

  revalidatePath(`/admin/journal/${session.subgroupId}`);
  return {};
}
