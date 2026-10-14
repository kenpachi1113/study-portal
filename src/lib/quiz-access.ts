import "server-only";
import { prisma } from "@/lib/prisma";
import { getTopicForCurrentUser } from "@/lib/access";
import { questionFromRow, type Question } from "@/lib/quiz";

/**
 * Тест темы для текущего студента. Видимость — та же, что у темы:
 * сначала проверка через access.ts, потом уже сам тест. Скрытый или пустой
 * тест для студента не существует.
 */
export async function getQuizForStudent(topicId: string, studentId: string) {
  const topic = await getTopicForCurrentUser(topicId);

  const quiz = await prisma.quiz.findFirst({
    where: { topicId: topic.id, isOpen: true, questions: { some: {} } },
    include: {
      _count: { select: { questions: true } },
      questions: { select: { points: true } },
      attempts: {
        where: { studentId },
        orderBy: { number: "asc" },
        include: { grade: { select: { value: true } } },
      },
    },
  });
  if (!quiz) return null;

  const used = quiz.attempts.filter((a) => a.status !== "ANNULLED").length;
  const inProgress = quiz.attempts.find((a) => a.status === "IN_PROGRESS") ?? null;

  return {
    topic,
    quiz,
    questionCount: quiz._count.questions,
    totalPoints: quiz.questions.reduce((s, q) => s + q.points, 0),
    used,
    left: Math.max(0, quiz.maxAttempts - used),
    inProgress,
  };
}

export async function loadQuizQuestions(quizId: string): Promise<Question[]> {
  const rows = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
  });
  return rows.map(questionFromRow);
}

export function attemptDeadline(startedAt: Date, timeLimitMin: number | null): Date | null {
  return timeLimitMin ? new Date(startedAt.getTime() + timeLimitMin * 60_000) : null;
}
