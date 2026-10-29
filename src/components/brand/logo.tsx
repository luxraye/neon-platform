import { cn } from "@/lib/utils";

/** The Neon mark: a single-stroke "N" in neon lime on ink. */
export function LogoMark({ className, title = "Neon" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("size-8 shrink-0", className)} role="img" aria-label={title}>
      <rect width="512" height="512" rx="120" fill="#0e1024" />
      <path
        d="M156 360V152l200 208V152"
        fill="none"
        stroke="#c6f432"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span
        className={cn(
          "text-lg font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground"
        )}
      >
        neon
      </span>
    </span>
  );
}
