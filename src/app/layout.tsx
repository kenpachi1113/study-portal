import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // масштабирование не запрещаем: студенту может понадобиться
  // приблизить схему или таблицу в лекции
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Учебный портал",
    template: "%s · Учебный портал",
  },
  description: "Лекции, практические и журнал",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
