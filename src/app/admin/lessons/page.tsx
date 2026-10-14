import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { Card, Empty } from "@/components/ui";
import { AddTopicForm, TopicRow } from "./LessonForms";

export const metadata: Metadata = { title: "Занятия" };

export default async function LessonsPage() {
  await requireTeacher();

  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { materials: true, releases: true } } },
  });

  const lectures = topics.filter((t) => t.type === "LECTURE").length;
  const practices = topics.filter((t) => t.type === "PRACTICE").length;
  const tests = topics.filter((t) => t.type === "TEST").length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Занятия</h1>
        <p className="text-sm text-muted">
          Все лекции и практические. Тема хранится отдельно от того, кому она
          открыта, — доступ выдаётся подгруппам внутри самой темы.
        </p>
      </header>

      <Card title="Новая тема">
        <AddTopicForm />
      </Card>

      <Card
        title="Список тем"
        description={
          topics.length > 0
            ? `${lectures} лекций · ${practices} практических · ${tests} тестов`
            : undefined
        }
        actions={
          <Link
            href="/admin/grading"
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Настройки оценок
          </Link>
        }
      >
        {topics.length === 0 ? (
          <Empty>Пока ни одной темы. Добавьте первую формой выше.</Empty>
        ) : (
          <ol className="flex flex-col">
            {topics.map((topic, index) => (
              <TopicRow
                key={topic.id}
                topic={{
                  id: topic.id,
                  title: topic.title,
                  type: topic.type,
                  materials: topic._count.materials,
                  releases: topic._count.releases,
                }}
                canUp={index > 0}
                canDown={index < topics.length - 1}
              />
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
