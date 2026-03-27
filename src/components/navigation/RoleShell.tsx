"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

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
  const props = (sidebarProps ?? {}) as P;
  const primaryColor = branding?.primaryColor?.trim() || "#0f172a";
  const logoUrl = branding?.logoUrl?.trim() || null;
  return (
    <div
      className="flex min-h-screen bg-background"
      style={{ ["--brand-primary" as string]: primaryColor }}
    >
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col min-h-screen">
        <div className="h-14 shrink-0 border-b border-border px-4 flex items-center">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Institution logo"
                className="h-7 w-7 rounded object-contain border border-border bg-white"
              />
            ) : (
              <div
                className="h-7 w-7 rounded text-white text-[10px] font-semibold flex items-center justify-center"
                style={{ backgroundColor: "var(--brand-primary)" }}
                aria-hidden
              >
                N
              </div>
            )}
            <div className={cn("text-sm font-semibold truncate")}>{title ?? "Neon"}</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <Sidebar {...props} />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
      <FeedbackWidget />
    </div>
  );
}
