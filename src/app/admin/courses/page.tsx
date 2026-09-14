import { redirect } from "next/navigation";

// Раздела «Курсы» больше нет: всё живёт в «Занятиях», а настройки
// дисциплины — на её собственной странице.
export default function CoursesRedirect() {
  redirect("/admin/lessons");
}
