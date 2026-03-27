"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Icon-only theme control — never render “Light mode” / “Dark mode” text in the DOM.
 * Those strings caused SSR vs client hydration mismatches with next-themes (resolvedTheme).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot; keeps first server+client paint identical
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  // Mounted guard: avoid any "Light"/"Dark" strings in the DOM until hydrated (next-themes mismatch).
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("w-full justify-start gap-2", className)}
      onClick={() => setTheme(next)}
      disabled={!mounted}
      aria-label="Toggle color theme"
      suppressHydrationWarning
    >
      {!mounted ? (
        <Sun className="size-4 shrink-0 opacity-40" aria-hidden />
      ) : isDark ? (
        <Sun className="size-4 shrink-0" aria-hidden />
      ) : (
        <Moon className="size-4 shrink-0" aria-hidden />
      )}
    </Button>
  );
}
