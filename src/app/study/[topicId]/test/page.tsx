import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { NotFoundError, UnauthorizedError, getTopicForCurrentUser } from "@/lib/access";
import { attemptDeadline } from "@/lib/quiz-access";
import { toPublic, type Question } from "@/lib/quiz";
import { QuizForm } from "./QuizForm";

export const metadata: Metadata = { title: "Тест" };

export default async function StudyTestPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const student = await requireStudent();
  const { topicId } = await params;

  let topic;
  try {
    topic = await getTopicForCurrentUser(topicId);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const attempt = await prisma.quizAttempt.findFirst({
    where: { studentId: student.id, status: "IN_PROGRESS", quiz: { topicId: topic.id } },
    include: { quiz: { select: { timeLimitMin: true } } },
  });
  if (!attempt) redirect(`/study/${topic.id}`);

  const questions = attempt.snapshot as unknown as Question[];
  const deadline = attemptDeadline(attempt.startedAt, attempt.quiz.timeLimitMin);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/study/${topic.id}`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← {topic.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Тест · попытка {attempt.number}</h1>
        <p className="text-sm text-muted">
          {questions.length} вопр. Ответы сохраняются в этом браузере, пока вы не отправите
          тест, — случайно закрытая вкладка ничего не потеряет.
        </p>
      </header>

      <QuizForm
        attemptId={attempt.id}
        questions={toPublic(questions, attempt.id)}
        deadline={deadline ? deadline.toISOString() : null}
      />
    </div>
  );
}
