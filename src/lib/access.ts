import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/**
 * Единственное место, где решается, что студенту видно.
 *
 * Правило: тема существует для студента только если есть TopicRelease на его
 * подгруппу и наступила дата открытия. Никакой фильтрации на клиенте —
 * Server Actions и route handlers это публичные HTTP-эндпоинты, и то, что
 * кнопка не отрисована, не защищает ничего.
 *
 * Закрытая тема отдаёт «не найдено», а не «нет доступа»: иначе перебором id
 * можно узнать, какие темы вообще существуют.
 */

export class NotFoundError extends Error {
  constructor(message = "Не найдено") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Нужно войти") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function currentUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Условие «тема открыта этой подгруппе прямо сейчас». */
function releasedTo(subgroupId: string, now = new Date()) {
  return {
    some: {
      subgroupId,
      opensAt: { lte: now },
      OR: [{ closesAt: null }, { closesAt: { gte: now } }],
    },
  };
}

/** Тема, если текущий пользователь имеет на неё право. Иначе NotFoundError. */
export async function getTopicForCurrentUser(topicId: string) {
  const user = await currentUserOrThrow();

  if (user.role === "TEACHER" || user.role === "OBSERVER") {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { materials: true, course: true },
    });
    if (!topic) throw new NotFoundError();
    return topic;
  }

  if (!user.subgroupId) throw new NotFoundError();

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, releases: releasedTo(user.subgroupId) },
    include: { materials: true, course: true },
  });
  if (!topic) throw new NotFoundError();
  return topic;
}

/** Список тем, открытых текущему студенту. */
export async function listTopicsForCurrentStudent() {
  const user = await currentUserOrThrow();
  if (!user.subgroupId) return [];

  return prisma.topic.findMany({
    where: { releases: releasedTo(user.subgroupId) },
    orderBy: [{ courseId: "asc" }, { order: "asc" }],
    include: {
      course: { select: { id: true, title: true } },
      releases: {
        where: { subgroupId: user.subgroupId },
        select: { opensAt: true, closesAt: true },
      },
      submissions: {
        where: { studentId: user.id },
        orderBy: { attempt: "desc" },
        take: 1,
      },
    },
  });
}

/**
 * Материал вместе с проверкой прав. Вызывается ПЕРЕД подписью ссылки:
 * подписанная ссылка живёт сама по себе, вне сессии, — кто её получил,
 * тот и скачал.
 */
export async function getMaterialForCurrentUser(materialId: string) {
  const user = await currentUserOrThrow();

  if (user.role === "TEACHER" || user.role === "OBSERVER") {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });
    if (!material) throw new NotFoundError();
    return material;
  }

  if (!user.subgroupId) throw new NotFoundError();

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      topic: { releases: releasedTo(user.subgroupId) },
    },
  });
  if (!material) throw new NotFoundError();
  return material;
}

/** Может ли студент сдавать эту практическую прямо сейчас. */
export async function canSubmit(topicId: string): Promise<boolean> {
  const user = await currentUserOrThrow();
  if (user.role !== "STUDENT" || !user.subgroupId) return false;

  const topic = await prisma.topic.findFirst({
    where: {
      id: topicId,
      type: "PRACTICE",
      releases: releasedTo(user.subgroupId),
    },
    select: { id: true },
  });
  if (!topic) return false;

  const last = await prisma.submission.findFirst({
    where: { topicId, studentId: user.id },
    orderBy: { attempt: "desc" },
    select: { status: true },
  });

  // нет сдачи — можно; вернули на доработку — можно; принято или на проверке — нет
  return !last || last.status === "RETURNED";
}
