"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  addSessionAction,
  deleteSessionAction,
  moveSessionAction,
  type SessionState,
} from "./actions";
import { Alert, Button, Field, Input, Select, cn } from "@/components/ui";

export function AddSessionForm({
  subgroupId,
  topics,
  today,
}: {
  subgroupId: string;
  topics: { id: string; label: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<SessionState, FormData>(
    addSessionAction,
    {},
  );

  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted">
        Сначала заведите темы в разделе «Занятия».
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="subgroupId" value={subgroupId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 grow">
          <Field label="Тема">
            <Select name="topicId" defaultValue={topics[0].id}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="w-44">
          <Field label="Дата">
            <Input type="date" name="heldOn" defaultValue={today} required />
          </Field>
        </div>

        <Button type="submit" variant="ghost" disabled={pending}>
          {pending ? "…" : "Добавить занятие"}
        </Button>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

export function SessionRow({
  session,
}: {
  session: {
    id: string;
    dateInput: string;
    dateLabel: string;
    topicTitle: string;
    isPractice: boolean;
    marks: number;
  };
}) {
  const router = useRouter();
  const [state, deleteAction, deleting] = useActionState<SessionState, FormData>(
    deleteSessionAction,
    {},
  );

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5 last:border-b-0">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          session.isPractice ? "bg-brand" : "bg-line",
        )}
        aria-hidden
      />

      <span className="min-w-48 grow font-medium">{session.topicTitle}</span>

      <Input
        type="date"
        defaultValue={session.dateInput}
        aria-label={`Дата занятия «${session.topicTitle}»`}
        className="w-40"
        onChange={async (e) => {
          const result = await moveSessionAction({
            sessionId: session.id,
            heldOn: e.target.value,
          });
          if (result.ok) router.refresh();
        }}
      />

      <span className="font-mono text-xs text-muted tabular-nums">
        {session.marks > 0 ? `${session.marks} отм.` : "пусто"}
      </span>

      <form action={deleteAction}>
        <input type="hidden" name="sessionId" value={session.id} />
        <button
          type="submit"
          disabled={deleting || session.marks > 0}
          title={
            session.marks > 0
              ? "Сначала очистите колонку — иначе удалятся оценки"
              : undefined
          }
          className="text-sm text-muted underline-offset-4 hover:text-warn hover:underline disabled:opacity-30"
        >
          Удалить
        </button>
      </form>

      {state.error ? (
        <span className="w-full text-sm text-warn">{state.error}</span>
      ) : null}
    </li>
  );
}
