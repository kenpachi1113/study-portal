"use client";

import { useActionState, useState } from "react";
import {
  addTopicAction,
  moveTopicAction,
  type AddTopicState,
  type MoveTopicState,
} from "./actions";
import { Alert, Button, Input, Select } from "@/components/ui";

export function AddTopicForm({
  courses,
  defaultCourseId,
}: {
  courses: { id: string; title: string }[];
  defaultCourseId: string;
}) {
  const [state, action, pending] = useActionState<AddTopicState, FormData>(
    addTopicAction,
    {},
  );
  const [addingCourse, setAddingCourse] = useState(courses.length === 0);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 grow">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Название темы</span>
            <Input
              name="title"
              placeholder="Устройство персонального компьютера"
              required
            />
          </label>
        </div>

        <div className="w-44">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Тип</span>
            <Select name="type" defaultValue="LECTURE">
              <option value="LECTURE">Лекция</option>
              <option value="PRACTICE">Практическая</option>
            </Select>
          </label>
        </div>

        <div className="w-64">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Дисциплина</span>
            {addingCourse ? (
              <Input
                name="newCourseTitle"
                placeholder="Название дисциплины"
                required
              />
            ) : (
              <Select name="courseId" defaultValue={defaultCourseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            )}
          </label>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Добавить"}
        </Button>
      </div>

      {courses.length > 0 ? (
        <button
          type="button"
          onClick={() => setAddingCourse((v) => !v)}
          className="self-start text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {addingCourse ? "выбрать из существующих" : "+ новая дисциплина"}
        </button>
      ) : null}

      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

export function MoveTopicButtons({
  topicId,
  canUp,
  canDown,
}: {
  topicId: string;
  canUp: boolean;
  canDown: boolean;
}) {
  const [, action, pending] = useActionState<MoveTopicState, FormData>(
    moveTopicAction,
    {},
  );

  return (
    <form action={action} className="flex items-center gap-0.5">
      <input type="hidden" name="topicId" value={topicId} />
      <button
        type="submit"
        name="direction"
        value="up"
        disabled={!canUp || pending}
        aria-label="Выше"
        className="rounded px-1.5 py-0.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-25"
      >
        ↑
      </button>
      <button
        type="submit"
        name="direction"
        value="down"
        disabled={!canDown || pending}
        aria-label="Ниже"
        className="rounded px-1.5 py-0.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-25"
      >
        ↓
      </button>
    </form>
  );
}
