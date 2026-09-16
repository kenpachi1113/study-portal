"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setCellAction } from "./actions";
import { cn } from "@/components/ui";

export type GridSession = {
  id: string;
  dateLabel: string;
  topicTitle: string;
  isPractice: boolean;
};

export type GridStudent = {
  id: string;
  name: string;
  average: string;
  absences: number;
};

export type GridCell = {
  value: string;
  hint: string;
  tone: "plain" | "fail" | "absent" | "retake";
};

/**
 * Единственный экран, который открывается каждую пару, поэтому ввод здесь
 * клавиатурный: цифра — оценка, «н» — не был, «о» — опоздал, «у» — по
 * уважительной, Enter и стрелки двигают по ячейкам, сохранение само.
 *
 * Если бы это делалось через модалки и кнопку «сохранить», через две недели
 * все вернулись бы к бумажному журналу.
 */
export function JournalGrid({
  sessions,
  students,
  cells,
}: {
  sessions: GridSession[];
  students: GridStudent[];
  cells: Record<string, GridCell>;
}) {
  const router = useRouter();
  // плоская карта вместо двумерного массива: заполняется из ref-колбэков,
  // то есть после рендера, а не во время него
  const inputs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const key = (sessionId: string, studentId: string) =>
    `${sessionId}:${studentId}`;

  function focusCell(row: number, col: number) {
    const target = inputs.current.get(`${row}:${col}`);
    if (target) {
      target.focus();
      target.select();
    }
  }

  async function save(
    sessionId: string,
    studentId: string,
    raw: string,
    original: string,
  ) {
    if (raw.trim() === original.trim()) return;

    const cellKey = key(sessionId, studentId);
    setSaving((prev) => new Set(prev).add(cellKey));
    setError(null);

    try {
      const result = await setCellAction({ sessionId, studentId, raw });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (e) {
      // Без этого любое падение на сервере выглядело бы как «ячейка не
      // реагирует»: промис отклонён, интерфейс молчит, причины не видно.
      console.error("journal: не удалось сохранить ячейку", e);
      setError(
        `Не удалось сохранить: ${
          e instanceof Error ? e.message : "неизвестная ошибка"
        }. Подробности — в консоли браузера и в окне npm run dev.`,
      );
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  }

  // Журнал не заполняется, пока нет обеих осей. Молча показывать пустую
  // таблицу нельзя — по ней не понять, чего не хватает.
  if (students.length === 0 || sessions.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded border border-dashed border-line px-5 py-6">
        <p className="text-sm font-medium">Журнал пока не из чего собрать.</p>

        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li className="flex gap-2">
            <span aria-hidden className={students.length ? "text-ok" : "text-warn"}>
              {students.length ? "✓" : "—"}
            </span>
            <span>
              Студенты в подгруппе:{" "}
              {students.length ? (
                `${students.length}`
              ) : (
                <>
                  нет.{" "}
                  <a
                    href="/admin/groups"
                    className="text-brand underline underline-offset-4"
                  >
                    Завести список
                  </a>
                </>
              )}
            </span>
          </li>

          <li className="flex gap-2">
            <span aria-hidden className={sessions.length ? "text-ok" : "text-warn"}>
              {sessions.length ? "✓" : "—"}
            </span>
            <span>
              Занятия:{" "}
              {sessions.length ? (
                `${sessions.length}`
              ) : (
                <>
                  нет. Колонка появляется, когда тема открывается этой
                  подгруппе —{" "}
                  <a
                    href="/admin/lessons"
                    className="text-brand underline underline-offset-4"
                  >
                    в теме, блок «Кому открыта»
                  </a>
                  . Либо добавьте занятие вручную формой ниже.
                </>
              )}
            </span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded bg-warn-soft px-3 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              {/* на телефоне колонка с фамилиями не должна съедать экран */}
              <th className="sticky left-0 z-10 min-w-36 border-b border-line bg-surface px-3 py-2 text-left font-mono text-[11px] tracking-widest text-muted uppercase sm:min-w-52">
                Студент
              </th>
              {sessions.map((session) => (
                <th
                  key={session.id}
                  title={session.topicTitle}
                  className="border-b border-line px-1 py-2 align-bottom"
                >
                  <div className="flex w-11 flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        session.isPractice ? "bg-brand" : "bg-line",
                      )}
                    />
                    <span className="font-mono text-[11px] whitespace-nowrap text-muted tabular-nums">
                      {session.dateLabel}
                    </span>
                  </div>
                </th>
              ))}
              {/* итоговые столбцы отделены и залиты — в них не печатают */}
              <th className="border-b border-l border-line bg-canvas px-3 py-2 text-right font-mono text-[11px] tracking-widest text-muted uppercase">
                Ср.
              </th>
              <th className="border-b border-line bg-canvas px-3 py-2 text-right font-mono text-[11px] tracking-widest text-muted uppercase">
                н
              </th>
            </tr>
          </thead>

          <tbody>
            {students.map((student, row) => {
              return (
                <tr key={student.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1 text-left font-normal whitespace-nowrap group-hover:bg-canvas"
                  >
                    {student.name}
                  </th>

                  {sessions.map((session, col) => {
                    const cellKey = key(session.id, student.id);
                    const cell = cells[cellKey] ?? {
                      value: "",
                      hint: "",
                      tone: "plain" as const,
                    };

                    return (
                      <td
                        key={session.id}
                        className="border-b border-line p-0.5 group-hover:bg-canvas"
                      >
                        <input
                          placeholder="·"
                          ref={(el) => {
                            const at = `${row}:${col}`;
                            if (el) inputs.current.set(at, el);
                            else inputs.current.delete(at);
                          }}
                          defaultValue={cell.value}
                          title={cell.hint || undefined}
                          maxLength={3}
                          inputMode="text"
                          aria-label={`${student.name}, ${session.dateLabel}`}
                          className={cn(
                            // клетка должна выглядеть кликабельной: своя
                            // подложка, курсор ввода и подсветка под мышью
                            // 16px на телефоне — иначе Safari увеличивает
                            // всю страницу при фокусе на поле
                            "w-11 cursor-text rounded-[3px] bg-surface py-1.5 text-center text-base outline-none tabular-nums sm:text-sm",
                            "placeholder:text-line-strong hover:bg-brand-soft/60",
                            "focus:bg-brand-soft focus:ring-1 focus:ring-brand",
                            saving.has(cellKey) && "opacity-40",
                            cell.tone === "fail" && "font-medium text-warn",
                            cell.tone === "absent" && "text-muted",
                            cell.tone === "retake" &&
                              "font-medium text-brand underline decoration-dotted underline-offset-4",
                          )}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                              focusCell(row + 1, col);
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              focusCell(row + 1, col);
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              focusCell(row - 1, col);
                            } else if (e.key === "ArrowRight") {
                              e.preventDefault();
                              focusCell(row, col + 1);
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              focusCell(row, col - 1);
                            } else if (e.key === "Escape") {
                              e.currentTarget.value = cell.value;
                              e.currentTarget.blur();
                            }
                          }}
                          onBlur={(e) =>
                            void save(
                              session.id,
                              student.id,
                              e.target.value,
                              cell.value,
                            )
                          }
                        />
                      </td>
                    );
                  })}

                  <td className="border-b border-l border-line bg-canvas px-3 py-1 text-right font-mono text-xs text-muted tabular-nums">
                    {student.average}
                  </td>
                  <td
                    className={cn(
                      "border-b border-line bg-canvas px-3 py-1 text-right font-mono text-xs tabular-nums",
                      student.absences > 0 ? "text-warn" : "text-muted",
                    )}
                  >
                    {student.absences || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Печатают в белые клетки под датами; два столбца справа считаются сами.
        Цифра — оценка, <b className="font-medium">н</b> — не был,{" "}
        <b className="font-medium">о</b> — опоздал,{" "}
        <b className="font-medium">у</b> — по уважительной, пусто — очистить.
        Enter и стрелки двигают по ячейкам. Повторная оценка за то же занятие
        заводит пересдачу, старая остаётся в истории — она видна при наведении.
      </p>
    </div>
  );
}
