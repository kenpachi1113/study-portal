"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; ok?: string };

export async function createGroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacher = await requireTeacher();

  const title = String(formData.get("title") ?? "").trim();
  const academicYear = String(formData.get("academicYear") ?? "").trim();
  const subgroupCount = Number(formData.get("subgroupCount") ?? 2);

  if (!title) return { error: "Укажите название группы" };
  if (!/^\d{4}\/\d{4}$/.test(academicYear))
    return { error: "Учебный год в формате 2026/2027" };
  if (!Number.isInteger(subgroupCount) || subgroupCount < 1 || subgroupCount > 6)
    return { error: "Подгрупп может быть от 1 до 6" };

  const exists = await prisma.group.findUnique({
    where: { title_academicYear: { title, academicYear } },
    select: { id: true },
  });
  if (exists) return { error: `Группа ${title} за ${academicYear} уже заведена` };

  const group = await prisma.group.create({
    data: {
      title,
      academicYear,
      subgroups: {
        create: Array.from({ length: subgroupCount }, (_, i) => ({
          title: String(i + 1),
        })),
      },
    },
  });

  await audit({
    actorId: teacher.id,
    action: "group.create",
    entity: "Group",
    entityId: group.id,
    after: { title, academicYear, subgroupCount },
  });

  revalidatePath("/admin/groups");
  return { ok: `Группа ${title} создана, подгрупп: ${subgroupCount}` };
}

export async function addSubgroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacher = await requireTeacher();

  const groupId = String(formData.get("groupId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!groupId || !title) return { error: "Укажите номер подгруппы" };

  const exists = await prisma.subgroup.findUnique({
    where: { groupId_title: { groupId, title } },
    select: { id: true },
  });
  if (exists) return { error: `Подгруппа ${title} уже есть` };

  const subgroup = await prisma.subgroup.create({
    data: { groupId, title },
  });

  await audit({
    actorId: teacher.id,
    action: "subgroup.create",
    entity: "Subgroup",
    entityId: subgroup.id,
    after: { groupId, title },
  });

  revalidatePath("/admin/groups");
  return { ok: `Подгруппа ${title} добавлена` };
}
