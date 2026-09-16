import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Дисциплины в интерфейсе нет.
 *
 * В базе Course остался: на нём висят шкала оценок и правило пересдачи,
 * и к нему привязаны темы. Но преподаватель ведёт один предмет, поэтому
 * выбирать дисциплину при каждой теме — лишний шаг. Всё уходит в один
 * курс, который создаётся сам при первой теме.
 *
 * Если когда-нибудь предметов станет два, сюда вернётся выбор, а данные
 * переделывать не придётся.
 */
export async function getPrimaryCourse() {
  const existing = await prisma.course.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.course.create({
    data: { title: "Основной курс" },
  });
}

/** Настройки оценок без создания курса — для страниц, которые только читают. */
export async function findPrimaryCourse() {
  return prisma.course.findFirst({ orderBy: { createdAt: "asc" } });
}
