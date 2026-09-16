/**
 * Правила журнала в одном месте — интерфейс и подсчёты должны считать
 * одинаково, иначе в таблице одно, а в сводке другое.
 */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type FinalGradeRule = "LAST" | "BEST";

export const ATTENDANCE_MARK: Record<AttendanceStatus, string> = {
  PRESENT: "",
  ABSENT: "н",
  LATE: "о",
  EXCUSED: "у",
};

export const ATTENDANCE_TITLE: Record<AttendanceStatus, string> = {
  PRESENT: "был",
  ABSENT: "не был",
  LATE: "опоздал",
  EXCUSED: "по уважительной",
};

/**
 * Разбор того, что преподаватель набрал в ячейке.
 *
 * Одна ячейка принимает и оценку, и отметку посещаемости: за пару
 * выставляется либо одно, либо другое, и разносить это по двум таблицам
 * значит удваивать работу на каждой паре.
 */
export type CellInput =
  | { kind: "empty" }
  | { kind: "grade"; value: number }
  | { kind: "attendance"; status: AttendanceStatus }
  | { kind: "invalid" };

export function parseCell(raw: string, maxGrade: number): CellInput {
  const value = raw.trim().toLowerCase();
  if (!value) return { kind: "empty" };

  // латинская n — та же «н», просто не переключили раскладку
  if (value === "н" || value === "n") return { kind: "attendance", status: "ABSENT" };
  if (value === "о" || value === "o") return { kind: "attendance", status: "LATE" };
  if (value === "у" || value === "u") return { kind: "attendance", status: "EXCUSED" };
  if (value === "+") return { kind: "attendance", status: "PRESENT" };

  if (/^\d{1,3}$/.test(value)) {
    const grade = Number(value);
    if (grade >= 1 && grade <= maxGrade) return { kind: "grade", value: grade };
    return { kind: "invalid" };
  }

  return { kind: "invalid" };
}

export type GradeAttempt = { value: number; attempt: number };

/** Итоговая оценка за занятие по правилу дисциплины. */
export function finalGrade(
  attempts: GradeAttempt[],
  rule: FinalGradeRule,
): number | null {
  if (attempts.length === 0) return null;
  if (rule === "BEST") {
    return attempts.reduce((best, a) => (a.value > best ? a.value : best), 0);
  }
  return attempts.reduce((last, a) =>
    a.attempt > last.attempt ? a : last,
  ).value;
}

/**
 * Средний балл: по итоговым оценкам, пропуски не участвуют.
 * Пропуск — это не двойка, у него свой счётчик.
 */
export function averageGrade(finals: (number | null)[]): number | null {
  const values = finals.filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function isFailing(value: number, maxGrade: number): boolean {
  if (maxGrade === 5) return value <= 2;
  if (maxGrade === 12) return value <= 3;
  return value < maxGrade * 0.6;
}
