"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveQuizAction, type QuizSaveState } from "./actions";
import { Alert, Button, Field, Input, Select, Textarea, cn } from "@/components/ui";
import {
  QUESTION_TYPE_LABEL,
  TEXT_FORMAT_HELP,
  newId,
  parseQuizText,
  quizToText,
  validateQuestion,
  type Question,
  type QuestionType,
} from "@/lib/quiz";

export type QuizSettings = {
  isOpen: boolean;
  maxAttempts: number;
  timeLimitMin: number | null;
  showScore: boolean;
};

function blank(type: QuestionType): Question {
  const id = newId();
  if (type === "SINGLE" || type === "MULTIPLE")
    return {
      id,
      type,
      text: "",
      points: 1,
      options: [
        { id: newId(), text: "", correct: true },
        { id: newId(), text: "", correct: false },
        { id: newId(), text: "", correct: false },
      ],
    };
  if (type === "TEXT") return { id, type, text: "", points: 1, answers: [""] };
  return {
    id,
    type,
    text: "",
    points: 1,
    pairs: [
      { id: newId(), left: "", right: "" },
      { id: newId(), left: "", right: "" },
      { id: newId(), left: "", right: "" },
    ],
  };
}

/** Смена типа без потери набранного: варианты остаются вариантами и т.д. */
function convert(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const base = { id: q.id, text: q.text, points: q.points };
  const isChoice = (t: QuestionType) => t === "SINGLE" || t === "MULTIPLE";

  if (isChoice(q.type) && isChoice(type) && "options" in q)
    return { ...base, type: type as "SINGLE" | "MULTIPLE", options: q.options };
  if (type === "TEXT") {
    const answers =
      "options" in q ? q.options.filter((o) => o.correct).map((o) => o.text) : [];
    return { ...base, type, answers: answers.length ? answers : [""] };
  }
  if (isChoice(type)) {
    const fresh = blank(type);
    if (q.type === "TEXT" && "options" in fresh) {
      const opts = q.answers.filter(Boolean).map((a) => ({ id: newId(), text: a, correct: true }));
      if (opts.length) fresh.options = [...opts, { id: newId(), text: "", correct: false }];
    }
    return { ...fresh, ...base } as Question;
  }
  return { ...blank("MATCHING"), ...base } as Question;
}

export function QuizEditor({
  topicId,
  initialQuestions,
  initialSettings,
  hasAttempts,
}: {
  topicId: string;
  initialQuestions: Question[];
  initialSettings: QuizSettings;
  hasAttempts: boolean;
}) {
  const [state, formAction, pending] = useActionState<QuizSaveState, FormData>(
    saveQuizAction,
    {},
  );
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [mode, setMode] = useState<"form" | "text">(
    initialQuestions.length === 0 ? "text" : "form",
  );
  const [text, setText] = useState(() => quizToText(initialQuestions));
  const [textErrors, setTextErrors] = useState<{ line: number; message: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const savedRef = useRef(state);

  // после успешного сохранения изменения больше не «несохранённые»
  useEffect(() => {
    if (state !== savedRef.current && state.ok) setDirty(false);
    savedRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next: Question[]) => {
    setQuestions(next);
    setDirty(true);
  };
  const patch = (index: number, q: Question) =>
    update(questions.map((item, i) => (i === index ? q : item)));

  const preview = useMemo(() => (mode === "text" ? parseQuizText(text) : null), [mode, text]);

  const toForm = () => {
    const parsed = parseQuizText(text);
    setTextErrors(parsed.errors);
    if (parsed.errors.length > 0) return;
    setQuestions(parsed.questions);
    setMode("form");
  };
  const toText = () => {
    setText(quizToText(questions));
    setTextErrors([]);
    setMode("text");
  };

  // В текстовом режиме перед отправкой разбираем текст: сохраняется всегда
  // одно и то же — список вопросов.
  const submitQuestions =
    mode === "text" && preview && preview.errors.length === 0 ? preview.questions : questions;
  const blockedByText = mode === "text" && (preview?.errors.length ?? 0) > 0;

  const total = submitQuestions.reduce((s, q) => s + q.points, 0);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      onChange={() => setDirty(true)}
    >
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="questions" value={JSON.stringify(submitQuestions)} />

      <section className="flex flex-col gap-4 rounded border border-line bg-surface px-5 py-4">
        <h2 className="font-semibold">Настройки</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Попыток" hint="Аннулированная попытка не считается">
            <Input
              name="maxAttempts"
              type="number"
              min={1}
              max={10}
              defaultValue={initialSettings.maxAttempts}
            />
          </Field>
          <Field label="Время, минут" hint="Пусто — без ограничения">
            <Input
              name="timeLimitMin"
              type="number"
              min={1}
              max={300}
              defaultValue={initialSettings.timeLimitMin ?? ""}
            />
          </Field>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isOpen"
                defaultChecked={initialSettings.isOpen}
                className="size-4 accent-brand"
              />
              <span className="font-medium">Тест открыт студентам</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="showScore"
                defaultChecked={initialSettings.showScore}
                className="size-4 accent-brand"
              />
              <span>Показывать студенту баллы после сдачи</span>
            </label>
          </div>
        </div>
        <p className="text-xs text-muted">
          Студенты видят тест только в открытой им теме и только когда стоит галочка
          «открыт». Верные ответы студентам не показываются.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Вопросы</h2>
          <span className="text-sm text-muted">
            {submitQuestions.length} вопр. · {total} балл.
          </span>
          <div className="ml-auto flex overflow-hidden rounded border border-line text-sm">
            <button
              type="button"
              onClick={() => mode === "text" && toForm()}
              className={cn(
                "px-3 py-1.5",
                mode === "form" ? "bg-brand-soft font-medium text-brand" : "text-muted hover:text-ink",
              )}
            >
              Формой
            </button>
            <button
              type="button"
              onClick={() => mode === "form" && toText()}
              className={cn(
                "border-l border-line px-3 py-1.5",
                mode === "text" ? "bg-brand-soft font-medium text-brand" : "text-muted hover:text-ink",
              )}
            >
              Текстом
            </button>
          </div>
        </div>

        {hasAttempts ? (
          <p className="text-xs text-muted">
            Тест уже проходили. Правка вопросов не изменит уже начатые и сданные попытки —
            каждая проверяется по тем вопросам, с которыми её начали.
          </p>
        ) : null}

        {mode === "text" ? (
          <TextMode
            text={text}
            onChange={(v) => {
              setText(v);
              setDirty(true);
              setTextErrors([]);
            }}
            errors={textErrors.length ? textErrors : (preview?.errors ?? [])}
            count={preview?.questions.length ?? 0}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {questions.length === 0 ? (
              <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                Вопросов пока нет. Добавьте кнопкой ниже или вставьте тест целиком во вкладке
                «Текстом».
              </p>
            ) : null}

            {questions.map((q, index) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={index}
                count={questions.length}
                onChange={(next) => patch(index, next)}
                onMove={(dir) => {
                  const j = index + dir;
                  if (j < 0 || j >= questions.length) return;
                  const next = [...questions];
                  [next[index], next[j]] = [next[j], next[index]];
                  update(next);
                }}
                onRemove={() => update(questions.filter((_, i) => i !== index))}
              />
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Добавить вопрос:</span>
              {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="ghost"
                  className="px-3 py-1.5"
                  onClick={() => update([...questions, blank(t)])}
                >
                  + {QUESTION_TYPE_LABEL[t]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </section>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && !dirty ? <Alert tone="ok">{state.ok}</Alert> : null}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-1 py-3 backdrop-blur">
        <Button type="submit" disabled={pending || blockedByText}>
          {pending ? "Сохраняем…" : "Сохранить тест"}
        </Button>
        {blockedByText ? (
          <span className="text-sm text-warn">Сначала исправьте ошибки в тексте</span>
        ) : dirty ? (
          <span className="text-sm text-muted">Есть несохранённые изменения</span>
        ) : null}
      </div>
    </form>
  );
}

function TextMode({
  text,
  onChange,
  errors,
  count,
}: {
  text: string;
  onChange: (v: string) => void;
  errors: { line: number; message: string }[];
  count: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-2">
        <Textarea
          rows={22}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={TEXT_FORMAT_HELP}
          spellCheck={false}
          aria-label="Тест текстом"
        />
        {errors.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded bg-warn-soft px-3 py-2 text-sm text-warn">
            {errors.slice(0, 12).map((e, i) => (
              <li key={i}>
                {e.line > 0 ? <span className="font-mono">стр. {e.line}: </span> : null}
                {e.message}
              </li>
            ))}
          </ul>
        ) : text.trim() ? (
          <p className="text-sm text-ok">Распознано вопросов: {count}</p>
        ) : null}
      </div>

      <aside className="flex flex-col gap-2 text-sm text-muted">
        <p className="font-medium text-ink">Как набирать</p>
        <ul className="flex flex-col gap-1.5">
          <li>
            <code className="font-mono text-ink">1.</code> — начало вопроса (номер можно не
            ставить, если между вопросами пустая строка)
          </li>
          <li>
            <code className="font-mono text-ink">+</code> верный вариант,{" "}
            <code className="font-mono text-ink">-</code> неверный. Несколько «+» — несколько
            верных
          </li>
          <li>
            <code className="font-mono text-ink">=</code> короткий ответ. Можно несколько строк —
            варианты написания. Регистр и ё/е не важны
          </li>
          <li>
            <code className="font-mono text-ink">лево -&gt; право</code> — пара для
            сопоставления
          </li>
          <li>
            <code className="font-mono text-ink">[2]</code> в конце вопроса — 2 балла вместо 1
          </li>
        </ul>
        {!text.trim() ? (
          <button
            type="button"
            onClick={() => onChange(TEXT_FORMAT_HELP)}
            className="self-start text-brand underline underline-offset-4"
          >
            Вставить пример
          </button>
        ) : null}
      </aside>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  q: Question;
  index: number;
  count: number;
  onChange: (q: Question) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const problem = validateQuestion(q);
  const small = "rounded px-1.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-25";

  return (
    <div className="flex flex-col gap-3 rounded border border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted">{index + 1}.</span>
        <div className="w-52">
          <Select
            value={q.type}
            onChange={(e) => onChange(convert(q, e.target.value as QuestionType))}
            aria-label="Тип вопроса"
          >
            {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <span className="inline-block w-16">
            <Input
              type="number"
              min={1}
              max={100}
              value={q.points}
              onChange={(e) => onChange({ ...q, points: Number(e.target.value) || 1 })}
              aria-label="Баллы"
            />
          </span>
          балл.
        </label>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className={small} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Выше">
            ↑
          </button>
          <button type="button" className={small} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Ниже">
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-2 text-sm text-muted underline-offset-4 hover:text-warn hover:underline"
          >
            Удалить
          </button>
        </div>
      </div>

      <textarea
        value={q.text}
        onChange={(e) => onChange({ ...q, text: e.target.value })}
        rows={2}
        placeholder="Текст вопроса"
        className="w-full rounded border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand sm:text-sm"
      />

      {q.type === "SINGLE" || q.type === "MULTIPLE" ? (
        <div className="flex flex-col gap-1.5">
          {q.options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <input
                type={q.type === "SINGLE" ? "radio" : "checkbox"}
                checked={o.correct}
                name={`correct-${q.id}`}
                onChange={(e) =>
                  onChange({
                    ...q,
                    options: q.options.map((x, j) =>
                      q.type === "SINGLE"
                        ? { ...x, correct: j === i }
                        : j === i
                          ? { ...x, correct: e.target.checked }
                          : x,
                    ),
                  })
                }
                className="size-4 shrink-0 accent-brand"
                aria-label="Верный"
                title="Верный вариант"
              />
              <Input
                value={o.text}
                onChange={(e) =>
                  onChange({
                    ...q,
                    options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                  })
                }
                placeholder={`Вариант ${i + 1}`}
              />
              <RemoveButton
                disabled={q.options.length <= 2}
                onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <AddLink onClick={() => onChange({ ...q, options: [...q.options, { id: newId(), text: "", correct: false }] })}>
            + вариант
          </AddLink>
          <p className="text-xs text-muted">Отметьте {q.type === "SINGLE" ? "верный вариант" : "все верные варианты"}.</p>
        </div>
      ) : null}

      {q.type === "TEXT" ? (
        <div className="flex flex-col gap-1.5">
          {q.answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={a}
                onChange={(e) =>
                  onChange({ ...q, answers: q.answers.map((x, j) => (j === i ? e.target.value : x)) })
                }
                placeholder={i === 0 ? "Верный ответ" : "Другой вариант написания"}
              />
              <RemoveButton
                disabled={q.answers.length <= 1}
                onClick={() => onChange({ ...q, answers: q.answers.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <AddLink onClick={() => onChange({ ...q, answers: [...q.answers, ""] })}>+ вариант написания</AddLink>
          <p className="text-xs text-muted">Регистр, ё/е, лишние пробелы и точка в конце не учитываются.</p>
        </div>
      ) : null}

      {q.type === "MATCHING" ? (
        <div className="flex flex-col gap-1.5">
          {q.pairs.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <Input
                value={p.left}
                onChange={(e) =>
                  onChange({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })
                }
                placeholder="Слева"
              />
              <span className="text-muted">→</span>
              <Input
                value={p.right}
                onChange={(e) =>
                  onChange({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })
                }
                placeholder="Справа"
              />
              <RemoveButton
                disabled={q.pairs.length <= 2}
                onClick={() => onChange({ ...q, pairs: q.pairs.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <AddLink onClick={() => onChange({ ...q, pairs: [...q.pairs, { id: newId(), left: "", right: "" }] })}>
            + пара
          </AddLink>
          <p className="text-xs text-muted">Студент увидит правые части перемешанными.</p>
        </div>
      ) : null}

      {problem ? <p className="text-sm text-warn">{problem}</p> : null}
    </div>
  );
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Убрать"
      className="shrink-0 rounded px-2 py-1 text-muted hover:bg-canvas hover:text-warn disabled:opacity-25"
    >
      ×
    </button>
  );
}

function AddLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-sm text-brand underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}
