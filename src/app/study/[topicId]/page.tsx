import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  NotFoundError,
  UnauthorizedError,
  getTopicForCurrentUser,
} from "@/lib/access";
import { TOPIC_TYPE_LABEL, formatBytes } from "@/lib/format";
import { Alert, Card, Empty } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { getQuizForStudent } from "@/lib/quiz-access";
import { formatScore } from "@/lib/quiz";
import { StartQuizButton } from "./QuizCard";

export default async function StudyTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { topicId } = await params;
  const { sent } = await searchParams;
  const student = await requireStudent();

  // Тема, закрытая для этой подгруппы, отдаёт «не найдено», а не «нет доступа»:
  // иначе перебором id можно узнать, какие темы вообще существуют.
  let topic;
  try {
    topic = await getTopicForCurrentUser(topicId);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const quizInfo = await getQuizForStudent(topic.id, student.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/study"
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← все занятия
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {topic.title}
        </h1>
        <p className="text-sm text-muted">{TOPIC_TYPE_LABEL[topic.type]}</p>
      </header>

      {topic.bodyHtml ? (
        <article
          // без flex: содержание — обычный поток, а не колонка;
          // авторская вёрстка иначе получает лишние отступы между блоками
          className="prose-topic rounded border border-line bg-surface px-5 py-4 leading-relaxed"
          // Содержание пишет только преподаватель — единственный автор в системе.
          // Студенты в это поле не пишут никогда. Если это когда-нибудь изменится,
          // здесь нужна санитизация, иначе получится XSS через лекцию.
          dangerouslySetInnerHTML={{ __html: topic.bodyHtml }}
        />
      ) : null}

      {topic.type === "PRACTICE" ? (
        <Card title="Задание">
          {topic.taskHtml ? (
            <div
              className="prose-topic leading-relaxed"
              dangerouslySetInnerHTML={{ __html: topic.taskHtml }}
            />
          ) : (
            <Empty>Преподаватель ещё не описал задание.</Empty>
          )}
        </Card>
      ) : null}

      {topic.type === "TEST" && topic.materials.length === 0 ? null : (
      <Card title="Материалы">
        {topic.materials.length === 0 ? (
          <Empty>К этой теме файлов нет.</Empty>
        ) : (
          <ul className="flex flex-col">
            {topic.materials.map((material) => (
              <li
                key={material.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-b-0"
              >
                <a
                  href={`/api/materials/${material.id}`}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {material.fileName}
                </a>
                <span className="font-mono text-xs text-muted tabular-nums">
                  {formatBytes(material.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      )}

      {quizInfo ? (
        <QuizSection info={quizInfo} sent={sent === "1"} />
      ) : topic.type === "TEST" ? (
        <Empty>Тест пока закрыт — преподаватель откроет его к занятию.</Empty>
      ) : null}

      {topic.type === "PRACTICE" ? (
        <p className="text-sm text-muted">
          Сдача работ появится следующим шагом — пока сдавайте как обычно.
        </p>
      ) : null}
    </div>
  );
}

const STATUS_LABEL = {
  IN_PROGRESS: "не отправлена",
  SUBMITTED: "ждёт подтверждения преподавателя",
  CONFIRMED: "оценка в журнале",
  ANNULLED: "аннулирована",
} as const;

function QuizSection({
  info,
  sent,
}: {
  info: NonNullable<Awaited<ReturnType<typeof getQuizForStudent>>>;
  sent: boolean;
}) {
  const { quiz, topic, inProgress, left, questionCount, totalPoints } = info;
  const finished = quiz.attempts.filter((a) => a.status !== "IN_PROGRESS");

  return (
    <Card
      title="Тест"
      description={[
        `${questionCount} вопр. · ${totalPoints} балл.`,
        quiz.timeLimitMin ? `${quiz.timeLimitMin} мин.` : "без ограничения по времени",
        `попыток: ${quiz.maxAttempts}`,
      ].join(" · ")}
    >
      <div className="flex flex-col gap-4">
        {sent ? <Alert tone="ok">Тест отправлен. Оценку выставит преподаватель.</Alert> : null}

        {finished.length > 0 ? (
          <ul className="flex flex-col">
            {finished.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0 text-sm"
              >
                <span className="font-medium">Попытка {a.number}</span>
                {quiz.showScore && a.score !== null && a.maxScore !== null && a.status !== "ANNULLED" ? (
                  <span className="font-mono tabular-nums">
                    {formatScore(a.score)} из {formatScore(a.maxScore)}
                  </span>
                ) : null}
                <span className="text-muted">{STATUS_LABEL[a.status]}</span>
                {a.grade ? (
                  <span className="ml-auto rounded bg-ok-soft px-2 py-0.5 text-ok">
                    оценка {a.grade.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {inProgress ? (
          <StartQuizButton topicId={topic.id} label="Продолжить тест" />
        ) : left > 0 ? (
          <div className="flex flex-col gap-2">
            {quiz.timeLimitMin ? (
              <p className="text-sm text-muted">
                После начала пойдёт время — {quiz.timeLimitMin} мин. Когда оно выйдет, тест
                отправится сам.
              </p>
            ) : null}
            <StartQuizButton
              topicId={topic.id}
              label={finished.length > 0 ? "Пройти ещё раз" : "Начать тест"}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Попытки закончились.</p>
        )}
      </div>
    </Card>
  );
}
