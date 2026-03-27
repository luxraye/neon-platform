"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { checkRole } from "@/lib/dashboard-routes";

export function DashboardRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useProfile();
  const role = (data?.profile?.role ?? data?.user?.user_metadata?.role) as string | undefined;

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return;
    if (role === "admin") return; // admins are redirected to /admin in layout
    const allowed = checkRole(pathname, role);
    if (!allowed) {
      toast.error("Unauthorized");
      router.replace("/dashboard");
    }
  }, [pathname, role, router]);

  const allowed = checkRole(pathname ?? "", role);
  if (!allowed && pathname?.startsWith("/dashboard")) {
    return null; // avoid flash of forbidden content while redirecting
  }
  return <>{children}</>;
}
