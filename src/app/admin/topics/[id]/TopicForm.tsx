"use client";

import { useActionState } from "react";
import { saveTopicAction, type TopicSaveState } from "./actions";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function TopicForm({
  topic,
}: {
  topic: {
    id: string;
    title: string;
    type: "LECTURE" | "PRACTICE" | "TEST";
    bodyHtml: string | null;
    taskHtml: string | null;
    maxScore: number | null;
  };
}) {
  const [state, action, pending] = useActionState<TopicSaveState, FormData>(
    saveTopicAction,
    {},
  );
  const isTest = topic.type === "TEST";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="topicId" value={topic.id} />

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Название">
          <Input name="title" defaultValue={topic.title} required />
        </Field>
        <Field label="Тип">
          <Select name="type" defaultValue={topic.type}>
            <option value="LECTURE">Лекция</option>
            <option value="PRACTICE">Практическая</option>
            <option value="TEST">Тест</option>
          </Select>
        </Field>
      </div>

      {isTest ? (
        <Field
          label="Пояснение перед тестом"
          hint="Необязательно. Например: «Тест по темам 1–10, 20 минут, одна попытка»"
        >
          <Textarea name="bodyHtml" rows={3} defaultValue={topic.bodyHtml ?? ""} />
        </Field>
      ) : (
        <Field
          label="Содержание"
          hint="Можно писать HTML — он выводится студенту как есть. Пишете сюда только вы."
        >
          <Textarea name="bodyHtml" rows={10} defaultValue={topic.bodyHtml ?? ""} />
        </Field>
      )}

      {isTest ? (
        <input type="hidden" name="taskHtml" value={topic.taskHtml ?? ""} />
      ) : (
        <Field
          label="Задание"
          hint="Для практической — что именно нужно сделать и сдать"
        >
          <Textarea name="taskHtml" rows={6} defaultValue={topic.taskHtml ?? ""} />
        </Field>
      )}

      {isTest ? (
        <input type="hidden" name="maxScore" value={topic.maxScore ?? ""} />
      ) : (
        <div className="w-48">
          <Field label="Максимальный балл" hint="Пусто — по шкале курса">
            <Input
              name="maxScore"
              inputMode="numeric"
              defaultValue={topic.maxScore ?? ""}
            />
          </Field>
        </div>
      )}

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
