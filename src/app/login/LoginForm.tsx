"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signInAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Логин">
        <Input
          name="login"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
      </Field>

      <Field
        label="Пароль или код первого входа"
        hint="Если входите впервые — введите код, который выдал преподаватель."
      >
        <Input name="secret" type="password" autoComplete="current-password" required />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Проверяем…" : "Войти"}
      </Button>
    </form>
  );
}
