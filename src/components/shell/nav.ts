import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Receipt,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type ShellRole = "admin" | "headmaster" | "tutor" | "student";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar (max four per role). */
  mobile?: boolean;
  /** Students only see it once they're in a cohort. */
  needsCohort?: boolean;
};

export const NAV: Record<ShellRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, mobile: true },
    { href: "/admin/leads", label: "Leads", icon: Inbox, mobile: true },
    { href: "/admin/billing", label: "Billing", icon: Receipt, mobile: true },
    { href: "/admin/feedback", label: "Feedback", icon: MessageSquare, mobile: true },
  ],
  headmaster: [
    { href: "/headmaster", label: "Overview", icon: Home, mobile: true },
    { href: "/headmaster/staff", label: "People", icon: Users, mobile: true },
    { href: "/headmaster/cohorts", label: "Cohorts", icon: UsersRound },
    { href: "/headmaster/timetable", label: "Timetable", icon: CalendarDays },
    { href: "/headmaster/payments", label: "Fees", icon: CreditCard, mobile: true },
    { href: "/headmaster/results", label: "Results", icon: BarChart3 },
    { href: "/headmaster/reports", label: "Reports", icon: FileText },
    { href: "/headmaster/pricing", label: "Plan", icon: Sparkles },
    { href: "/headmaster/settings", label: "Settings", icon: Settings, mobile: true },
  ],
  tutor: [
    { href: "/tutor", label: "Today", icon: Home, mobile: true },
    { href: "/tutor/attendance", label: "Attendance", icon: ClipboardCheck, mobile: true },
    { href: "/tutor/cohorts", label: "Cohorts", icon: UsersRound },
    { href: "/tutor/subjects", label: "Materials", icon: BookOpen, mobile: true },
    { href: "/tutor/quizzes", label: "Quizzes", icon: ListChecks },
    { href: "/tutor/results", label: "Results", icon: BarChart3 },
    { href: "/tutor/reports", label: "Reports", icon: FileText },
    { href: "/tutor/timetable", label: "Timetable", icon: CalendarDays, mobile: true },
    { href: "/tutor/community", label: "Community", icon: MessageSquare },
    { href: "/tutor/settings", label: "Settings", icon: Settings },
  ],
  student: [
    { href: "/student", label: "Home", icon: Home, mobile: true },
    { href: "/student/learn", label: "Learn", icon: GraduationCap, mobile: true, needsCohort: true },
    { href: "/student/timetable", label: "Timetable", icon: CalendarDays, mobile: true, needsCohort: true },
    { href: "/student/results", label: "Results", icon: BarChart3, needsCohort: true },
    { href: "/student/community", label: "Community", icon: MessageSquare, mobile: true, needsCohort: true },
    { href: "/student/mobile-setup", label: "Install app", icon: Smartphone },
    { href: "/student/settings", label: "Settings", icon: Settings },
  ],
};

export const ROLE_LABEL: Record<ShellRole, string> = {
  admin: "Platform admin",
  headmaster: "Headmaster",
  tutor: "Tutor",
  student: "Student",
};

export function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}
