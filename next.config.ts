import type { NextConfig } from "next";

/**
 * Домены, с которых портал разрешено открывать помимо localhost.
 *
 * Нужно для туннеля: dev-сервер крутится на localhost, а студенты заходят
 * по адресу вида https://что-то.trycloudflare.com. Без этих двух настроек
 * страницы откроются, но всё интерактивное молча перестанет работать —
 * вход, сохранение темы, ячейки журнала.
 *
 * Свои адреса (например, домен на боевом сервере) дописываются сюда же
 * через переменную EXTRA_ORIGINS, через запятую.
 */
const TUNNEL_ORIGINS = ["*.trycloudflare.com", "*.loca.lt", "*.ngrok-free.app"];

const extra = (process.env.EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowed = [...TUNNEL_ORIGINS, ...extra];

const nextConfig: NextConfig = {
  // доступ к ресурсам dev-сервера с чужого домена
  allowedDevOrigins: allowed,

  experimental: {
    serverActions: {
      // защита от CSRF: Next сверяет origin запроса с хостом,
      // и без этого списка все формы отвечают отказом
      allowedOrigins: allowed,
    },
  },
};

export default nextConfig;
