import { redirect } from "next/navigation";

// Раздела «Курсы» больше нет: темы живут в «Занятиях», шкала и правило
// пересдачи — в «Настройках оценок».
export default function CoursesRedirect() {
  redirect("/admin/lessons");
}
