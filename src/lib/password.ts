import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

/**
 * bcryptjs — чистый JS, без нативных бинарников: одинаково собирается
 * на Windows локально и на Vercel. Cost 10 — компромисс между стойкостью
 * и временем ответа на serverless (~300 мс на один вход).
 */
const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Коды первого входа хешируются НЕ bcrypt, а HMAC-SHA256.
 *
 * Причина практическая: импорт подгруппы — это 25-30 кодов за один запрос,
 * а bcrypt на каждый добавляет ~300 мс, и Server Action упирается в таймаут.
 * Причина по существу: код — случайный токен на 30 бит с временем жизни две
 * недели, а не выбранный человеком пароль; медленный хеш защищает от перебора
 * по словарю, которого здесь просто нет.
 */
function hmac(value: string): Buffer {
  return createHmac("sha256", requireEnv("AUTH_SECRET")).update(value).digest();
}

export function hashLoginCode(code: string): string {
  return hmac(code.toUpperCase()).toString("hex");
}

export function verifyLoginCode(
  code: string,
  hash: string | null | undefined,
): boolean {
  if (!hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = hmac(code.toUpperCase());
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Без 0/O/1/I/L — их путают, когда диктуешь код вслух на паре. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateLoginCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export const LOGIN_CODE_TTL_DAYS = 14;

export function loginCodeExpiry(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + LOGIN_CODE_TTL_DAYS);
  return d;
}

/** Требования к паролю студента: намеренно мягкие, но не пустые. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Пароль должен быть не короче 8 символов";
  if (!/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(password)) return "Добавьте хотя бы одну букву";
  if (!/\d/.test(password)) return "Добавьте хотя бы одну цифру";
  return null;
}

// ── защита от перебора ────────────────────────────────────────────────
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function lockUntil(from = new Date()): Date {
  return new Date(from.getTime() + LOCK_MINUTES * 60_000);
}
