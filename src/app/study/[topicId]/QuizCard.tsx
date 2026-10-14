"use client";

import { useActionState } from "react";
import { startQuizAction, type StartState } from "./test/actions";
import { Alert, Button } from "@/components/ui";

export function StartQuizButton({
  topicId,
  label,
}: {
  topicId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startQuizAction, {});
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="topicId" value={topicId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Открываем…" : label}
      </Button>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}
