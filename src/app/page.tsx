import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.mustSetPassword) redirect("/set-password");
  redirect(session.role === "STUDENT" ? "/study" : "/admin");
}
