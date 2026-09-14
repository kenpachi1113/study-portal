"use client";

import { useActionState } from "react";
import {
  resetAccessAction,
  toggleActiveAction,
  type ResetState,
  type ToggleState,
} from "./actions";
import { cn } from "@/components/ui";

export type StudentRowData = {
  id: string;
  fullName: string;
  login: string;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
};

export function StudentRow({ student }: { student: StudentRowData }) {
  const [reset, resetAction, resetting] = useActionState<ResetState, FormData>(
    resetAccessAction,
    {},
  );
  const [toggle, toggleActionState, toggling] = useActionState<
    ToggleState,
    FormData
  >(toggleActiveAction, {});

  const status = !student.isActive
    ? { label: "отчислен", tone: "muted" as const }
    : student.hasPassword
      ? { label: "активен", tone: "ok" as const }
      : { label: "не входил", tone: "warn" as const };

  return (
    <tr className="border-b border-line last:border-b-0 align-top">
      <td className={cn("px-4 py-3", !student.isActive && "text-muted line-through")}>
        {student.fullName}
      </td>

      <td className="px-4 py-3 font-mono text-[13px]">{student.login}</td>

      <td className="px-4 py-3">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs",
            status.tone === "ok" && "bg-ok-soft text-ok",
            status.tone === "warn" && "bg-warn-soft text-warn",
            status.tone === "muted" && "bg-canvas text-muted",
          )}
        >
          {status.label}
        </span>
        {reset.issued ? (
          <div className="mt-2 flex flex-col gap-0.5 rounded bg-brand-soft px-2 py-1.5">
            <span className="font-mono text-xs text-muted">новый код</span>
            <span className="font-mono text-sm font-medium tracking-widest">
              {reset.issued.code}
            </span>
          </div>
        ) : null}
        {reset.error ? (
          <span className="mt-1 block text-xs text-warn">{reset.error}</span>
        ) : null}
        {toggle.error ? (
          <span className="mt-1 block text-xs text-warn">{toggle.error}</span>
        ) : null}
      </td>

      <td className="px-4 py-3 text-sm text-muted tabular-nums">
        {student.lastLoginAt ?? "—"}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-3 text-sm">
          <form action={resetAction}>
            <input type="hidden" name="studentId" value={student.id} />
            <button
              type="submit"
              disabled={resetting || !student.isActive}
              className="text-brand underline-offset-4 hover:underline disabled:opacity-40"
            >
              {resetting ? "…" : "Новый код"}
            </button>
          </form>

          <form action={toggleActionState}>
            <input type="hidden" name="studentId" value={student.id} />
            <button
              type="submit"
              disabled={toggling}
              className="text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
            >
              {student.isActive ? "Отчислить" : "Вернуть"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
