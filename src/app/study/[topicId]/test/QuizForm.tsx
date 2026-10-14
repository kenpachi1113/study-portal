"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitQuizAction, type SubmitState } from "./actions";
import { Alert, Button, Input, Select, cn } from "@/components/ui";
import type { AnswerValue, Answers, PublicQuestion } from "@/lib/quiz";

function storageKey(attemptId: string) {
  return `quiz-draft:${attemptId}`;
}

function readDraft(attemptId: string): Answers {
  try {
    const raw = window.localStorage.getItem(storageKey(attemptId));
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

function isAnswered(q: PublicQuestion, v: AnswerValue | undefined): boolean {
  if (v === undefined) return false;
  if (q.type === "MULTIPLE") return Array.isArray(v) && v.length > 0;
  if (q.type === "MATCHING")
    return typeof v === "object" && !Array.isArray(v) && q.lefts.every((l) => (v as Record<string, string>)[l.id]);
  return typeof v === "string" && v.trim() !== "";
}

export function QuizForm({
  attemptId,
  questions,
  deadline,
}: {
  attemptId: string;
  questions: PublicQuestion[];
  deadline: string | null;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitQuizAction, {});
  const [answers, setAnswers] = useState<Answers>({});
  const [loaded, setLoaded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const autoSent = useRef(false);

  // черновик из браузера — после загрузки, чтобы серверная и клиентская разметка совпали
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAnswers(readDraft(attemptId));
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [attemptId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey(attemptId), JSON.stringify(answers));
    } catch {
      // приватный режим или переполнено — черновик просто не сохранится
    }
  }, [answers, attemptId, loaded]);

  const set = (id: string, value: AnswerValue) => setAnswers((prev) => ({ ...prev, [id]: value }));

  // ── таймер
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    if (left === 0 && loaded && !autoSent.current && !pending) {
      autoSent.current = true;
      formRef.current?.requestSubmit();
    }
  }, [left, loaded, pending]);

  const answered = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const unanswered = questions.length - answered;

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (
          !autoSent.current &&
          unanswered > 0 &&
          !window.confirm(`Без ответа осталось вопросов: ${unanswered}. Всё равно отправить?`)
        ) {
          e.preventDefault();
          return;
        }
        try {
          window.localStorage.removeItem(storageKey(attemptId));
        } catch {}
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      {questions.map((q, index) => (
        <fieldset
          key={q.id}
          className="flex flex-col gap-3 rounded border border-line bg-surface px-5 py-4"
        >
          <legend className="sr-only">Вопрос {index + 1}</legend>
          <div className="flex items-start gap-3">
            <span className="font-mono text-sm text-muted">{index + 1}.</span>
            <p className="grow font-medium whitespace-pre-line">{q.text}</p>
            <span className="shrink-0 text-xs text-muted">
              {q.points} балл.
            </span>
          </div>

          {q.type === "SINGLE" ? (
            <div className="flex flex-col gap-1">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-start gap-3 rounded px-2 py-1.5 hover:bg-canvas"
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === o.id}
                    onChange={() => set(q.id, o.id)}
                    className="mt-1 size-4 shrink-0 accent-brand"
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          ) : null}

          {q.type === "MULTIPLE" ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">Выберите все верные варианты</p>
              {q.options.map((o) => {
                const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-start gap-3 rounded px-2 py-1.5 hover:bg-canvas"
                  >
                    <input
                      type="checkbox"
                      checked={current.includes(o.id)}
                      onChange={(e) =>
                        set(
                          q.id,
                          e.target.checked ? [...current, o.id] : current.filter((x) => x !== o.id),
                        )
                      }
                      className="mt-1 size-4 shrink-0 accent-brand"
                    />
                    <span>{o.text}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {q.type === "TEXT" ? (
            <Input
              value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
              onChange={(e) => set(q.id, e.target.value)}
              placeholder="Ваш ответ"
              maxLength={500}
              autoComplete="off"
            />
          ) : null}

          {q.type === "MATCHING" ? (
            <div className="flex flex-col gap-2">
              {q.lefts.map((l) => {
                const map =
                  answers[q.id] && typeof answers[q.id] === "object" && !Array.isArray(answers[q.id])
                    ? (answers[q.id] as Record<string, string>)
                    : {};
                return (
                  <div
                    key={l.id}
                    className="grid gap-1.5 sm:grid-cols-[1fr_1fr] sm:items-center sm:gap-3"
                  >
                    <span>{l.text}</span>
                    <Select
                      value={map[l.id] ?? ""}
                      onChange={(e) => set(q.id, { ...map, [l.id]: e.target.value })}
                      className={cn(!map[l.id] && "text-muted")}
                    >
                      <option value="">— выберите —</option>
                      {q.rights.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.text}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })}
            </div>
          ) : null}
        </fieldset>
      ))}

      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-1 py-3 backdrop-blur">
        <Button type="submit" disabled={pending}>
          {pending ? "Отправляем…" : "Отправить тест"}
        </Button>
        <span className="text-sm text-muted">
          Отвечено {answered} из {questions.length}
        </span>
        {left !== null ? (
          <span
            className={cn(
              "ml-auto font-mono text-sm tabular-nums",
              left < 60 ? "text-warn" : "text-muted",
            )}
            aria-live="polite"
          >
            {left === 0
              ? "время вышло"
              : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
