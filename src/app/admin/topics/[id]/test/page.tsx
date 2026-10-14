import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { questionFromRow } from "@/lib/quiz";
import { QuizEditor } from "./QuizEditor";

export const metadata: Metadata = { title: "Тест" };

export default async function TopicTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      quiz: {
        include: {
          questions: { orderBy: { order: "asc" } },
          _count: { select: { attempts: true } },
        },
      },
    },
  });
  if (!topic) notFound();

  const quiz = topic.quiz;
  const pending = quiz
    ? await prisma.quizAttempt.count({ where: { quizId: quiz.id, status: "SUBMITTED" } })
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/admin/topics/${topic.id}`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← {topic.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Тест</h1>
          {quiz ? (
            <Link
              href={`/admin/topics/${topic.id}/test/results`}
              className="text-sm text-brand underline-offset-4 hover:underline"
            >
              Результаты{pending > 0 ? ` · ждут подтверждения: ${pending}` : ""}
            </Link>
          ) : null}
        </div>
      </header>

      <QuizEditor
        topicId={topic.id}
        initialQuestions={quiz ? quiz.questions.map(questionFromRow) : []}
        initialSettings={{
          isOpen: quiz?.isOpen ?? false,
          maxAttempts: quiz?.maxAttempts ?? 1,
          timeLimitMin: quiz?.timeLimitMin ?? null,
          showScore: quiz?.showScore ?? true,
        }}
        hasAttempts={(quiz?._count.attempts ?? 0) > 0}
      />
    </div>
  );
}
