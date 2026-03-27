"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="p-2 space-y-1">
      {items.map((i) => {
        const active =
          i.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/institutions/")
            : pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

