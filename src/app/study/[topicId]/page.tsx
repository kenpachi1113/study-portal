import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  NotFoundError,
  UnauthorizedError,
  getTopicForCurrentUser,
} from "@/lib/access";
import { TOPIC_TYPE_LABEL, formatBytes } from "@/lib/format";
import { Card, Empty } from "@/components/ui";

export default async function StudyTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;

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

      {topic.type === "PRACTICE" ? (
        <p className="text-sm text-muted">
          Сдача работ появится следующим шагом — пока сдавайте как обычно.
        </p>
      ) : null}
    </div>
  );
}
