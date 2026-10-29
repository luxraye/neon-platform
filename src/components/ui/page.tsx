import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Consistent page title row: title, one-line description and optional actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "warning" | "success";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-2xl border border-border bg-card p-5 transition-shadow",
        href && "hover:shadow-md",
        tone === "primary" && "border-transparent bg-ink text-white dark:bg-secondary"
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-medium", tone === "primary" ? "text-white/70" : "text-muted-foreground")}>{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4",
              tone === "primary" && "text-neon",
              tone === "warning" && "text-warning",
              tone === "success" && "text-success",
              tone === "default" && "text-muted-foreground"
            )}
          />
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
      {hint ? (
        <p className={cn("mt-1 text-xs", tone === "primary" ? "text-white/60" : "text-muted-foreground")}>{hint}</p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={cn(title ? "p-5" : "p-5")}>{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
      {children} <ArrowRight className="size-3" />
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center", className)}>
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="mt-3 font-bold">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "neon";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "default" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-secondary text-secondary-foreground",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "neon" && "bg-neon text-neon-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
