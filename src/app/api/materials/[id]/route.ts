import { NextResponse } from "next/server";
import {
  NotFoundError,
  UnauthorizedError,
  getMaterialForCurrentUser,
} from "@/lib/access";
import { presignDownload } from "@/lib/storage";

/**
 * Единственный путь к файлу.
 *
 * Права проверяются здесь, ДО того как появится подписанная ссылка: сама
 * ссылка живёт отдельно от сессии — кто её получил, тот и скачал. Поэтому
 * она и живёт пять минут: переслать в чат другой подгруппе можно, но к паре
 * она уже протухнет.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const material = await getMaterialForCurrentUser(id);
    const url = await presignDownload({
      key: material.storageKey,
      fileName: material.fileName,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (error instanceof NotFoundError) {
      return new NextResponse("Не найдено", { status: 404 });
    }
    return new NextResponse("Хранилище недоступно", { status: 502 });
  }
}
