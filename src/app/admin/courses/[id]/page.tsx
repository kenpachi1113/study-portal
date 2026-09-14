import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { Card } from "@/components/ui";
import { CourseSettingsForm, DeleteCourseForm } from "../CourseForms";

export const metadata: Metadata = { title: "Настройки дисциплины" };

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { topics: true } } },
  });

  if (!course) notFound();

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
          {course.title}
        </h1>
        <p className="text-sm text-muted">
          Тем в дисциплине: {course._count.topics}
        </p>
      </header>

      <Card title="Настройки">
        <CourseSettingsForm
          course={{
            id: course.id,
            title: course.title,
            description: course.description,
            maxGrade: course.maxGrade,
            gradeRule: course.gradeRule,
          }}
        />
      </Card>

      <Card
        title="Опасная зона"
        description="Удалить можно только пустую дисциплину"
      >
        <DeleteCourseForm courseId={course.id} />
      </Card>
    </div>
  );
}
