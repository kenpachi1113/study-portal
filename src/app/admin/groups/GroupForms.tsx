"use client";

import { useActionState } from "react";
import {
  addSubgroupAction,
  createGroupAction,
  type FormState,
} from "./actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function CreateGroupForm({ defaultYear }: { defaultYear: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createGroupAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Группа" hint="Как её называют в колледже">
          <Input name="title" placeholder="МС-24" required />
        </Field>
        <Field label="Учебный год">
          <Input name="academicYear" defaultValue={defaultYear} required />
        </Field>
        <Field label="Подгрупп">
          <Select name="subgroupCount" defaultValue="2">
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Создать группу"}
        </Button>
      </div>
    </form>
  );
}

export function AddSubgroupForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addSubgroupAction,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <Input
        name="title"
        placeholder="номер подгруппы"
        className="w-40"
        required
      />
      <Button type="submit" variant="ghost" disabled={pending}>
        Добавить
      </Button>
      {state.error ? (
        <span className="text-sm text-warn">{state.error}</span>
      ) : null}
    </form>
  );
}
