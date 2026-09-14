"use client";

import { useActionState } from "react";
import {
  deleteCourseAction,
  updateCourseAction,
  type CourseSettingsState,
  type DeleteCourseState,
} from "./actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function CourseSettingsForm({
  course,
}: {
  course: {
    id: string;
    title: string;
    description: string | null;
    maxGrade: number;
    gradeRule: "LAST" | "BEST";
  };
}) {
  const [state, action, pending] = useActionState<
    CourseSettingsState,
    FormData
  >(updateCourseAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={course.id} />

      <Field label="Название">
        <Input name="title" defaultValue={course.title} required />
      </Field>

      <Field label="Описание" hint="Необязательно">
        <Input name="description" defaultValue={course.description ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Шкала оценок">
          <Select name="maxGrade" defaultValue={String(course.maxGrade)}>
            <option value="5">Пятибалльная</option>
            <option value="12">Двенадцатибалльная</option>
            <option value="100">Стобалльная</option>
          </Select>
        </Field>

        <Field
          label="Итог при пересдаче"
          hint="По этому правилу журнал считает средний балл"
        >
          <Select name="gradeRule" defaultValue={course.gradeRule}>
            <option value="LAST">По последней попытке</option>
            <option value="BEST">По лучшей попытке</option>
          </Select>
        </Field>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCourseForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<DeleteCourseState, FormData>(
    deleteCourseAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "…" : "Удалить дисциплину"}
        </Button>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}
