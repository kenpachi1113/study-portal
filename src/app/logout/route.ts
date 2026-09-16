import { NextResponse } from "next/server";
import { endSession } from "@/lib/session";

/**
 * Выход и аварийный сброс протухшей сессии.
 *
 * Нужен именно маршрутом, а не действием на странице: куку нельзя изменить
 * во время рендера серверного компонента. Без этого получалась петля —
 * proxy видит валидную куку и пускает в /admin, страница не находит
 * пользователя в базе и шлёт на /login, proxy снова видит куку и шлёт
 * обратно. Так бывает после пересоздания базы или отчисления студента.
 */
export async function GET(request: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
