"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type CourseSettingsState = { error?: string; ok?: string };

export async function updateCourseAction(
  _prev: CourseSettingsState,
  formData: FormData,
): Promise<CourseSettingsState> {
  const teacher = await requireTeacher();

  const id = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const maxGrade = Number(formData.get("maxGrade") ?? 5);
  const gradeRule = String(formData.get("gradeRule") ?? "LAST");

  if (!title) return { error: "Название не может быть пустым" };
  if (![5, 12, 100].includes(maxGrade))
    return { error: "Шкала может быть 5, 12 или 100" };
  if (gradeRule !== "LAST" && gradeRule !== "BEST")
    return { error: "Непонятное правило итоговой оценки" };

  const before = await prisma.course.findUnique({
    where: { id },
    select: { title: true, maxGrade: true, gradeRule: true },
  });
  if (!before) return { error: "Дисциплина не найдена" };

  await prisma.course.update({
    where: { id },
    data: {
      title,
      description: description || null,
      maxGrade,
      gradeRule,
    },
  });

  await audit({
    actorId: teacher.id,
    action: "course.update",
    entity: "Course",
    entityId: id,
    before,
    after: { title, maxGrade, gradeRule },
  });

  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/courses/${id}`);
  return { ok: "Сохранено" };
}

export type DeleteCourseState = { error?: string };

export async function deleteCourseAction(
  _prev: DeleteCourseState,
  formData: FormData,
): Promise<DeleteCourseState> {
  const teacher = await requireTeacher();

  const id = String(formData.get("courseId") ?? "");

  const course = await prisma.course.findUnique({
    where: { id },
    select: { title: true, _count: { select: { topics: true } } },
  });
  if (!course) return { error: "Дисциплина не найдена" };

  // Удалить дисциплину с темами — значит унести вместе с ней оценки и
  // посещаемость. Пусть сначала уберут темы: так случайно не снесёшь семестр.
  if (course._count.topics > 0)
    return {
      error: `Сначала удалите темы (${course._count.topics}) — вместе с ними ушли бы оценки и посещаемость`,
    };

  await prisma.course.delete({ where: { id } });

  await audit({
    actorId: teacher.id,
    action: "course.delete",
    entity: "Course",
    entityId: id,
    before: { title: course.title },
  });

  revalidatePath("/admin/lessons");
  redirect("/admin/lessons");
}
