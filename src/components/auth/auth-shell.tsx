import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * Split-screen layout for sign-in, join and contact pages: brand panel on the left
 * (hidden on phones), the form on the right.
 */
export function AuthShell({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute -bottom-40 -left-40 size-[28rem] rounded-full bg-primary/40 blur-3xl" aria-hidden />
        <Link href="/" className="relative" aria-label="Neon home">
          <Logo tone="light" />
        </Link>
        <div className="relative max-w-md space-y-4">
          {aside ?? (
            <>
              <p className="text-3xl font-extrabold leading-tight">
                Your centre&apos;s classes, students and fees, <span className="text-neon">in one place</span>.
              </p>
              <p className="text-white/60">Sign in on any phone or computer. Your data stays with your centre.</p>
            </>
          )}
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Neon</p>
      </div>

      <div className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="mb-10 lg:hidden" aria-label="Neon home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-sm text-muted-foreground">{subtitle}</div> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
