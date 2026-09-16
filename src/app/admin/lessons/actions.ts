"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/course";
import { audit } from "@/lib/audit";

export type AddTopicState = { error?: string };

/**
 * Добавление темы: название и тип, больше ничего.
 *
 * Куда её положить, система решает сама — предмет один (см. lib/course.ts),
 * и спрашивать об этом на каждой теме незачем.
 */
export async function addTopicAction(
  _prev: AddTopicState,
  formData: FormData,
): Promise<AddTopicState> {
  const teacher = await requireTeacher();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "LECTURE");

  if (!title) return { error: "Укажите название темы" };
  if (type !== "LECTURE" && type !== "PRACTICE")
    return { error: "Тип темы — лекция или практическая" };

  const course = await getPrimaryCourse();

  const last = await prisma.topic.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const topic = await prisma.topic.create({
    data: {
      courseId: course.id,
      title,
      type,
      order: (last?.order ?? 0) + 1,
    },
  });

  await audit({
    actorId: teacher.id,
    action: "topic.create",
    entity: "Topic",
    entityId: topic.id,
    after: { courseId: course.id, title, type },
  });

  revalidatePath("/admin/lessons");
  redirect(`/admin/topics/${topic.id}`);
}

export type DeleteTopicState = { error?: string };

/**
 * Удаление темы. Вместе с ней уходят материалы, выдачи доступа и занятия —
 * а с занятиями ушли бы оценки и посещаемость, поэтому тема с проставленными
 * отметками не удаляется. Сначала очистить колонку в журнале.
 */
export async function deleteTopicAction(
  _prev: DeleteTopicState,
  formData: FormData,
): Promise<DeleteTopicState> {
  const teacher = await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, title: true, courseId: true },
  });
  if (!topic) return { error: "Тема не найдена" };

  const [grades, attendance, submissions] = await Promise.all([
    prisma.grade.count({ where: { session: { topicId } } }),
    prisma.attendance.count({ where: { session: { topicId } } }),
    prisma.submission.count({ where: { topicId } }),
  ]);

  const marks = grades + attendance;
  if (marks > 0)
    return {
      error: `По теме уже есть отметки в журнале (${marks}) — сначала очистите колонку`,
    };

  if (submissions > 0)
    return {
      error: `По теме есть сданные работы (${submissions}) — удаление унесло бы их`,
    };

  await prisma.topic.delete({ where: { id: topicId } });

  await audit({
    actorId: teacher.id,
    action: "topic.delete",
    entity: "Topic",
    entityId: topicId,
    before: { title: topic.title, courseId: topic.courseId },
  });

  revalidatePath("/admin/lessons");
  return {};
}

export type MoveTopicState = { error?: string };

/** Перестановка темы вверх/вниз внутри дисциплины. */
export async function moveTopicAction(
  _prev: MoveTopicState,
  formData: FormData,
): Promise<MoveTopicState> {
  await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, courseId: true, order: true },
  });
  if (!topic) return { error: "Тема не найдена" };

  // список тем один на всё, поэтому и соседа ищем по всему списку
  const neighbour = await prisma.topic.findFirst({
    where: {
      order: direction === "up" ? { lt: topic.order } : { gt: topic.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return {};

  await prisma.$transaction([
    prisma.topic.update({
      where: { id: topic.id },
      data: { order: neighbour.order },
    }),
    prisma.topic.update({
      where: { id: neighbour.id },
      data: { order: topic.order },
    }),
  ]);

  revalidatePath("/admin/lessons");
  return {};
}
