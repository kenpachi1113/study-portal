import Link from "next/link";
import { listTopicsForCurrentStudent } from "@/lib/access";
import { TOPIC_TYPE_LABEL, formatDay } from "@/lib/format";
import { Empty, cn } from "@/components/ui";

export default async function StudyPage() {
  const topics = await listTopicsForCurrentStudent();

  if (topics.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Мои занятия</h1>
        <Empty>
          Преподаватель пока не открыл ни одной темы. Как только откроет —
          она появится здесь.
        </Empty>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Мои занятия</h1>

      <ul className="overflow-hidden rounded border border-line bg-surface">
        {topics.map((topic) => {
          const release = topic.releases[0];
          const submission = topic.submissions[0];
          const closesAt = release?.closesAt ?? null;
          const overdue =
            topic.type === "PRACTICE" &&
            closesAt !== null &&
            closesAt < now &&
            submission?.status !== "ACCEPTED";

          return (
            <li key={topic.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/study/${topic.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-canvas"
              >
                <span className="font-medium">{topic.title}</span>

                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs",
                    topic.type === "PRACTICE"
                      ? "bg-brand-soft text-brand"
                      : "bg-canvas text-muted",
                  )}
                >
                  {TOPIC_TYPE_LABEL[topic.type]}
                </span>

                {topic.type === "PRACTICE" ? (
                  <StatusBadge status={submission?.status} overdue={overdue} />
                ) : null}

                {closesAt ? (
                  <span
                    className={cn(
                      "ml-auto font-mono text-xs tabular-nums",
                      overdue ? "text-warn" : "text-muted",
                    )}
                  >
                    до {formatDay(closesAt)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({
  status,
  overdue,
}: {
  status?: "SUBMITTED" | "RETURNED" | "ACCEPTED";
  overdue: boolean;
}) {
  if (status === "ACCEPTED") return <Badge tone="ok">принято</Badge>;
  if (status === "RETURNED") return <Badge tone="warn">на доработку</Badge>;
  if (status === "SUBMITTED") return <Badge tone="muted">на проверке</Badge>;
  return (
    <Badge tone={overdue ? "warn" : "muted"}>
      {overdue ? "просрочено" : "не сдано"}
    </Badge>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-xs",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "muted" && "bg-canvas text-muted",
      )}
    >
      {children}
    </span>
  );
}
