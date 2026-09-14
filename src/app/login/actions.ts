"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/session";
import {
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  lockUntil,
  verifyLoginCode,
  verifyPassword,
} from "@/lib/password";

export type LoginState = { error?: string };

/**
 * Один вход на два случая: обычный пароль и одноразовый код первого входа.
 * Студенту не нужно понимать разницу — поле одно.
 *
 * Ошибка всегда одинаковая, независимо от того, нет такого логина или неверный
 * пароль: иначе форма превращается в способ проверить, кто заведён в системе.
 */
const GENERIC_ERROR = "Неверный логин или пароль";

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const secret = String(formData.get("secret") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!login || !secret) return { error: "Заполните оба поля" };

  const user = await prisma.user.findUnique({ where: { login } });

  if (!user || !user.isActive) return { error: GENERIC_ERROR };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      error: `Слишком много попыток. Вход заблокирован на ${LOCK_MINUTES} минут — подойдите к преподавателю, он сбросит доступ.`,
    };
  }

  const byPassword = await verifyPassword(secret, user.passwordHash);

  const codeStillValid =
    Boolean(user.loginCodeHash) &&
    Boolean(user.loginCodeExpiresAt) &&
    user.loginCodeExpiresAt! > new Date();
  const byCode = codeStillValid && verifyLoginCode(secret, user.loginCodeHash);

  if (!byPassword && !byCode) {
    const attempts = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? lockUntil() : null,
      },
    });
    return { error: GENERIC_ERROR };
  }

  // вход по коду всегда ведёт на смену пароля, даже если пароль уже был задан
  const mustSetPassword = byCode || user.mustSetPassword;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      mustSetPassword,
    },
  });

  await startSession({
    sub: user.id,
    role: user.role,
    subgroupId: user.subgroupId,
    mustSetPassword,
  });

  if (mustSetPassword) redirect("/set-password");
  if (next.startsWith("/")) redirect(next);
  redirect(user.role === "STUDENT" ? "/study" : "/admin");
}
