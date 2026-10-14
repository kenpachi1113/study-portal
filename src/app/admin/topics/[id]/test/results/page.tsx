import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireTeacher, shortName } from "@/lib/auth";
import { compareNames } from "@/lib/format";
import {
  formatScore,
  scoreQuestion,
  suggestGrade,
  type AnswerValue,
  type Answers,
  type Question,
} from "@/lib/quiz";
import { Card, Empty, cn } from "@/components/ui";
import { SubgroupResults, type ResultRow } from "./SubgroupResults";

export const metadata: Metadata = { title: "Результаты теста" };

const timeFormat = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      course: true,
      quiz: true,
      releases: { include: { subgroup: { include: { group: true } } } },
    },
  });
  if (!topic) notFound();
  const quiz = topic.quiz;

  const attempts = quiz
    ? await prisma.quizAttempt.findMany({
        where: { quizId: quiz.id },
        orderBy: { number: "asc" },
        include: {
          student: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              middleName: true,
              subgroupId: true,
              isActive: true,
            },
          },
          grade: { select: { value: true } },
        },
      })
    : [];

  // подгруппы: кому открыта тема, плюс те, откуда есть попытки
  const subgroupIds = new Set<string>(topic.releases.map((r) => r.subgroupId));
  for (const a of attempts) if (a.student.subgroupId) subgroupIds.add(a.student.subgroupId);

  const subgroups = await prisma.subgroup.findMany({
    where: { id: { in: [...subgroupIds] } },
    include: { group: true, students: { where: { isActive: true } } },
    orderBy: [{ group: { title: "asc" } }, { title: "asc" }],
  });

  const maxGrade = topic.course.maxGrade;
  const rule = topic.course.gradeRule;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/admin/topics/${topic.id}/test`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← тест · {topic.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Результаты теста</h1>
        <p className="text-sm text-muted">
          Оценка предлагается по доле баллов
          {maxGrade === 5 ? " (90% — 5, 75% — 4, 60% — 3)" : ""} — её можно поправить перед
          отправкой. В журнал попадает только то, что вы подтвердили. Аннулированная попытка
          возвращает студенту право пройти тест ещё раз.
        </p>
      </header>

      {!quiz ? <Empty>К этой теме тест ещё не добавлен.</Empty> : null}

      {quiz && subgroups.length === 0 ? (
        <Empty>Тема ещё не открыта ни одной подгруппе.</Empty>
      ) : null}

      {quiz
        ? subgroups.map((sub) => {
            const students = [...sub.students];
            // студент мог уйти из подгруппы — его попытки всё равно показываем
            for (const a of attempts)
              if (a.student.subgroupId === sub.id && !students.some((s) => s.id === a.student.id))
                students.push(a.student as (typeof students)[number]);
            students.sort(compareNames);

            const rows: ResultRow[] = students.map((s) => {
              const mine = attempts.filter((a) => a.studentId === s.id);
              const confirmed = mine.some((a) => a.status === "CONFIRMED" && a.grade);
              const submitted = mine.filter((a) => a.status === "SUBMITTED");
              const pick =
                rule === "BEST"
                  ? [...submitted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
                  : submitted.at(-1);

              return {
                studentId: s.id,
                name: shortName(s),
                bulkAttemptId: !confirmed && pick ? pick.id : null,
                attempts: mine.map((a) => {
                  const questions = a.snapshot as unknown as Question[];
                  const limitMs = quiz.timeLimitMin ? quiz.timeLimitMin * 60_000 : null;
                  const tookMs = a.submittedAt ? a.submittedAt.getTime() - a.startedAt.getTime() : null;
                  return {
                    id: a.id,
                    number: a.number,
                    status: a.status,
                    score: a.score,
                    maxScore: a.maxScore,
                    percent:
                      a.score !== null && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null,
                    suggested:
                      a.score !== null && a.maxScore !== null
                        ? suggestGrade(a.score, a.maxScore, maxGrade)
                        : null,
                    grade: a.grade?.value ?? null,
                    when: timeFormat.format(a.submittedAt ?? a.startedAt),
                    took: tookMs !== null ? Math.max(1, Math.round(tookMs / 60_000)) : null,
                    late: limitMs !== null && tookMs !== null && tookMs > limitMs + 120_000,
                    details: a.answers ? (
                      <AttemptDetails questions={questions} answers={a.answers as Answers} />
                    ) : null,
                  };
                }),
              };
            });

            const done = rows.filter((r) => r.attempts.some((a) => a.status !== "IN_PROGRESS" && a.status !== "ANNULLED")).length;

            return (
              <Card
                key={sub.id}
                title={`${sub.group.title} · подгруппа ${sub.title}`}
                description={`Прошли ${done} из ${rows.length}`}
              >
                <SubgroupResults
                  topicId={topic.id}
                  maxGrade={maxGrade}
                  rows={rows}
                  journalHref={`/admin/journal/${sub.id}`}
                />
              </Card>
            );
          })
        : null}
    </div>
  );
}

function describeAnswer(q: Question, v: AnswerValue | undefined): ReactNode {
  if (v === undefined) return <span className="text-muted">без ответа</span>;
  if (q.type === "SINGLE") return q.options.find((o) => o.id === v)?.text ?? "—";
  if (q.type === "MULTIPLE")
    return Array.isArray(v) && v.length
      ? q.options.filter((o) => v.includes(o.id)).map((o) => o.text).join("; ")
      : "—";
  if (q.type === "TEXT") return typeof v === "string" && v.trim() ? `«${v}»` : "—";
  const map = (v ?? {}) as Record<string, string>;
  return (
    <span className="flex flex-col">
      {q.pairs.map((p) => {
        const chosen = q.pairs.find((x) => x.id === map[p.id]);
        return (
          <span key={p.id} className={cn(map[p.id] === p.id ? "text-ok" : "text-warn")}>
            {p.left} → {chosen?.right ?? "—"}
          </span>
        );
      })}
    </span>
  );
}

function describeCorrect(q: Question): string {
  if (q.type === "SINGLE" || q.type === "MULTIPLE")
    return q.options.filter((o) => o.correct).map((o) => o.text).join("; ");
  if (q.type === "TEXT") return q.answers.join(" / ");
  return q.pairs.map((p) => `${p.left} → ${p.right}`).join("; ");
}

function AttemptDetails({ questions, answers }: { questions: Question[]; answers: Answers }) {
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {questions.map((q, i) => {
        const r = scoreQuestion(q, answers[q.id]);
        return (
          <li key={q.id} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-b-0">
            <div className="flex gap-2">
              <span className="font-mono text-muted">{i + 1}.</span>
              <span className="grow whitespace-pre-line">{q.text}</span>
              <span
                className={cn(
                  "shrink-0 font-mono tabular-nums",
                  r.verdict === "correct" ? "text-ok" : r.verdict === "partial" ? "text-ink" : "text-warn",
                )}
              >
                {formatScore(r.earned)}/{r.points}
              </span>
            </div>
            <div className="pl-6 text-muted">
              Ответ: <span className="text-ink">{describeAnswer(q, answers[q.id])}</span>
            </div>
            {r.verdict !== "correct" && q.type !== "MATCHING" ? (
              <div className="pl-6 text-muted">Верно: {describeCorrect(q)}</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
