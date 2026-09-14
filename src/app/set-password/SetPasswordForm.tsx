"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetPasswordState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(
    setPasswordAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Новый пароль" hint="Не короче 8 символов, минимум одна буква и одна цифра.">
        <Input name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>

      <Field label="Ещё раз">
        <Input name="repeat" type="password" autoComplete="new-password" required />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить и войти"}
      </Button>
    </form>
  );
}
