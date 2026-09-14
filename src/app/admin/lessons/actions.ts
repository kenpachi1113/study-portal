"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type AddTopicState = { error?: string };

/**
 * Добавление темы прямо из списка занятий.
 *
 * Дисциплина выбирается из списка, а если её ещё нет — вписывается тут же.
 * Отдельного экрана «создайте курс, укажите шкалу оценок» больше нет: шкала
 * и правило пересдачи имеют разумные умолчания и правятся в настройках
 * дисциплины, куда можно не заходить никогда.
 */
export async function addTopicAction(
  _prev: AddTopicState,
  formData: FormData,
): Promise<AddTopicState> {
  const teacher = await requireTeacher();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "LECTURE");
  const courseId = String(formData.get("courseId") ?? "").trim();
  const newCourseTitle = String(formData.get("newCourseTitle") ?? "").trim();

  if (!title) return { error: "Укажите название темы" };
  if (type !== "LECTURE" && type !== "PRACTICE")
    return { error: "Тип темы — лекция или практическая" };

  let targetCourseId = courseId;

  if (newCourseTitle) {
    const created = await prisma.course.create({
      data: { title: newCourseTitle },
    });
    targetCourseId = created.id;
    await audit({
      actorId: teacher.id,
      action: "course.create",
      entity: "Course",
      entityId: created.id,
      after: { title: newCourseTitle },
    });
  }

  if (!targetCourseId) {
    // ни выбранной дисциплины, ни новой — заводим первую по умолчанию
    const first = await prisma.course.findFirst({ orderBy: { createdAt: "asc" } });
    if (first) {
      targetCourseId = first.id;
    } else {
      const created = await prisma.course.create({
        data: { title: "Информатика" },
      });
      targetCourseId = created.id;
    }
  }

  const last = await prisma.topic.findFirst({
    where: { courseId: targetCourseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const topic = await prisma.topic.create({
    data: {
      courseId: targetCourseId,
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
    after: { courseId: targetCourseId, title, type },
  });

  revalidatePath("/admin/lessons");
  redirect(`/admin/topics/${topic.id}`);
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

  const neighbour = await prisma.topic.findFirst({
    where: {
      courseId: topic.courseId,
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
