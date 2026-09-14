"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher, fullName } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  generateLoginCode,
  hashLoginCode,
  loginCodeExpiry,
} from "@/lib/password";
import { parseNameLine, uniqueLogin } from "@/lib/translit";

export type IssuedAccess = {
  fullName: string;
  login: string;
  code: string;
};

export type ImportState = {
  error?: string;
  created?: IssuedAccess[];
  skipped?: string[];
};

/**
 * Массовое заведение студентов из списка ФИО.
 *
 * Коды возвращаются в открытом виде РОВНО ОДИН РАЗ — в ответе этого вызова.
 * В базе лежит только хеш, второй раз показать код невозможно: если список
 * потерялся, преподаватель выдаёт новый код кнопкой в строке студента.
 */
export async function importStudentsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const teacher = await requireTeacher();

  const subgroupId = String(formData.get("subgroupId") ?? "");
  const raw = String(formData.get("names") ?? "");

  const subgroup = await prisma.subgroup.findUnique({
    where: { id: subgroupId },
    select: { id: true },
  });
  if (!subgroup) return { error: "Подгруппа не найдена" };

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: "Список пустой" };
  if (lines.length > 100)
    return { error: "За один раз не больше 100 человек" };

  const skipped: string[] = [];
  const parsed = lines.flatMap((line) => {
    const name = parseNameLine(line);
    if (!name) {
      skipped.push(line);
      return [];
    }
    return [name];
  });

  if (parsed.length === 0)
    return { error: "Ни одной строки не разобрать. Формат: Фамилия Имя Отчество", skipped };

  // логины должны быть уникальны глобально, поэтому берём все существующие
  const existing = await prisma.user.findMany({ select: { login: true } });
  const taken = new Set(existing.map((u) => u.login));

  const expiresAt = loginCodeExpiry();

  const rows = parsed.map((name) => {
    const login = uniqueLogin(name, taken);
    const code = generateLoginCode();
    return {
      name,
      login,
      code,
      data: {
        login,
        lastName: name.lastName,
        firstName: name.firstName,
        middleName: name.middleName ?? null,
        role: "STUDENT" as const,
        subgroupId,
        mustSetPassword: true,
        loginCodeHash: hashLoginCode(code),
        loginCodeExpiresAt: expiresAt,
      },
    };
  });

  await prisma.user.createMany({ data: rows.map((r) => r.data) });

  await audit({
    actorId: teacher.id,
    action: "student.import",
    entity: "Subgroup",
    entityId: subgroupId,
    after: { count: rows.length, logins: rows.map((r) => r.login) },
  });

  revalidatePath(`/admin/subgroups/${subgroupId}`);

  return {
    created: rows.map((r) => ({
      fullName: fullName(r.name),
      login: r.login,
      code: r.code,
    })),
    skipped,
  };
}

export type ResetState = { error?: string; issued?: IssuedAccess };

/**
 * Забытый пароль. Почты в системе нет, поэтому восстановление — только так:
 * преподаватель жмёт кнопку, называет код, студент заходит и задаёт пароль.
 */
export async function resetAccessAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const teacher = await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      login: true,
      lastName: true,
      firstName: true,
      middleName: true,
      role: true,
      subgroupId: true,
    },
  });

  if (!student || student.role !== "STUDENT")
    return { error: "Студент не найден" };

  const code = generateLoginCode();

  await prisma.user.update({
    where: { id: student.id },
    data: {
      passwordHash: null,
      mustSetPassword: true,
      loginCodeHash: hashLoginCode(code),
      loginCodeExpiresAt: loginCodeExpiry(),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  await audit({
    actorId: teacher.id,
    action: "student.resetAccess",
    entity: "User",
    entityId: student.id,
  });

  if (student.subgroupId) revalidatePath(`/admin/subgroups/${student.subgroupId}`);

  return {
    issued: {
      fullName: fullName(student),
      login: student.login,
      code,
    },
  };
}

export type ToggleState = { error?: string };

/**
 * Отчисленный студент выключается, а не удаляется: его оценки и посещаемость
 * остаются в журнале, иначе картина семестра рассыплется.
 */
export async function toggleActiveAction(
  _prev: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  const teacher = await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, isActive: true, role: true, subgroupId: true },
  });
  if (!student || student.role !== "STUDENT")
    return { error: "Студент не найден" };

  await prisma.user.update({
    where: { id: student.id },
    data: { isActive: !student.isActive },
  });

  await audit({
    actorId: teacher.id,
    action: student.isActive ? "student.deactivate" : "student.activate",
    entity: "User",
    entityId: student.id,
  });

  if (student.subgroupId) revalidatePath(`/admin/subgroups/${student.subgroupId}`);
  return {};
}
