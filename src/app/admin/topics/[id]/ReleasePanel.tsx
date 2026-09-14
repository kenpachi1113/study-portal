"use client";

import { useActionState } from "react";
import {
  removeReleaseAction,
  setReleaseAction,
  type ReleaseState,
} from "./actions";
import { Button, Input, cn } from "@/components/ui";

export type SubgroupRelease = {
  subgroupId: string;
  label: string;
  opensAt: string | null; // YYYY-MM-DD
  closesAt: string | null;
  isOpen: boolean;
};

export function ReleaseRow({
  topicId,
  row,
  today,
}: {
  topicId: string;
  row: SubgroupRelease;
  today: string;
}) {
  const [state, action, pending] = useActionState<ReleaseState, FormData>(
    setReleaseAction,
    {},
  );
  const [, removeAction, removing] = useActionState<ReleaseState, FormData>(
    removeReleaseAction,
    {},
  );

  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-44 font-medium">{row.label}</span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs",
            row.isOpen ? "bg-ok-soft text-ok" : "bg-canvas text-muted",
          )}
        >
          {row.isOpen ? "открыта" : "закрыта"}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="topicId" value={topicId} />
          <input type="hidden" name="subgroupId" value={row.subgroupId} />

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
              с
            </span>
            <Input
              type="date"
              name="opensAt"
              defaultValue={row.opensAt ?? today}
              className="w-44"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
              до (не обязательно)
            </span>
            <Input
              type="date"
              name="closesAt"
              defaultValue={row.closesAt ?? ""}
              className="w-44"
            />
          </label>

          <Button type="submit" variant="ghost" disabled={pending}>
            {pending ? "…" : row.isOpen ? "Обновить" : "Открыть"}
          </Button>
        </form>

        {row.isOpen ? (
          <form action={removeAction}>
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="subgroupId" value={row.subgroupId} />
            <button
              type="submit"
              disabled={removing}
              className="pb-2 text-sm text-muted underline-offset-4 hover:text-warn hover:underline"
            >
              Закрыть
            </button>
          </form>
        ) : null}
      </div>

      {state.error ? (
        <span className="text-sm text-warn">{state.error}</span>
      ) : null}
    </div>
  );
}
