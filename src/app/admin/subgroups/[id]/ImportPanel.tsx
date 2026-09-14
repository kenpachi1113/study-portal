"use client";

import { useActionState } from "react";
import { importStudentsAction, type ImportState } from "./actions";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { AccessTable } from "./AccessTable";

const PLACEHOLDER = `Бондаренко Артём Игоревич
Коваль Дарья Сергеевна
Мельник Иван`;

export function ImportPanel({
  subgroupId,
  codeTtlDays,
}: {
  subgroupId: string;
  codeTtlDays: number;
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importStudentsAction,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4 print:hidden">
        <input type="hidden" name="subgroupId" value={subgroupId} />

        <Field
          label="Список студентов"
          hint={`По одному человеку в строке: Фамилия Имя Отчество. Отчество можно опустить. Код действует ${codeTtlDays} дней.`}
        >
          <Textarea name="names" rows={8} placeholder={PLACEHOLDER} required />
        </Field>

        {state.error ? <Alert>{state.error}</Alert> : null}

        {state.skipped && state.skipped.length > 0 ? (
          <Alert>
            Не разобрано {state.skipped.length}{" "}
            {state.skipped.length === 1 ? "строка" : "строк"}:{" "}
            {state.skipped.slice(0, 3).join(" · ")}
            {state.skipped.length > 3 ? " …" : ""}
          </Alert>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Заводим…" : "Завести аккаунты"}
          </Button>
        </div>
      </form>

      {state.created ? (
        <AccessTable
          rows={state.created}
          title={`Заведено: ${state.created.length}`}
        />
      ) : null}
    </div>
  );
}
