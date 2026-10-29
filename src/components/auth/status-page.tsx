import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/** Centred full-page message used for 404, unauthorised and deactivated screens. */
export function StatusPage({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-grid-light flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-10" aria-label="Neon home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl shadow-ink/5">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">{title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
        {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
