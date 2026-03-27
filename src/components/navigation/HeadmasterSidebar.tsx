"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const items = [
  { href: "/headmaster", label: "Overview" },
  { href: "/headmaster/staff", label: "Staff" },
  { href: "/headmaster/cohorts", label: "Cohorts" },
  { href: "/headmaster/payments", label: "Payments" },
  { href: "/headmaster/pricing", label: "Pricing Guide" },
  { href: "/headmaster/settings", label: "Settings" },
];

export type HeadmasterSidebarProps = {
  institutionName?: string | null;
};

export default function HeadmasterSidebar({ institutionName }: HeadmasterSidebarProps) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      {institutionName ? (
        <p className="px-3 pt-2 text-xs text-muted-foreground truncate" title={institutionName}>
          {institutionName}
        </p>
      ) : null}
      <nav className="p-2 space-y-1 flex-1">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <ThemeToggle />
        <LogoutButton variant="ghost" size="sm" className="w-full justify-start" />
      </div>
    </div>
  );
}

