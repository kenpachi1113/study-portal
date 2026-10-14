"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  annulAttemptAction,
  confirmAllAction,
  confirmAttemptAction,
  restoreAttemptAction,
} from "../actions";
import { Button, Input, cn } from "@/components/ui";
import { formatScore } from "@/lib/quiz";

export type ResultAttempt = {
  id: string;
  number: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "CONFIRMED" | "ANNULLED";
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  suggested: number | null;
  grade: number | null;
  when: string;
  took: number | null;
  late: boolean;
  details: ReactNode;
};

export type ResultRow = {
  studentId: string;
  name: string;
  /** какая попытка уйдёт в журнал по кнопке «подтвердить всех» */
  bulkAttemptId: string | null;
  attempts: ResultAttempt[];
};

export function SubgroupResults({
  topicId,
  maxGrade,
  rows,
  journalHref,
}: {
  topicId: string;
  maxGrade: number;
  rows: ResultRow[];
  journalHref: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const r of rows)
      for (const a of r.attempts) init[a.id] = a.suggested !== null ? String(a.suggested) : "";
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (attemptId: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const r = await fn();
      setErrors((prev) => {
        const next = { ...prev };
        if (r.ok) delete next[attemptId];
        else next[attemptId] = r.error ?? "Ошибка";
        return next;
      });
    });

  const bulk = rows
    .filter((r) => r.bulkAttemptId)
    .map((r) => ({ attemptId: r.bulkAttemptId!, value: Number(values[r.bulkAttemptId!]) }))
    .filter((x) => Number.isInteger(x.value) && x.value >= 1);

  if (rows.length === 0)
    return <p className="text-sm text-muted">В подгруппе нет студентов.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending || bulk.length === 0}
          onClick={() =>
            startTransition(async () => {
              const r = await confirmAllAction({ topicId, grades: bulk });
              setMessage(r.ok ? `В журнал отправлено оценок: ${r.count}` : r.error);
            })
          }
        >
          Подтвердить всех ({bulk.length})
        </Button>
        <span className="text-xs text-muted">
          По одной попытке на студента — по правилу курса (последняя или лучшая). Пустые
          и аннулированные пропускаются.
        </span>
        <Link
          href={journalHref}
          className="ml-auto text-sm text-brand underline-offset-4 hover:underline"
        >
          Открыть журнал
        </Link>
      </div>
      {message ? <p className="text-sm text-ok">{message}</p> : null}

      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.studentId} className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0">
            <span className="font-medium">{row.name}</span>
            {row.attempts.length === 0 ? (
              <span className="text-sm text-muted">не проходил</span>
            ) : (
              row.attempts.map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm",
                      a.status === "ANNULLED" && "text-muted line-through decoration-muted/50",
                    )}
                  >
                    <span className="w-20 text-muted">попытка {a.number}</span>
                    {a.score !== null && a.maxScore !== null ? (
                      <span className="w-28 font-mono tabular-nums">
                        {formatScore(a.score)}/{formatScore(a.maxScore)}
                        {a.percent !== null ? ` · ${a.percent}%` : ""}
                      </span>
                    ) : (
                      <span className="w-28 text-muted">идёт</span>
                    )}
                    <span className="text-xs text-muted">
                      {a.when}
                      {a.took !== null ? ` · ${a.took} мин` : ""}
                    </span>
                    {a.late ? (
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">
                        после лимита времени
                      </span>
                    ) : null}

                    <span className="ml-auto flex flex-wrap items-center gap-2 no-underline">
                      {a.status === "SUBMITTED" ? (
                        <>
                          <span className="inline-block w-16">
                            <Input
                              value={values[a.id] ?? ""}
                              onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                              inputMode="numeric"
                              className="text-center"
                              aria-label="Оценка"
                              placeholder={maxGrade === 1 ? "1" : "—"}
                            />
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-3 py-1.5"
                            disabled={pending}
                            onClick={() =>
                              run(a.id, () =>
                                confirmAttemptAction({ attemptId: a.id, value: Number(values[a.id]) }),
                              )
                            }
                          >
                            В журнал
                          </Button>
                        </>
                      ) : null}
                      {a.status === "CONFIRMED" ? (
                        a.grade !== null ? (
                          <span className="rounded bg-ok-soft px-2 py-0.5 text-ok">
                            в журнале: {a.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">оценку убрали из журнала</span>
                        )
                      ) : null}
                      {a.status === "ANNULLED" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(a.id, () => restoreAttemptAction({ attemptId: a.id }))}
                          className="text-muted no-underline underline-offset-4 hover:text-ink hover:underline"
                        >
                          вернуть
                        </button>
                      ) : null}
                      {a.status === "SUBMITTED" ||
                      a.status === "IN_PROGRESS" ||
                      (a.status === "CONFIRMED" && a.grade === null) ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(a.id, () => annulAttemptAction({ attemptId: a.id }))}
                          className="text-muted underline-offset-4 hover:text-warn hover:underline"
                        >
                          аннулировать
                        </button>
                      ) : null}
                    </span>
                  </div>
                  {errors[a.id] ? <span className="text-sm text-warn">{errors[a.id]}</span> : null}
                  {a.details ? (
                    <details className="pl-0 sm:pl-[5.75rem]">
                      <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                        ответы
                      </summary>
                      <div className="mt-2 rounded border border-line bg-canvas px-3 py-2">
                        {a.details}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
