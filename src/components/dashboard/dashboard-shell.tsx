"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboardIcon,
  UsersIcon,
  GraduationCapIcon,
  CreditCardIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
  BookOpenIcon,
  ClipboardListIcon,
  LibraryIcon,
  MessageSquareIcon,
  CalendarDaysIcon,
  TrendingUpIcon,
  FileTextIcon,
  ClipboardCheckIcon,
  BellIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FeatureGate, type GatedFeature } from "@/components/dashboard/feature-gate";
import { cn } from "@/lib/utils";
import { useNotifications, useUnreadCount, markNotificationRead, invalidateNotifications } from "@/hooks/use-notifications";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

type DashboardRole = "student" | "tutor" | "headmaster";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: GatedFeature;
};

/** Shown only after student is assigned to a cohort. */
const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/learn", label: "Learn", icon: LibraryIcon },
  { href: "/dashboard/learn/progress", label: "My Progress", icon: TrendingUpIcon },
  { href: "/dashboard/results", label: "Results", icon: ClipboardListIcon },
  { href: "/dashboard/reports", label: "Reports", icon: FileTextIcon },
  { href: "/dashboard/community", label: "Community", icon: MessageSquareIcon, feature: "community" },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDaysIcon, feature: "timetable" },
  { href: "/dashboard/mobile-setup", label: "Add to Phone", icon: SmartphoneIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

/** Shown when student has no cohort yet — Learn / Community / etc. appear after assignment. */
const STUDENT_NAV_PENDING: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/mobile-setup", label: "Add to Phone", icon: SmartphoneIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

const TUTOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/materials", label: "Materials", icon: BookOpenIcon },
  { href: "/dashboard/quizzes", label: "Quizzes", icon: ClipboardListIcon },
  { href: "/dashboard/results", label: "Results", icon: TrendingUpIcon },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheckIcon },
  { href: "/dashboard/reports", label: "Reports", icon: FileTextIcon },
  { href: "/dashboard/community", label: "Community", icon: MessageSquareIcon, feature: "community" },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDaysIcon, feature: "timetable" },
];

const HEADMASTER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/cohorts", label: "Cohorts", icon: GraduationCapIcon },
  { href: "/dashboard/staff", label: "Staff", icon: UsersIcon },
  { href: "/dashboard/materials", label: "Materials", icon: BookOpenIcon },
  { href: "/dashboard/quizzes", label: "Quizzes", icon: ClipboardListIcon },
  { href: "/dashboard/results", label: "Results", icon: TrendingUpIcon },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheckIcon },
  { href: "/dashboard/reports", label: "Reports", icon: FileTextIcon },
  { href: "/dashboard/community", label: "Community", icon: MessageSquareIcon, feature: "community" },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCardIcon, feature: "billing" },
  { href: "/dashboard/pricing", label: "Pricing Guide", icon: TrendingUpIcon },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDaysIcon, feature: "timetable" },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

/** Shown while auth/profile role is still resolving — avoids flashing “pending student” nav. */
const NAV_LOADING_PLACEHOLDER: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
];

function useCohortName(cohortId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["cohort-name", cohortId ?? ""],
    queryFn: async (): Promise<string | null> => {
      if (!cohortId) return null;
      const { data, error } = await supabase
        .from("cohorts")
        .select("name")
        .eq("id", cohortId)
        .maybeSingle();
      if (error) throw error;
      return (data?.name as string | undefined) ?? null;
    },
    enabled: !!cohortId,
    staleTime: 30_000,
  });
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { data } = useProfile();
  const [online, setOnline] = useState<boolean | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const update = () => setOnline(navigator.onLine);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }
  }, []);

  const userId = data?.user?.id ?? null;
  const { data: notifications } = useNotifications(userId);
  const { data: unreadCount } = useUnreadCount(userId);
  const profileId = data?.profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          invalidateNotifications(queryClient, userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  // Keep sidebar/profile state in sync when the user's profile changes (e.g. cohort assignment).
  useEffect(() => {
    if (!profileId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("profiles-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);

  const institutionName =
    (data?.institution?.name as string) ?? "Institution";
  const primaryColor = (data?.institution as { primary_color?: string } | undefined)?.primary_color ?? "#0f172a";
  const logoUrl = (data?.institution as { logo_url?: string } | undefined)?.logo_url;

  const role = (data?.profile?.role ?? data?.user?.user_metadata?.role) as DashboardRole | "admin" | undefined;
  const cohortId = (data?.profile?.cohort_id ?? null) as string | null;
  const { data: cohortName } = useCohortName(role === "student" ? cohortId : null);

  const nav = useMemo((): NavItem[] => {
    if (!role) return NAV_LOADING_PLACEHOLDER;
    if (role === "student") return cohortId ? STUDENT_NAV : STUDENT_NAV_PENDING;
    if (role === "tutor") return TUTOR_NAV;
    if (role === "headmaster") return HEADMASTER_NAV;
    return NAV_LOADING_PLACEHOLDER;
  }, [role, cohortId]);

  return (
    <div
      className="flex min-h-screen bg-background"
      style={{ ["--primary-brand" as string]: primaryColor } as React.CSSProperties}
    >
      <aside
        className="flex flex-col border-r border-border bg-card w-56 shrink-0"
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Institution logo"
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{institutionName}</div>
            {role === "student" ? (
              <div className="truncate text-xs text-muted-foreground">
                {cohortName ? `Cohort: ${cohortName}` : "Cohort: —"}
              </div>
            ) : null}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map((item) => {
            const gate = item.feature;
            const content = (
              <>
                {(() => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-[var(--primary-brand,#0f172a)] text-white dark:bg-[var(--primary-brand,#0f172a)] dark:text-white"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })()}
              </>
            );
            if (gate) {
              return (
                <FeatureGate key={item.href} feature={gate} fallback={null}>
                  {content}
                </FeatureGate>
              );
            }
            return <div key={item.href}>{content}</div>;
          })}
        </nav>
        <div className="border-t border-border p-2">
          <div className="px-2 pb-2">
            <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start relative">
                  <BellIcon className="size-4 mr-2" />
                  <span>Notifications</span>
                  {!!unreadCount && unreadCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] min-w-5 h-5 px-1">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                  <DialogDescription>Recent alerts and reminders.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {!notifications?.length ? (
                    <p className="text-sm text-muted-foreground">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2",
                          n.is_read ? "opacity-70" : "border-primary/30"
                        )}
                        onClick={async () => {
                          try {
                            if (!n.is_read) await markNotificationRead(n.id);
                          } finally {
                            setNotifOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{n.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground",
              online === false && "text-amber-600 dark:text-amber-400"
            )}
          >
            {online === false ? (
              <WifiOffIcon className="size-4 shrink-0" />
            ) : (
              <WifiIcon className="size-4 shrink-0" />
            )}
            <span>
              {online === null
                ? "Checking…"
                : online
                ? "Online"
                : "Offline Cache"}
            </span>
          </div>
          <div className="mt-1 px-2">
            <ThemeToggle />
            <div className="h-2" />
            <LogoutButton variant="ghost" size="sm" className="w-full justify-start" />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
