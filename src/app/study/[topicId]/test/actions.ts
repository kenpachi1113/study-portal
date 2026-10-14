"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { NotFoundError } from "@/lib/access";
import { getQuizForStudent, loadQuizQuestions } from "@/lib/quiz-access";
import { sanitizeAnswers, scoreAttempt, type Question } from "@/lib/quiz";

export type StartState = { error?: string };

export async function startQuizAction(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  const student = await requireStudent();
  const topicId = String(formData.get("topicId") ?? "");

  let info;
  try {
    info = await getQuizForStudent(topicId, student.id);
  } catch (e) {
    if (e instanceof NotFoundError) return { error: "Тема недоступна" };
    throw e;
  }
  if (!info) return { error: "Тест закрыт" };

  if (!info.inProgress) {
    if (info.left <= 0) return { error: "Попытки закончились" };

    const questions = await loadQuizQuestions(info.quiz.id);
    const number = (info.quiz.attempts.at(-1)?.number ?? 0) + 1;

    try {
      await prisma.quizAttempt.create({
        data: {
          quizId: info.quiz.id,
          studentId: student.id,
          number,
          snapshot: questions,
        },
      });
    } catch {
      // двойное нажатие: попытка с этим номером уже создана — просто идём в неё
    }
  }

  redirect(`/study/${topicId}/test`);
}

export type SubmitState = { error?: string };

export async function submitQuizAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const student = await requireStudent();
  const attemptId = String(formData.get("attemptId") ?? "");

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, studentId: student.id },
    include: { quiz: { select: { topicId: true } } },
  });
  if (!attempt) return { error: "Попытка не найдена" };

  // Уже отправлено (вторая вкладка, повторное нажатие) — не ошибка, просто к результату.
  if (attempt.status !== "IN_PROGRESS") redirect(`/study/${attempt.quiz.topicId}`);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { error: "Не удалось прочитать ответы — попробуйте ещё раз" };
  }

  const questions = attempt.snapshot as unknown as Question[];
  const answers = sanitizeAnswers(raw, questions);
  const { score, maxScore } = scoreAttempt(questions, answers);

  // updateMany с условием на статус: две одновременные отправки не перезапишут друг друга
  await prisma.quizAttempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      answers,
      score,
      maxScore,
      submittedAt: new Date(),
    },
  });

  revalidatePath(`/admin/topics/${attempt.quiz.topicId}/test/results`);
  redirect(`/study/${attempt.quiz.topicId}?sent=1`);
}
