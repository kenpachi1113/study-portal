import { redirect } from "next/navigation";

// Дисциплин в интерфейсе больше нет — остались общие настройки оценок.
export default function CourseSettingsRedirect() {
  redirect("/admin/grading");
}
