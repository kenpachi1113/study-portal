import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Любая правка, которую потом придётся объяснять, пишется сюда.
 * Особенно оценки задним числом — вопрос «кто поставил и когда» возникает
 * ровно один раз за семестр, но возникает.
 */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
        after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
      },
    });
  } catch {
    // журнал аудита не должен ронять основную операцию
  }
}
