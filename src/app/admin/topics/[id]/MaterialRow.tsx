"use client";

import { useActionState } from "react";
import { deleteMaterialAction, type DeleteMaterialState } from "./actions";

export function MaterialRow({
  material,
}: {
  material: { id: string; fileName: string; size: string };
}) {
  const [state, action, pending] = useActionState<DeleteMaterialState, FormData>(
    deleteMaterialAction,
    {},
  );

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-b-0">
      <a
        href={`/api/materials/${material.id}`}
        className="font-medium text-brand underline-offset-4 hover:underline"
      >
        {material.fileName}
      </a>
      <span className="font-mono text-xs text-muted tabular-nums">
        {material.size}
      </span>

      <form action={action} className="ml-auto">
        <input type="hidden" name="materialId" value={material.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-sm text-muted underline-offset-4 hover:text-warn hover:underline disabled:opacity-40"
        >
          {pending ? "…" : "Удалить"}
        </button>
      </form>

      {state.error ? (
        <span className="w-full text-sm text-warn">{state.error}</span>
      ) : null}
    </li>
  );
}
