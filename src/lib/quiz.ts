/**
 * Тесты: формат вопросов, разбор вставки текстом, проверка ответов и
 * перевод баллов в оценку.
 *
 * Файл общий для браузера и сервера: редактор показывает ошибки разбора
 * сразу, а сервер проверяет то же самое ещё раз перед сохранением —
 * Server Action это публичный эндпоинт, браузеру верить нельзя.
 */

export type QuestionType = "SINGLE" | "MULTIPLE" | "TEXT" | "MATCHING";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: "Один верный",
  MULTIPLE: "Несколько верных",
  TEXT: "Короткий ответ",
  MATCHING: "Сопоставление",
};

export type ChoiceOption = { id: string; text: string; correct: boolean };
export type MatchPair = { id: string; left: string; right: string };

/** Вопрос целиком, вместе с верными ответами. Студенту не отдаётся никогда. */
export type Question =
  | { id: string; type: "SINGLE"; text: string; points: number; options: ChoiceOption[] }
  | { id: string; type: "MULTIPLE"; text: string; points: number; options: ChoiceOption[] }
  | { id: string; type: "TEXT"; text: string; points: number; answers: string[] }
  | { id: string; type: "MATCHING"; text: string; points: number; pairs: MatchPair[] };

/** То, что видит студент: без верных ответов, варианты перемешаны. */
export type PublicQuestion =
  | { id: string; type: "SINGLE"; text: string; points: number; options: { id: string; text: string }[] }
  | {
      id: string;
      type: "MULTIPLE";
      text: string;
      points: number;
      options: { id: string; text: string }[];
    }
  | { id: string; type: "TEXT"; text: string; points: number }
  | {
      id: string;
      type: "MATCHING";
      text: string;
      points: number;
      lefts: { id: string; text: string }[];
      rights: { id: string; text: string }[];
    };

/**
 * Ответ студента на один вопрос:
 *   SINGLE   — id варианта
 *   MULTIPLE — массив id вариантов
 *   TEXT     — строка
 *   MATCHING — { id левой части: id пары, чья правая часть выбрана }
 */
export type AnswerValue = string | string[] | Record<string, string>;
export type Answers = Record<string, AnswerValue>;

export const MAX_POINTS = 100;
export const MAX_QUESTIONS = 200;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ─────────────────────────────────────────────  хранение

/** Что кладётся в колонку data вопроса. */
export function questionData(q: Question): object {
  if (q.type === "SINGLE" || q.type === "MULTIPLE") return { options: q.options };
  if (q.type === "TEXT") return { answers: q.answers };
  return { pairs: q.pairs };
}

/** Обратно из строки базы. Битые данные не роняют страницу — дают пустой вопрос. */
export function questionFromRow(row: {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  data: unknown;
}): Question {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const base = { id: row.id, text: row.text, points: row.points };
  if (row.type === "SINGLE" || row.type === "MULTIPLE") {
    const options = Array.isArray(data.options) ? (data.options as ChoiceOption[]) : [];
    return { ...base, type: row.type, options };
  }
  if (row.type === "TEXT") {
    const answers = Array.isArray(data.answers) ? (data.answers as string[]) : [];
    return { ...base, type: "TEXT", answers };
  }
  const pairs = Array.isArray(data.pairs) ? (data.pairs as MatchPair[]) : [];
  return { ...base, type: "MATCHING", pairs };
}

// ─────────────────────────────────────────────  проверка вопроса

/** Ошибка в вопросе словами для преподавателя или null, если всё в порядке. */
export function validateQuestion(q: Question): string | null {
  if (!q.text.trim()) return "Нет текста вопроса";
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > MAX_POINTS)
    return `Баллы — целое число от 1 до ${MAX_POINTS}`;

  if (q.type === "SINGLE" || q.type === "MULTIPLE") {
    const options = q.options.filter((o) => o.text.trim());
    if (options.length < 2) return "Нужно хотя бы два варианта ответа";
    const correct = options.filter((o) => o.correct).length;
    if (q.type === "SINGLE" && correct !== 1)
      return correct === 0
        ? "Отметьте верный вариант"
        : "Верных вариантов несколько — смените тип на «Несколько верных»";
    if (q.type === "MULTIPLE" && correct === 0) return "Отметьте верные варианты";
    return null;
  }

  if (q.type === "TEXT") {
    if (!q.answers.some((a) => a.trim())) return "Укажите хотя бы один верный ответ";
    return null;
  }

  const pairs = q.pairs.filter((p) => p.left.trim() || p.right.trim());
  if (pairs.length < 2) return "Нужно хотя бы две пары";
  if (pairs.some((p) => !p.left.trim() || !p.right.trim()))
    return "У пары не заполнена одна из сторон";
  const rights = new Set(pairs.map((p) => normalizeText(p.right)));
  if (rights.size !== pairs.length) return "Правые части пар повторяются";
  const lefts = new Set(pairs.map((p) => normalizeText(p.left)));
  if (lefts.size !== pairs.length) return "Левые части пар повторяются";
  return null;
}

/** Убирает пустые варианты и лишние пробелы перед сохранением. */
export function cleanQuestion(q: Question): Question {
  const text = q.text.trim();
  if (q.type === "SINGLE" || q.type === "MULTIPLE")
    return {
      ...q,
      text,
      options: q.options
        .map((o) => ({ ...o, text: o.text.trim() }))
        .filter((o) => o.text),
    };
  if (q.type === "TEXT")
    return { ...q, text, answers: q.answers.map((a) => a.trim()).filter(Boolean) };
  return {
    ...q,
    text,
    pairs: q.pairs
      .map((p) => ({ ...p, left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left || p.right),
  };
}

// ─────────────────────────────────────────────  вставка текстом

export const TEXT_FORMAT_HELP = `1. Какой орган перекачивает кровь?
+ сердце
- печень
- лёгкие

2. Выберите устройства ввода [2]
+ клавиатура
+ мышь
- монитор

3. Единица измерения информации
= бит
= bit

4. Сопоставьте устройство и назначение
Принтер -> вывод на бумагу
Сканер -> ввод изображения
Монитор -> вывод на экран`;

export type ParseResult = {
  questions: Question[];
  errors: { line: number; message: string }[];
};

const NUMBERED = /^\s*\d{1,3}\s*[.)]\s*(.*)$/;
const POINTS = /\s*\[(\d{1,3})\]\s*$/;
const ARROW = /\s*(?:->|→|=>|—>)\s*/;

/**
 * Разбор теста, набранного текстом.
 *
 *   строка с номером «1.» или «1)» — начало вопроса;
 *   «+ текст» — верный вариант, «- текст» — неверный;
 *   «= текст» — верный короткий ответ (вариантов написания может быть несколько);
 *   «лево -> право» — пара для сопоставления;
 *   «[2]» в конце строки вопроса — сколько баллов (по умолчанию 1).
 *
 * Тип вопроса определяется сам: пары — сопоставление, «=» — короткий ответ,
 * один «+» — один верный, несколько «+» — несколько верных.
 * Номер можно не ставить, если вопросы разделены пустой строкой.
 */
export function parseQuizText(source: string): ParseResult {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const questions: Question[] = [];
  const errors: ParseResult["errors"] = [];

  type Draft = {
    line: number;
    textLines: string[];
    points: number;
    options: ChoiceOption[];
    answers: string[];
    pairs: MatchPair[];
  };

  let draft: Draft | null = null;
  let blankBefore = true;

  const start = (line: number, text: string) => {
    flush();
    draft = { line, textLines: [], points: 1, options: [], answers: [], pairs: [] };
    addText(text);
  };

  const addText = (text: string) => {
    if (!draft) return;
    const m = text.match(POINTS);
    if (m) {
      draft.points = Number(m[1]);
      text = text.replace(POINTS, "");
    }
    if (text.trim()) draft.textLines.push(text.trim());
  };

  const hasAnswers = (d: Draft) =>
    d.options.length > 0 || d.answers.length > 0 || d.pairs.length > 0;

  function flush() {
    const d = draft as Draft | null;
    draft = null;
    if (!d) return;
    const text = d.textLines.join("\n");
    const kinds = [d.options.length > 0, d.answers.length > 0, d.pairs.length > 0].filter(
      Boolean,
    ).length;

    if (kinds === 0) {
      errors.push({ line: d.line, message: "У вопроса нет ни вариантов, ни ответа" });
      return;
    }
    if (kinds > 1) {
      errors.push({
        line: d.line,
        message: "В одном вопросе смешаны варианты (+/-), ответы (=) и пары (->)",
      });
      return;
    }

    let q: Question;
    if (d.pairs.length > 0) {
      q = { id: newId(), type: "MATCHING", text, points: d.points, pairs: d.pairs };
    } else if (d.answers.length > 0) {
      q = { id: newId(), type: "TEXT", text, points: d.points, answers: d.answers };
    } else {
      const correct = d.options.filter((o) => o.correct).length;
      q = {
        id: newId(),
        type: correct > 1 ? "MULTIPLE" : "SINGLE",
        text,
        points: d.points,
        options: d.options,
      };
    }

    const problem = validateQuestion(q);
    if (problem) errors.push({ line: d.line, message: problem });
    questions.push(q);
  }

  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();

    if (!line) {
      blankBefore = true;
      return;
    }

    const numbered = raw.match(NUMBERED);
    const marker = line[0];
    const isOption = (marker === "+" || marker === "-" || marker === "*") && line.length > 1;
    const isAnswer = marker === "=" && line.length > 1;
    const isPair = !isOption && !isAnswer && ARROW.test(line);

    if (numbered && !isOption) {
      start(lineNo, numbered[1]);
    } else if (isOption) {
      if (!draft) start(lineNo, "");
      (draft as Draft | null)?.options.push({
        id: newId(),
        text: line.slice(1).trim(),
        correct: marker !== "-",
      });
    } else if (isAnswer) {
      if (!draft) start(lineNo, "");
      (draft as Draft | null)?.answers.push(line.slice(1).trim());
    } else if (isPair && draft && (draft as Draft).textLines.length > 0) {
      const [left, ...rest] = line.split(ARROW);
      (draft as Draft).pairs.push({ id: newId(), left: left.trim(), right: rest.join(" ").trim() });
    } else {
      // обычная строка: продолжение текста вопроса или новый вопрос без номера
      const current = draft as Draft | null;
      if (!current || (blankBefore && hasAnswers(current))) start(lineNo, line);
      else if (hasAnswers(current)) {
        errors.push({ line: lineNo, message: "Непонятная строка среди вариантов ответа" });
      } else addText(line);
    }

    blankBefore = false;
  });

  flush();

  for (const q of questions) {
    if (!q.text.trim()) {
      const idx = questions.indexOf(q);
      errors.push({ line: 0, message: `Вопрос ${idx + 1}: нет текста вопроса` });
    }
  }

  return { questions, errors: errors.sort((a, b) => a.line - b.line) };
}

/** Обратно в текст — чтобы поправить тест в одном окне или скопировать в другой. */
export function quizToText(questions: Question[]): string {
  return questions
    .map((q, i) => {
      const head = `${i + 1}. ${q.text}${q.points !== 1 ? ` [${q.points}]` : ""}`;
      let body: string[];
      if (q.type === "SINGLE" || q.type === "MULTIPLE")
        body = q.options.map((o) => `${o.correct ? "+" : "-"} ${o.text}`);
      else if (q.type === "TEXT") body = q.answers.map((a) => `= ${a}`);
      else body = q.pairs.map((p) => `${p.left} -> ${p.right}`);
      return [head, ...body].join("\n");
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────  студенту

/** Детерминированное перемешивание: при перезагрузке страницы порядок тот же. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function toPublic(questions: Question[], seed: string): PublicQuestion[] {
  return questions.map((q) => {
    if (q.type === "SINGLE" || q.type === "MULTIPLE")
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        options: seededShuffle(
          q.options.map((o) => ({ id: o.id, text: o.text })),
          seed + q.id,
        ),
      };
    if (q.type === "TEXT") return { id: q.id, type: "TEXT", text: q.text, points: q.points };
    return {
      id: q.id,
      type: "MATCHING",
      text: q.text,
      points: q.points,
      lefts: q.pairs.map((p) => ({ id: p.id, text: p.left })),
      rights: seededShuffle(
        q.pairs.map((p) => ({ id: p.id, text: p.right })),
        seed + q.id + "r",
      ),
    };
  });
}

// ─────────────────────────────────────────────  проверка ответов

/** Сравнение коротких ответов: регистр, ё/е, лишние пробелы и точка в конце не важны. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .replace(/[.!;:\s]+$/g, "")
    .trim();
}

export type QuestionResult = {
  questionId: string;
  earned: number;
  points: number;
  /** полностью / частично / неверно / без ответа */
  verdict: "correct" | "partial" | "wrong" | "empty";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreQuestion(q: Question, answer: AnswerValue | undefined): QuestionResult {
  const result = (earned: number, empty = false): QuestionResult => ({
    questionId: q.id,
    earned: round2(earned),
    points: q.points,
    verdict: empty
      ? "empty"
      : earned >= q.points
        ? "correct"
        : earned > 0
          ? "partial"
          : "wrong",
  });

  if (q.type === "SINGLE") {
    if (typeof answer !== "string" || !answer) return result(0, true);
    const chosen = q.options.find((o) => o.id === answer);
    return result(chosen?.correct ? q.points : 0);
  }

  if (q.type === "MULTIPLE") {
    const chosen = Array.isArray(answer) ? new Set(answer) : new Set<string>();
    if (chosen.size === 0) return result(0, true);
    const total = q.options.filter((o) => o.correct).length;
    let right = 0;
    let wrong = 0;
    for (const o of q.options) {
      if (!chosen.has(o.id)) continue;
      if (o.correct) right++;
      else wrong++;
    }
    // каждый лишний вариант снимает столько же, сколько даёт верный:
    // иначе «отметить всё» всегда давало бы полный балл
    const share = total === 0 ? 0 : Math.max(0, (right - wrong) / total);
    return result(q.points * share);
  }

  if (q.type === "TEXT") {
    if (typeof answer !== "string" || !answer.trim()) return result(0, true);
    const given = normalizeText(answer);
    const ok = q.answers.some((a) => normalizeText(a) === given);
    return result(ok ? q.points : 0);
  }

  const map =
    answer && typeof answer === "object" && !Array.isArray(answer)
      ? (answer as Record<string, string>)
      : {};
  const filled = q.pairs.filter((p) => map[p.id]).length;
  if (filled === 0) return result(0, true);
  const right = q.pairs.filter((p) => map[p.id] === p.id).length;
  return result(q.pairs.length === 0 ? 0 : (q.points * right) / q.pairs.length);
}

export function scoreAttempt(questions: Question[], answers: Answers) {
  const results = questions.map((q) => scoreQuestion(q, answers[q.id]));
  const score = round2(results.reduce((s, r) => s + r.earned, 0));
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  return { results, score, maxScore };
}

/**
 * Предлагаемая оценка по доле набранных баллов. Преподаватель её видит и
 * может поправить перед тем, как она уйдёт в журнал.
 *
 * Для зачёта (шкала 1) незачёт возвращается как null: в журнале зачёт — это
 * единица, а «не зачтено» отдельной оценкой не хранится.
 */
export function suggestGrade(score: number, maxScore: number, maxGrade: number): number | null {
  if (maxScore <= 0) return null;
  const share = score / maxScore;
  if (maxGrade === 5) {
    if (share >= 0.9) return 5;
    if (share >= 0.75) return 4;
    if (share >= 0.6) return 3;
    return 2;
  }
  if (maxGrade === 1) return share >= 0.6 ? 1 : null;
  return Math.min(maxGrade, Math.max(1, Math.round(share * maxGrade)));
}

export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "").replace(".", ",");
}

/** Разбирает ответы из JSON формы, отбрасывая всё, что не похоже на ответ. */
export function sanitizeAnswers(input: unknown, questions: Question[]): Answers {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Answers = {};
  for (const q of questions) {
    const value = raw[q.id];
    if (q.type === "SINGLE" && typeof value === "string") out[q.id] = value.slice(0, 64);
    else if (q.type === "MULTIPLE" && Array.isArray(value))
      out[q.id] = value.filter((v): v is string => typeof v === "string").slice(0, 50);
    else if (q.type === "TEXT" && typeof value === "string") out[q.id] = value.slice(0, 500);
    else if (q.type === "MATCHING" && value && typeof value === "object" && !Array.isArray(value)) {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>))
        if (typeof v === "string") map[k.slice(0, 64)] = v.slice(0, 64);
      out[q.id] = map;
    }
  }
  return out;
}
