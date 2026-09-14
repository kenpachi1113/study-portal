import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles = {
    primary: "bg-brand text-white hover:bg-brand/90",
    ghost: "border border-line bg-surface text-ink hover:bg-canvas",
    danger: "border border-warn/40 bg-warn-soft text-warn hover:bg-warn/10",
  } as const;
  return <button className={cn(base, styles[variant], className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-brand",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded border border-line bg-surface px-3 py-2 font-mono text-sm leading-6 outline-none placeholder:text-muted/70 focus:border-brand",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Card({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded border border-line bg-surface">
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-0.5">
            {title ? <h2 className="font-semibold">{title}</h2> : null}
            {description ? (
              <p className="text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Alert({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "ok";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded px-3 py-2 text-sm",
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok",
      )}
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}
