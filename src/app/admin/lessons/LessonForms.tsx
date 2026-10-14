"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addTopicAction,
  deleteTopicAction,
  moveTopicAction,
  type AddTopicState,
  type DeleteTopicState,
  type MoveTopicState,
} from "./actions";
import { Alert, Button, Input, Select, cn } from "@/components/ui";
import { TOPIC_TYPE_LABEL, type TopicType } from "@/lib/format";

export function AddTopicForm() {
  const [state, action, pending] = useActionState<AddTopicState, FormData>(
    addTopicAction,
    {},
  );

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
              <option value="TEST">Тест</option>
            </Select>
          </label>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Добавить"}
        </Button>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

export type TopicRowData = {
  id: string;
  title: string;
  type: TopicType;
  materials: number;
  releases: number;
};

export function TopicRow({
  topic,
  canUp,
  canDown,
}: {
  topic: TopicRowData;
  canUp: boolean;
  canDown: boolean;
}) {
  const [, moveAction, moving] = useActionState<MoveTopicState, FormData>(
    moveTopicAction,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<
    DeleteTopicState,
    FormData
  >(deleteTopicAction, {});

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0">
      <form action={moveAction} className="flex items-center gap-0.5">
        <input type="hidden" name="topicId" value={topic.id} />
        <button
          type="submit"
          name="direction"
          value="up"
          disabled={!canUp || moving}
          aria-label="Выше"
          className="rounded px-1.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-25"
        >
          ↑
        </button>
        <button
          type="submit"
          name="direction"
          value="down"
          disabled={!canDown || moving}
          aria-label="Ниже"
          className="rounded px-1.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-25"
        >
          ↓
        </button>
      </form>

      <Link
        href={`/admin/topics/${topic.id}`}
        className="font-medium text-brand underline-offset-4 hover:underline"
      >
        {topic.title}
      </Link>

      <span
        className={cn(
          "rounded px-2 py-0.5 text-xs",
          topic.type === "PRACTICE" && "bg-brand-soft text-brand",
          topic.type === "TEST" && "bg-ok-soft text-ok",
          topic.type === "LECTURE" && "bg-canvas text-muted",
        )}
      >
        {TOPIC_TYPE_LABEL[topic.type]}
      </span>

      <span className="ml-auto flex items-center gap-3 text-xs text-muted">
        {topic.materials > 0 ? <span>{topic.materials} файл.</span> : null}
        <span className={topic.releases > 0 ? "text-ok" : undefined}>
          {topic.releases > 0
            ? `открыта ${topic.releases}`
            : "не открыта"}
        </span>
        <form action={deleteAction}>
          <input type="hidden" name="topicId" value={topic.id} />
          <button
            type="submit"
            disabled={deleting}
            className="underline-offset-4 hover:text-warn hover:underline disabled:opacity-40"
          >
            {deleting ? "…" : "Удалить"}
          </button>
        </form>
      </span>

      {deleteState.error ? (
        <span className="w-full text-sm text-warn">{deleteState.error}</span>
      ) : null}
    </li>
  );
}
