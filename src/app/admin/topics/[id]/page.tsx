import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { formatBytes, toDateInput } from "@/lib/format";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { Card, Empty } from "@/components/ui";
import { TopicForm } from "./TopicForm";
import { MaterialUploader } from "./MaterialUploader";
import { MaterialRow } from "./MaterialRow";
import { ReleaseRow, type SubgroupRelease } from "./ReleasePanel";

export const metadata: Metadata = { title: "Тема" };

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const [topic, subgroups] = await Promise.all([
    prisma.topic.findUnique({
      where: { id },
      include: {
        course: true,
        materials: { orderBy: { uploadedAt: "asc" } },
        releases: true,
        quiz: {
          select: {
            isOpen: true,
            _count: { select: { questions: true } },
          },
        },
      },
    }),
    prisma.subgroup.findMany({
      where: { group: { archived: false } },
      orderBy: [{ group: { title: "asc" } }, { title: "asc" }],
      include: { group: true },
    }),
  ]);

  if (!topic) notFound();

  const releaseBySubgroup = new Map(
    topic.releases.map((r) => [r.subgroupId, r]),
  );

  const rows: SubgroupRelease[] = subgroups.map((sub) => {
    const release = releaseBySubgroup.get(sub.id);
    return {
      subgroupId: sub.id,
      label: `${sub.group.title} · подгруппа ${sub.title}`,
      opensAt: release ? toDateInput(release.opensAt) : null,
      closesAt: release?.closesAt ? toDateInput(release.closesAt) : null,
      isOpen: Boolean(release),
    };
  });

  const today = toDateInput(new Date());
  const isTest = topic.type === "TEST";

  const quizPending = topic.quiz
    ? await prisma.quizAttempt.count({
        where: { quiz: { topicId: topic.id }, status: "SUBMITTED" },
      })
    : 0;
  const quizQuestions = topic.quiz?._count.questions ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/lessons"
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← занятия
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {topic.title}
        </h1>
      </header>

      <Card title="Тема">
        <TopicForm
          topic={{
            id: topic.id,
            title: topic.title,
            type: topic.type,
            bodyHtml: topic.bodyHtml,
            taskHtml: topic.taskHtml,
            maxScore: topic.maxScore,
          }}
        />
      </Card>

      {!isTest && (topic.bodyHtml || topic.taskHtml) ? (
        <Card
          title="Предпросмотр"
          description="Так это увидит студент. Обновляется после сохранения"
        >
          <div className="flex flex-col gap-5">
            {topic.bodyHtml ? (
              <article
                className="prose-topic leading-relaxed"
                // Автор содержания — преподаватель, он же смотрит этот
                // предпросмотр. Санитизации нет намеренно, см. README.
                dangerouslySetInnerHTML={{ __html: topic.bodyHtml }}
              />
            ) : null}

            {topic.taskHtml ? (
              <div className="flex flex-col gap-2 border-t border-line pt-5">
                <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
                  Задание
                </span>
                <div
                  className="prose-topic leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: topic.taskHtml }}
                />
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!isTest ? (
      <Card
        title="Материалы"
        description="Файлы уходят в хранилище напрямую из браузера, мимо сервера"
      >
        <div className="flex flex-col gap-4">
          {topic.materials.length === 0 ? (
            <Empty>Файлов пока нет.</Empty>
          ) : (
            <ul className="flex flex-col">
              {topic.materials.map((material) => (
                <MaterialRow
                  key={material.id}
                  material={{
                    id: material.id,
                    fileName: material.fileName,
                    size: formatBytes(material.sizeBytes),
                  }}
                />
              ))}
            </ul>
          )}

          <MaterialUploader topicId={topic.id} maxBytes={MAX_UPLOAD_BYTES} />
        </div>
      </Card>
      ) : null}

      {isTest || topic.quiz ? (
      <Card
        title="Вопросы теста"
        description="Проверяется автоматически, в журнал попадает после вашего подтверждения"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {quizQuestions > 0 ? (
            <>
              <span className="text-sm">
                {quizQuestions} вопр. ·{" "}
                <span className={topic.quiz?.isOpen ? "text-ok" : "text-muted"}>
                  {topic.quiz?.isOpen ? "открыт студентам" : "скрыт от студентов"}
                </span>
              </span>
              <Link
                href={`/admin/topics/${topic.id}/test`}
                className="text-sm text-brand underline-offset-4 hover:underline"
              >
                Редактировать
              </Link>
              <Link
                href={`/admin/topics/${topic.id}/test/results`}
                className="text-sm text-brand underline-offset-4 hover:underline"
              >
                Результаты
                {quizPending > 0 ? ` · ждут подтверждения: ${quizPending}` : ""}
              </Link>
            </>
          ) : (
            <Link
              href={`/admin/topics/${topic.id}/test`}
              className="text-sm text-brand underline-offset-4 hover:underline"
            >
              + Добавить вопросы
            </Link>
          )}
        </div>
      </Card>
      ) : null}

      <Card
        title="Кому открыта"
        description="Пока подгруппы нет в этом списке с датой — темы для неё не существует"
      >
        {rows.length === 0 ? (
          <Empty>
            Сначала{" "}
            <Link href="/admin/groups" className="text-brand underline underline-offset-4">
              заведите группы
            </Link>
            .
          </Empty>
        ) : (
          <div className="flex flex-col">
            {rows.map((row) => (
              <ReleaseRow
                key={row.subgroupId}
                topicId={topic.id}
                row={row}
                today={today}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
