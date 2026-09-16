"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/course";
import { audit } from "@/lib/audit";

export type GradingState = { error?: string; ok?: string };

/**
 * Настройки оценивания. Дисциплины в интерфейсе нет, поэтому правится
 * единственный курс — тот, к которому привязаны все темы.
 */
export async function updateGradingAction(
  _prev: GradingState,
  formData: FormData,
): Promise<GradingState> {
  const teacher = await requireTeacher();

  const maxGrade = Number(formData.get("maxGrade") ?? 5);
  const gradeRule = String(formData.get("gradeRule") ?? "LAST");

  if (![5, 12, 100].includes(maxGrade))
    return { error: "Шкала может быть 5, 12 или 100" };
  if (gradeRule !== "LAST" && gradeRule !== "BEST")
    return { error: "Непонятное правило итоговой оценки" };

  const course = await getPrimaryCourse();

  await prisma.course.update({
    where: { id: course.id },
    data: { maxGrade, gradeRule },
  });

  await audit({
    actorId: teacher.id,
    action: "grading.update",
    entity: "Course",
    entityId: course.id,
    before: { maxGrade: course.maxGrade, gradeRule: course.gradeRule },
    after: { maxGrade, gradeRule },
  });

  revalidatePath("/admin/grading");
  revalidatePath("/admin/lessons");
  return { ok: "Сохранено" };
}
