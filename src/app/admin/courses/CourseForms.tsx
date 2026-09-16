"use client";

import { useActionState } from "react";
import { updateGradingAction, type GradingState } from "./actions";
import { Alert, Button, Field, Select } from "@/components/ui";

export function GradingForm({
  maxGrade,
  gradeRule,
}: {
  maxGrade: number;
  gradeRule: "LAST" | "BEST";
}) {
  const [state, action, pending] = useActionState<GradingState, FormData>(
    updateGradingAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Шкала оценок"
          hint="Ограничивает, что принимает ячейка журнала"
        >
          <Select name="maxGrade" defaultValue={String(maxGrade)}>
            <option value="5">Пятибалльная</option>
            <option value="12">Двенадцатибалльная</option>
            <option value="100">Стобалльная</option>
          </Select>
        </Field>

        <Field
          label="Итог при пересдаче"
          hint="По этому правилу считается средний балл"
        >
          <Select name="gradeRule" defaultValue={gradeRule}>
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
