"use client";

import { useState, type ComponentType } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { Button } from "@/components/ui/button";

type InstitutionBranding = {
  primaryColor?: string | null;
  logoUrl?: string | null;
};

type RoleShellProps<P extends object = Record<string, never>> = {
  Sidebar: ComponentType<P>;
  /** Passed to Sidebar — e.g. `{ institutionName }` from getUserIdentity(). */
  sidebarProps?: P;
  title?: string;
  branding?: InstitutionBranding;
  children: React.ReactNode;
};

export function RoleShell<P extends object = Record<string, never>>({
  Sidebar,
  sidebarProps,
  title,
  branding,
  children,
}: RoleShellProps<P>) {
  const [navOpen, setNavOpen] = useState(false);
  const props = (sidebarProps ?? {}) as P;
  const primaryColor = branding?.primaryColor?.trim() || "#0f172a";
  const logoUrl = branding?.logoUrl?.trim() || null;

  const closeNav = () => setNavOpen(false);

  const BrandMark = (
    <div className="flex items-center gap-2 min-w-0">
      {logoUrl ? (
        <div className="h-11 w-11 shrink-0 rounded-xl border border-border/70 bg-card p-1 shadow-sm">
          <Image
            src={logoUrl}
            alt="Institution logo"
            width={40}
            height={40}
            unoptimized
            className="h-full w-full rounded-lg object-cover"
          />
        </div>
      ) : (
        <div
          className="h-11 w-11 shrink-0 rounded-xl text-white text-sm font-semibold flex items-center justify-center shadow-sm"
          style={{ backgroundColor: "var(--brand-primary)" }}
          aria-hidden
        >
          N
        </div>
      )}
      <div className={cn("text-sm font-semibold truncate")}>{title ?? "Neon"}</div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-background"
      style={{ ["--brand-primary" as string]: primaryColor }}
    >
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-3">
        {BrandMark}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? "Close menu" : "Open menu"}
        >
          {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </header>

      {navOpen ? (
        <button
          className="fixed inset-0 z-40 bg-black/40"
          onClick={closeNav}
          aria-label="Close menu overlay"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card flex flex-col min-h-screen transition-transform duration-200",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 shrink-0 border-b border-border px-4 flex items-center">
          {BrandMark}
        </div>
        <div className="flex-1 flex flex-col min-h-0" onClick={closeNav}>
          <Sidebar {...props} />
        </div>
      </aside>

      <main className="p-4 sm:p-5 md:p-6">{children}</main>
      <FeedbackWidget />
    </div>
  );
}
