"use client";

import type { IssuedAccess } from "./actions";

/**
 * Таблица выданных доступов. Показывается один раз после генерации —
 * в базе лежат только хеши, повторно эти коды не достать.
 * Печатается в две колонки: раздать на паре и не диктовать вслух каждому.
 */
export function AccessTable({
  rows,
  title,
}: {
  rows: IssuedAccess[];
  title: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded border border-brand/30 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted">
            Коды показываются только сейчас. Сохраните или распечатайте —
            повторно их не восстановить, можно будет только выдать новые.
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:bg-canvas"
        >
          Печать
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] tracking-widest text-muted uppercase">
              <th className="px-4 py-2 font-medium">Студент</th>
              <th className="px-4 py-2 font-medium">Логин</th>
              <th className="px-4 py-2 font-medium">Код</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.login} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2">{row.fullName}</td>
                <td className="px-4 py-2 font-mono text-[13px]">{row.login}</td>
                <td className="px-4 py-2 font-mono text-[13px] font-medium tracking-widest">
                  {row.code}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
