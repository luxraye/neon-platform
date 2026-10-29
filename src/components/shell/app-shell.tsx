"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { NAV, ROLE_LABEL, isActive, type ShellRole } from "@/components/shell/nav";

export type ShellProps = {
  role: ShellRole;
  user: { id: string; name: string | null; email: string | null };
  centre: { name: string | null; logoUrl: string | null; primaryColor: string | null };
  hasCohort?: boolean;
  children: React.ReactNode;
};

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function CentreBadge({ centre }: { centre: ShellProps["centre"] }) {
  if (centre.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote logo from storage
      <img src={centre.logoUrl} alt="" className="size-9 shrink-0 rounded-xl bg-white object-contain p-1" />
    );
  }
  return <LogoMark className="size-9" />;
}

export function AppShell({ role, user, centre, hasCohort = true, children }: ShellProps) {
  const pathname = usePathname() ?? "";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const root = `/${role}`;
  const items = NAV[role].filter((i) => !(i.needsCohort && role === "student" && !hasCohort));
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);
  const current = items.find((i) => isActive(pathname, i.href, root));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const brandStyle = centre.primaryColor
    ? ({ ["--brand-primary" as string]: centre.primaryColor } as React.CSSProperties)
    : undefined;

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <CentreBadge centre={centre} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{centre.name ?? "Neon"}</p>
          <p className="truncate text-xs text-sidebar-muted">{ROLE_LABEL[role]}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
        {items.map((item) => {
          const active = isActive(pathname, item.href, root);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-2 left-0 w-1 rounded-r-full transition-colors",
                  active ? "bg-sidebar-primary" : "bg-transparent"
                )}
                aria-hidden
              />
              <item.icon className={cn("size-[18px]", active ? "text-sidebar-primary" : "")} />
              {item.label}
            </Link>
          );
        })}
        {role === "student" && !hasCohort ? (
          <p className="mx-3 mt-4 rounded-xl border border-sidebar-border p-3 text-xs text-sidebar-muted">
            Learning tools appear here once your centre adds you to a class.
          </p>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <ThemeToggle className="text-sidebar-muted hover:text-white" />
          <LogoutButton
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-sidebar-muted hover:bg-white/10 hover:text-white"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background" style={brandStyle}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Phone drawer */}
      <div
        className={cn("fixed inset-0 z-50 lg:hidden", drawerOpen ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={drawerOpen ? 0 : -1}
          onClick={() => setDrawerOpen(false)}
          className={cn("absolute inset-0 bg-black/50 transition-opacity", drawerOpen ? "opacity-100" : "opacity-0")}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[82%] max-w-xs shadow-2xl transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebar}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-3 top-4 rounded-lg p-1.5 text-sidebar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
            tabIndex={drawerOpen ? 0 : -1}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-lg p-2 hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">
            {current?.label ?? ""}
          </p>
          <NotificationsBell userId={user.id} />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Phone bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Quick"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))` }}>
          {mobileItems.map((item) => {
            const active = isActive(pathname, item.href, root);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <FeedbackWidget />
    </div>
  );
}
