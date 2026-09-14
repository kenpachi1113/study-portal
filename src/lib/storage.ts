import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { requireEnv } from "@/lib/env";

/**
 * Файлы никогда не проходят через наш API.
 *
 * На Vercel тело запроса к функции ограничено 4.5 МБ — это платформенный
 * лимит, его не поднять настройкой. Презентация с картинками весит 30 МБ,
 * то есть загрузка «браузер → наш API → хранилище» упирается в потолок на
 * первой же реальной лекции.
 *
 * Поэтому: браузер просит подпись → кладёт файл прямо в R2 → сообщает ключ.
 * Сервер видит только два маленьких JSON-запроса.
 */

export const UPLOAD_URL_TTL = 5 * 60; // подпись на загрузку
export const DOWNLOAD_URL_TTL = 5 * 60; // подпись на скачивание
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

function bucket(): string {
  return requireEnv("R2_BUCKET");
}

/** Ключ придумывает сервер: имя файла от пользователя в путь не попадает. */
export function buildStorageKey(prefix: string, fileName: string): string {
  const ext = fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}`
    : "";
  return `${prefix}/${randomUUID()}${ext}`;
}

/** Ссылка, по которой браузер сделает PUT напрямую в R2. */
export async function presignUpload(params: {
  key: string;
  contentType: string;
}): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: params.key,
      ContentType: params.contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL },
  );
}

/**
 * Ссылка на скачивание. Короткая жизнь не случайно: ссылку легко переслать
 * в чат другой подгруппе, и тогда вся система доступа обнуляется.
 */
export async function presignDownload(params: {
  key: string;
  fileName: string;
}): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: params.key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
        params.fileName,
      )}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL },
  );
}

/**
 * Проверка, что файл действительно долетел. Между PUT и подтверждением
 * вкладку могут закрыть — тогда запись в базе создавать нельзя.
 */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await s3().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return {
      size: Number(res.ContentLength ?? 0),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
