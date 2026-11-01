"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Theme switch with no theme-dependent markup: both icons are always rendered and CSS
 * (the `dark` class next-themes puts on <html>) decides which one shows. The server and the
 * first client render are identical, which ends the hydration error from the incident report.
 */
export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Switch between light and dark theme"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10",
        className
      )}
    >
      <Moon className="size-4 shrink-0 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 shrink-0 dark:block" aria-hidden />
      {label ? <span>Theme</span> : null}
    </button>
  );
}
