"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseDayEnd, parseDayStart } from "@/lib/format";
import {
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  deleteObject,
  headObject,
  presignUpload,
} from "@/lib/storage";

export type TopicSaveState = { error?: string; ok?: string };

export async function saveTopicAction(
  _prev: TopicSaveState,
  formData: FormData,
): Promise<TopicSaveState> {
  const teacher = await requireTeacher();

  const id = String(formData.get("topicId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const bodyHtml = String(formData.get("bodyHtml") ?? "");
  const taskHtml = String(formData.get("taskHtml") ?? "");
  const maxScoreRaw = String(formData.get("maxScore") ?? "").trim();

  if (!title) return { error: "Название не может быть пустым" };
  if (type !== "LECTURE" && type !== "PRACTICE" && type !== "TEST")
    return { error: "Тип — лекция, практическая или тест" };

  const maxScore = maxScoreRaw ? Number(maxScoreRaw) : null;
  if (maxScore !== null && (!Number.isInteger(maxScore) || maxScore <= 0))
    return { error: "Максимальный балл — целое положительное число" };

  const before = await prisma.topic.findUnique({
    where: { id },
    select: { title: true, type: true },
  });
  if (!before) return { error: "Тема не найдена" };

  await prisma.topic.update({
    where: { id },
    data: {
      title,
      type,
      bodyHtml: bodyHtml.trim() || null,
      taskHtml: taskHtml.trim() || null,
      maxScore,
    },
  });

  await audit({
    actorId: teacher.id,
    action: "topic.update",
    entity: "Topic",
    entityId: id,
    before,
    after: { title, type },
  });

  revalidatePath(`/admin/topics/${id}`);
  return { ok: "Сохранено" };
}

// ── материалы ─────────────────────────────────────────────────────────
//
// Файл никогда не проходит через наш сервер: на Vercel тело запроса к функции
// ограничено 4.5 МБ. Браузер получает подпись, кладёт файл прямо в R2 и
// сообщает ключ; сервер убеждается через HEAD, что файл действительно долетел.

export type SignedUpload =
  | { ok: true; key: string; url: string }
  | { ok: false; error: string };

export async function signUploadAction(input: {
  topicId: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<SignedUpload> {
  await requireTeacher();

  const topic = await prisma.topic.findUnique({
    where: { id: input.topicId },
    select: { id: true },
  });
  if (!topic) return { ok: false, error: "Тема не найдена" };

  if (!input.fileName.trim())
    return { ok: false, error: "У файла нет имени" };

  if (input.size <= 0) return { ok: false, error: "Файл пустой" };
  if (input.size > MAX_UPLOAD_BYTES)
    return {
      ok: false,
      error: `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`,
    };

  // имя файла от пользователя в ключ не попадает — только расширение
  const key = buildStorageKey(`topics/${input.topicId}`, input.fileName);
  const contentType = input.contentType || "application/octet-stream";

  try {
    const url = await presignUpload({ key, contentType });
    return { ok: true, key, url };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Не удалось подписать ссылку на загрузку",
    };
  }
}

export type ConfirmUpload = { ok: true } | { ok: false; error: string };

export async function confirmUploadAction(input: {
  topicId: string;
  key: string;
  fileName: string;
}): Promise<ConfirmUpload> {
  const teacher = await requireTeacher();

  // между PUT и этим вызовом вкладку могли закрыть — проверяем, что файл есть
  const head = await headObject(input.key);
  if (!head) return { ok: false, error: "Файл не долетел до хранилища" };

  await prisma.material.create({
    data: {
      topicId: input.topicId,
      fileName: input.fileName.slice(0, 200),
      storageKey: input.key,
      sizeBytes: head.size,
      mimeType: head.contentType,
    },
  });

  await audit({
    actorId: teacher.id,
    action: "material.upload",
    entity: "Topic",
    entityId: input.topicId,
    after: { fileName: input.fileName, size: head.size },
  });

  revalidatePath(`/admin/topics/${input.topicId}`);
  return { ok: true };
}

export type DeleteMaterialState = { error?: string };

export async function deleteMaterialAction(
  _prev: DeleteMaterialState,
  formData: FormData,
): Promise<DeleteMaterialState> {
  const teacher = await requireTeacher();

  const materialId = String(formData.get("materialId") ?? "");
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) return { error: "Файл не найден" };

  // сначала запись, потом объект: осиротевший файл в R2 безобиден,
  // а запись без файла ломает страницу студенту
  await prisma.material.delete({ where: { id: materialId } });
  try {
    await deleteObject(material.storageKey);
  } catch {
    // не смогли удалить из хранилища — переживём, запись уже убрана
  }

  await audit({
    actorId: teacher.id,
    action: "material.delete",
    entity: "Topic",
    entityId: material.topicId,
    before: { fileName: material.fileName },
  });

  revalidatePath(`/admin/topics/${material.topicId}`);
  return {};
}

// ── выдача доступа ────────────────────────────────────────────────────

export type ReleaseState = { error?: string; ok?: string };

export async function setReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const teacher = await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const subgroupId = String(formData.get("subgroupId") ?? "");
  const opensAtRaw = String(formData.get("opensAt") ?? "");
  const closesAtRaw = String(formData.get("closesAt") ?? "").trim();

  const opensAt = parseDayStart(opensAtRaw);
  if (!opensAt) return { error: "Укажите дату открытия" };

  const closesAt = closesAtRaw ? parseDayEnd(closesAtRaw) : null;
  if (closesAtRaw && !closesAt) return { error: "Непонятная дата закрытия" };
  if (closesAt && closesAt < opensAt)
    return { error: "Закрытие раньше открытия" };

  await prisma.topicRelease.upsert({
    where: { topicId_subgroupId: { topicId, subgroupId } },
    create: { topicId, subgroupId, opensAt, closesAt },
    update: { opensAt, closesAt },
  });

  // Открыли тему подгруппе — значит будет пара. Колонка в журнале появляется
  // сама, чтобы не заводить каждое занятие вторым заходом.
  const session = await prisma.classSession.findFirst({
    where: { topicId, subgroupId },
    include: { _count: { select: { grades: true, attendance: true } } },
  });

  if (!session) {
    await prisma.classSession.create({
      data: { topicId, subgroupId, heldOn: opensAt },
    });
  } else if (
    session._count.grades === 0 &&
    session._count.attendance === 0 &&
    session.heldOn.getTime() !== opensAt.getTime()
  ) {
    // дату двигаем только пока по занятию ничего не проставлено:
    // иначе оценки уехали бы на чужое число
    await prisma.classSession.update({
      where: { id: session.id },
      data: { heldOn: opensAt },
    });
  }

  await audit({
    actorId: teacher.id,
    action: "topic.release",
    entity: "Topic",
    entityId: topicId,
    after: { subgroupId, opensAt, closesAt },
  });

  revalidatePath(`/admin/topics/${topicId}`);
  return { ok: "Открыто" };
}

export async function removeReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const teacher = await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const subgroupId = String(formData.get("subgroupId") ?? "");

  await prisma.topicRelease
    .delete({ where: { topicId_subgroupId: { topicId, subgroupId } } })
    .catch(() => null);

  await audit({
    actorId: teacher.id,
    action: "topic.unrelease",
    entity: "Topic",
    entityId: topicId,
    before: { subgroupId },
  });

  revalidatePath(`/admin/topics/${topicId}`);
  return { ok: "Закрыто" };
}
