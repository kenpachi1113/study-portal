"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { recordGrade, sessionForTopic } from "@/lib/grades";
import {
  MAX_QUESTIONS,
  cleanQuestion,
  questionData,
  validateQuestion,
  type Question,
  type QuestionType,
} from "@/lib/quiz";

export type QuizSaveState = { error?: string; ok?: string };

const TYPES: QuestionType[] = ["SINGLE", "MULTIPLE", "TEXT", "MATCHING"];
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const safeId = (v: unknown) =>
  typeof v === "string" && /^[a-z0-9]{4,40}$/i.test(v) ? v : null;

/** Вопрос из JSON формы — всё, что пришло из браузера, перепроверяется. */
function readQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = TYPES.find((t) => t === r.type);
  if (!type) return null;
  const id = safeId(r.id) ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const text = str(r.text, 4000);
  const points = Number(r.points);
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30) : []);

  if (type === "SINGLE" || type === "MULTIPLE")
    return {
      id,
      type,
      text,
      points,
      options: list(r.options).map((o, i) => {
        const x = (o ?? {}) as Record<string, unknown>;
        return { id: safeId(x.id) ?? `o${i}${id}`, text: str(x.text, 1000), correct: x.correct === true };
      }),
    };
  if (type === "TEXT")
    return { id, type, text, points, answers: list(r.answers).map((a) => str(a, 300)) };
  return {
    id,
    type,
    text,
    points,
    pairs: list(r.pairs).map((p, i) => {
      const x = (p ?? {}) as Record<string, unknown>;
      return { id: safeId(x.id) ?? `p${i}${id}`, left: str(x.left, 500), right: str(x.right, 500) };
    }),
  };
}

export async function saveQuizAction(
  _prev: QuizSaveState,
  formData: FormData,
): Promise<QuizSaveState> {
  const teacher = await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!topic) return { error: "Тема не найдена" };

  const isOpen = formData.get("isOpen") === "on";
  const showScore = formData.get("showScore") === "on";
  const maxAttempts = Number(formData.get("maxAttempts") ?? 1);
  const limitRaw = String(formData.get("timeLimitMin") ?? "").trim();
  const timeLimitMin = limitRaw ? Number(limitRaw) : null;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
    return { error: "Попыток — от 1 до 10" };
  if (timeLimitMin !== null && (!Number.isInteger(timeLimitMin) || timeLimitMin < 1 || timeLimitMin > 300))
    return { error: "Время — целое число минут от 1 до 300, или пусто" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "Не удалось прочитать вопросы — обновите страницу" };
  }
  if (!Array.isArray(parsed)) return { error: "Не удалось прочитать вопросы" };
  if (parsed.length > MAX_QUESTIONS) return { error: `Не больше ${MAX_QUESTIONS} вопросов` };

  const questions: Question[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parsed.length; i++) {
    const q = readQuestion(parsed[i]);
    if (!q) return { error: `Вопрос ${i + 1}: непонятный формат` };
    const clean = cleanQuestion(q);
    const problem = validateQuestion(clean);
    if (problem) return { error: `Вопрос ${i + 1}: ${problem}` };
    if (seen.has(clean.id)) clean.id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    seen.add(clean.id);
    questions.push(clean);
  }

  if (isOpen && questions.length === 0)
    return { error: "Нельзя открыть пустой тест — добавьте вопросы" };

  // Вопросы перезаписываются целиком. Уже начатые попытки это не задевает:
  // каждая хранит свой снимок вопросов.
  const quiz = await prisma.$transaction(async (tx) => {
    const saved = await tx.quiz.upsert({
      where: { topicId },
      create: { topicId, isOpen, showScore, maxAttempts, timeLimitMin },
      update: { isOpen, showScore, maxAttempts, timeLimitMin },
    });
    await tx.quizQuestion.deleteMany({ where: { quizId: saved.id } });
    if (questions.length > 0)
      await tx.quizQuestion.createMany({
        data: questions.map((q, order) => ({
          id: q.id,
          quizId: saved.id,
          order,
          type: q.type,
          text: q.text,
          points: q.points,
          data: questionData(q),
        })),
      });
    return saved;
  });

  await audit({
    actorId: teacher.id,
    action: "quiz.save",
    entity: "Quiz",
    entityId: quiz.id,
    after: { topicId, questions: questions.length, isOpen, maxAttempts, timeLimitMin },
  });

  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath(`/admin/topics/${topicId}/test`);
  return { ok: `Сохранено: ${questions.length} вопр.` };
}

// ── подтверждение результатов ─────────────────────────────────────────

export type AttemptActionResult = { ok: true } | { ok: false; error: string };

async function loadAttempt(attemptId: string) {
  return prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { topic: { include: { course: true } } } },
      student: { select: { id: true, subgroupId: true } },
      grade: { select: { id: true } },
    },
  });
}

async function confirmOne(
  attempt: NonNullable<Awaited<ReturnType<typeof loadAttempt>>>,
  value: number,
  teacherId: string,
): Promise<AttemptActionResult> {
  const maxGrade = attempt.quiz.topic.course.maxGrade;
  if (!Number.isInteger(value) || value < 1 || value > maxGrade)
    return { ok: false, error: `Оценка от 1 до ${maxGrade}` };
  if (attempt.status === "IN_PROGRESS") return { ok: false, error: "Тест ещё не отправлен" };
  if (attempt.status === "ANNULLED") return { ok: false, error: "Попытка аннулирована" };
  if (attempt.grade) return { ok: false, error: "Оценка уже в журнале" };
  if (!attempt.student.subgroupId) return { ok: false, error: "Студент не в подгруппе" };

  const session = await sessionForTopic(attempt.quiz.topicId, attempt.student.subgroupId);
  const grade = await recordGrade({
    sessionId: session.id,
    studentId: attempt.studentId,
    value,
    teacherId,
    comment: `Тест, попытка ${attempt.number}`,
  });

  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { status: "CONFIRMED", gradeId: grade.id },
  });

  await audit({
    actorId: teacherId,
    action: grade.attempt > 1 ? "grade.retake" : "grade.set",
    entity: "ClassSession",
    entityId: session.id,
    after: { studentId: attempt.studentId, value, attempt: grade.attempt, quizAttemptId: attempt.id },
  });

  revalidatePath(`/admin/journal/${attempt.student.subgroupId}`);
  return { ok: true };
}

export async function confirmAttemptAction(input: {
  attemptId: string;
  value: number;
}): Promise<AttemptActionResult> {
  const teacher = await requireTeacher();
  const attempt = await loadAttempt(input.attemptId);
  if (!attempt) return { ok: false, error: "Попытка не найдена" };

  const result = await confirmOne(attempt, Number(input.value), teacher.id);
  revalidatePath(`/admin/topics/${attempt.quiz.topicId}/test/results`);
  return result;
}

/**
 * Подтвердить всех разом по предложенным оценкам. Берётся одна попытка на
 * студента — по правилу курса (последняя или лучшая); кому уже выставлено,
 * того не трогаем.
 */
export async function confirmAllAction(input: {
  topicId: string;
  grades: { attemptId: string; value: number }[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const teacher = await requireTeacher();
  let count = 0;
  const errors: string[] = [];

  for (const item of input.grades.slice(0, 500)) {
    const attempt = await loadAttempt(item.attemptId);
    if (!attempt || attempt.quiz.topicId !== input.topicId) continue;
    const r = await confirmOne(attempt, Number(item.value), teacher.id);
    if (r.ok) count++;
    else errors.push(r.error);
  }

  revalidatePath(`/admin/topics/${input.topicId}/test/results`);
  if (count === 0 && errors.length > 0) return { ok: false, error: errors[0] };
  return { ok: true, count };
}

/** Аннулировать попытку: она не считается, и студент может пройти тест заново. */
export async function annulAttemptAction(input: {
  attemptId: string;
}): Promise<AttemptActionResult> {
  const teacher = await requireTeacher();
  const attempt = await loadAttempt(input.attemptId);
  if (!attempt) return { ok: false, error: "Попытка не найдена" };
  if (attempt.grade)
    return { ok: false, error: "Оценка уже в журнале — сначала очистите её там" };

  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { status: "ANNULLED" },
  });

  await audit({
    actorId: teacher.id,
    action: "quiz.annul",
    entity: "QuizAttempt",
    entityId: attempt.id,
    before: { status: attempt.status, score: attempt.score },
  });

  revalidatePath(`/admin/topics/${attempt.quiz.topicId}/test/results`);
  return { ok: true };
}

/** Вернуть аннулированную попытку обратно — на случай промаха кнопкой. */
export async function restoreAttemptAction(input: {
  attemptId: string;
}): Promise<AttemptActionResult> {
  const teacher = await requireTeacher();
  const attempt = await loadAttempt(input.attemptId);
  if (!attempt || attempt.status !== "ANNULLED") return { ok: false, error: "Попытка не найдена" };

  const status = attempt.submittedAt ? "SUBMITTED" : "IN_PROGRESS";
  await prisma.quizAttempt.update({ where: { id: attempt.id }, data: { status } });

  await audit({
    actorId: teacher.id,
    action: "quiz.restore",
    entity: "QuizAttempt",
    entityId: attempt.id,
    after: { status },
  });

  revalidatePath(`/admin/topics/${attempt.quiz.topicId}/test/results`);
  return { ok: true };
}
