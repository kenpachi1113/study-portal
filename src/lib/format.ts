/**
 * Даты в интерфейсе — день, без времени: расписание в колледже живёт парами,
 * а не минутами. Хранится всё равно DateTime, поэтому граница дня задаётся
 * явно: открытие в начале суток, закрытие в конце.
 */

const dayFormat = new Intl.DateTimeFormat("ru", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDay(date: Date | null | undefined): string {
  return date ? dayFormat.format(date) : "—";
}

/** Значение для <input type="date"> */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function parseDayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseDayEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T23:59:59.999Z`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export const TOPIC_TYPE_LABEL: Record<"LECTURE" | "PRACTICE", string> = {
  LECTURE: "Лекция",
  PRACTICE: "Практическая",
};
