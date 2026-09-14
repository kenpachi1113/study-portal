"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmUploadAction, signUploadAction } from "./actions";
import { Alert, Button } from "@/components/ui";

/**
 * Загрузка идёт браузер → R2 напрямую, минуя наш сервер: на Vercel тело
 * запроса к функции ограничено 4.5 МБ, а презентация с картинками весит
 * втрое больше. Сервер участвует двумя маленькими вызовами — подписать
 * ссылку и подтвердить, что файл долетел.
 *
 * XHR вместо fetch ради полосы прогресса: 30 МБ по колледжскому Wi-Fi
 * заливаются достаточно долго, чтобы без неё казалось, что всё зависло.
 */
function uploadToStorage(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              xhr.status === 0
                ? "Хранилище не приняло запрос. Скорее всего в бакете R2 не настроен CORS на этот домен."
                : `Хранилище ответило ${xhr.status}`,
            ),
          );

    xhr.onerror = () =>
      reject(
        new Error(
          "Не удалось достучаться до хранилища. Проверьте CORS у бакета R2.",
        ),
      );

    xhr.send(file);
  });
}

export function MaterialUploader({
  topicId,
  maxBytes,
}: {
  topicId: string;
  maxBytes: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    for (const file of Array.from(files)) {
      setCurrent(file.name);
      setProgress(0);

      const signed = await signUploadAction({
        topicId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });

      if (!signed.ok) {
        setError(`${file.name}: ${signed.error}`);
        break;
      }

      try {
        await uploadToStorage(signed.url, file, setProgress);
      } catch (e) {
        setError(
          `${file.name}: ${e instanceof Error ? e.message : "ошибка загрузки"}`,
        );
        break;
      }

      const confirmed = await confirmUploadAction({
        topicId,
        key: signed.key,
        fileName: file.name,
      });

      if (!confirmed.ok) {
        setError(`${file.name}: ${confirmed.error}`);
        break;
      }
    }

    setProgress(null);
    setCurrent(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Загружаем…" : "Добавить файлы"}
        </Button>
        <span className="text-xs text-muted">
          до {Math.round(maxBytes / 1024 / 1024)} МБ на файл
        </span>
      </div>

      {busy ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-muted">
            <span className="truncate">{current}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded bg-canvas">
            <div
              className="h-full bg-brand transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
