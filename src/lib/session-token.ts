import { SignJWT, jwtVerify } from "jose";

/**
 * Подпись и проверка сессионного токена. Только jose — файл обязан оставаться
 * edge-совместимым, потому что его импортирует middleware.
 * Ничего из next/headers и никакого доступа к базе здесь быть не должно.
 */

export const SESSION_COOKIE = "sp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export type SessionPayload = {
  sub: string; // user.id
  role: "TEACHER" | "STUDENT" | "OBSERVER";
  subgroupId: string | null;
  mustSetPassword: boolean;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET не задан или короче 32 символов. Сгенерируйте: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as SessionPayload["role"],
      subgroupId: (payload.subgroupId as string | null) ?? null,
      mustSetPassword: Boolean(payload.mustSetPassword),
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
