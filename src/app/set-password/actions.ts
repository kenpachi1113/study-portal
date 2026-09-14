"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession, startSession } from "@/lib/session";
import { hashPassword, validatePassword } from "@/lib/password";
import { audit } from "@/lib/audit";

export type SetPasswordState = { error?: string };

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const session = await readSession();
  if (!session) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password !== repeat) return { error: "Пароли не совпадают" };

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: {
      passwordHash: await hashPassword(password),
      mustSetPassword: false,
      // код сгорает: второй раз им не войти
      loginCodeHash: null,
      loginCodeExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    },
    select: { id: true, role: true, subgroupId: true },
  });

  // сессию переподписываем: в старом токене mustSetPassword всё ещё true,
  // и proxy будет возвращать на эту же страницу по кругу
  await startSession({
    sub: user.id,
    role: user.role,
    subgroupId: user.subgroupId,
    mustSetPassword: false,
  });

  await audit({
    actorId: user.id,
    action: "user.setPassword",
    entity: "User",
    entityId: user.id,
  });

  redirect(user.role === "STUDENT" ? "/study" : "/admin");
}
