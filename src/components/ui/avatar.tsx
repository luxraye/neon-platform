import { cn } from "@/lib/utils";

const TONES = [
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-ink text-neon",
];

export function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Initials in a coloured circle; the colour is stable per person. */
export function Avatar({
  name,
  email,
  seed,
  className,
}: {
  name?: string | null;
  email?: string | null;
  seed?: string;
  className?: string;
}) {
  const key = seed ?? name ?? email ?? "";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        TONES[Math.abs(h) % TONES.length],
        className
      )}
      aria-hidden
    >
      {initialsOf(name, email)}
    </span>
  );
}
