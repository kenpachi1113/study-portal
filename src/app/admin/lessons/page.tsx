import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { TOPIC_TYPE_LABEL } from "@/lib/format";
import { Card, Empty, cn } from "@/components/ui";
import { AddTopicForm, MoveTopicButtons } from "./LessonForms";

export const metadata: Metadata = { title: "Занятия" };

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  await requireTeacher();
  const { course: selected } = await searchParams;

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      topics: {
        orderBy: { order: "asc" },
        include: { _count: { select: { materials: true, releases: true } } },
      },
    },
  });

  const visible =
    selected && courses.some((c) => c.id === selected)
      ? courses.filter((c) => c.id === selected)
      : courses;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Занятия</h1>
        <p className="text-sm text-muted">
          Здесь живут все лекции и практические. Тема хранится отдельно от
          того, кому она открыта, — открывается подгруппам внутри самой темы.
        </p>
      </header>

      <Card title="Новая тема">
        <AddTopicForm
          courses={courses.map((c) => ({ id: c.id, title: c.title }))}
          defaultCourseId={selected ?? courses[0]?.id ?? ""}
        />
      </Card>

      {courses.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          <FilterChip href="/admin/lessons" active={!selected}>
            Все дисциплины
          </FilterChip>
          {courses.map((c) => (
            <FilterChip
              key={c.id}
              href={`/admin/lessons?course=${c.id}`}
              active={selected === c.id}
            >
              {c.title}
            </FilterChip>
          ))}
        </nav>
      ) : null}

      {courses.length === 0 ? (
        <Empty>Пока ни одной темы. Добавьте первую формой выше.</Empty>
      ) : null}

      {visible.map((course) => (
        <Card
          key={course.id}
          title={course.title}
          description={`Шкала ${course.maxGrade} · итог ${
            course.gradeRule === "LAST" ? "по последней попытке" : "по лучшей"
          }`}
          actions={
            <Link
              href={`/admin/courses/${course.id}`}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Настройки
            </Link>
          }
        >
          {course.topics.length === 0 ? (
            <Empty>В этой дисциплине пока нет тем.</Empty>
          ) : (
            <ol className="flex flex-col">
              {course.topics.map((topic, index) => (
                <li
                  key={topic.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0"
                >
                  <MoveTopicButtons
                    topicId={topic.id}
                    canUp={index > 0}
                    canDown={index < course.topics.length - 1}
                  />

                  <Link
                    href={`/admin/topics/${topic.id}`}
                    className="font-medium underline-offset-4 hover:text-brand hover:underline"
                  >
                    {topic.title}
                  </Link>

                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs",
                      topic.type === "PRACTICE"
                        ? "bg-brand-soft text-brand"
                        : "bg-canvas text-muted",
                    )}
                  >
                    {TOPIC_TYPE_LABEL[topic.type]}
                  </span>

                  <span className="ml-auto font-mono text-xs text-muted tabular-nums">
                    {topic._count.materials > 0
                      ? `${topic._count.materials} файл. · `
                      : ""}
                    {topic._count.releases === 0
                      ? "не открыта"
                      : `открыта ${topic._count.releases}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ))}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded border px-3 py-1.5 text-sm transition",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
