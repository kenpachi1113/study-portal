import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export type CurrentUser = {
  id: string;
  login: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  role: "TEACHER" | "STUDENT" | "OBSERVER";
  subgroupId: string | null;
  mustSetPassword: boolean;
};

/**
 * Кто сейчас в запросе. Читает куку и обязательно перепроверяет пользователя
 * в базе: роль, подгруппа и активность могли измениться после выдачи токена,
 * а токен живёт неделю.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.sub, isActive: true },
    select: {
      id: true,
      login: true,
      lastName: true,
      firstName: true,
      middleName: true,
      role: true,
      subgroupId: true,
      mustSetPassword: true,
    },
  });

  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await getCurrentUser();

  // Кука есть, а пользователя нет: базу пересоздали, аккаунт удалили или
  // студента отчислили. Отправлять на /login нельзя — proxy увидит ту же
  // куку и вернёт сюда же. Идём через /logout, он куку стирает.
  if (!user) redirect("/logout");

  if (user.mustSetPassword) redirect("/set-password");
  return user;
}

export async function requireTeacher(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "TEACHER") redirect("/study");
  return user;
}

export async function requireStudent(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "STUDENT" || !user.subgroupId) redirect("/admin");
  return user;
}

export function fullName(u: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}): string {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ");
}

export function shortName(u: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}): string {
  const initials = [u.firstName, u.middleName]
    .filter(Boolean)
    .map((n) => `${String(n).charAt(0)}.`)
    .join(" ");
  return `${u.lastName} ${initials}`.trim();
}
