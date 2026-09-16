import type { Metadata } from "next";
import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/course";
import { Card } from "@/components/ui";
import { GradingForm } from "../courses/CourseForms";

export const metadata: Metadata = { title: "Настройки оценок" };

export default async function GradingPage() {
  await requireTeacher();
  const course = await getPrimaryCourse();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/lessons"
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink"
        >
          ← занятия
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Настройки оценок
        </h1>
        <p className="text-sm text-muted">
          Две настройки на весь курс. Менять их посреди семестра можно, но
          уже выставленные оценки при этом не пересчитываются.
        </p>
      </header>

      <Card>
        <GradingForm
          maxGrade={course.maxGrade}
          gradeRule={course.gradeRule}
        />
      </Card>
    </div>
  );
}
