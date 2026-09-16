"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

/**
 * Разделы преподавателя. У каждого свой набор «своих» путей: страница темы
 * относится к занятиям, страница подгруппы — к группам, иначе при переходе
 * вглубь подсветка гасла бы и было непонятно, где ты.
 */
const NAV = [
  { href: "/admin", label: "Сводка", owns: [] as string[] },
  {
    href: "/admin/lessons",
    label: "Занятия",
    owns: ["/admin/lessons", "/admin/topics", "/admin/courses", "/admin/grading"],
  },
  {
    href: "/admin/journal",
    label: "Журнал",
    owns: ["/admin/journal"],
  },
  {
    href: "/admin/groups",
    label: "Группы",
    owns: ["/admin/groups", "/admin/subgroups"],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {NAV.map((item) => {
        const active =
          item.owns.length === 0
            ? pathname === item.href
            : item.owns.some(
                (prefix) =>
                  pathname === prefix || pathname.startsWith(`${prefix}/`),
              );

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded px-2.5 py-1 transition",
              active
                ? "bg-brand-soft font-medium text-brand"
                : "text-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
