import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";
import { getCohorts } from "@/app/dashboard/cohorts/actions";
import { getStaff } from "@/app/dashboard/staff/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function pathFor(role: string, target: string) {
  // target keys correspond to existing legacy dashboard pages; map to new role prefixes.
  if (role === "headmaster") {
    const map: Record<string, string> = {
      staff: "/headmaster/staff",
      payments: "/headmaster/payments",
      cohorts: "/headmaster/cohorts",
      settings: "/headmaster/settings",
    };
    return map[target] ?? "/headmaster";
  }
  if (role === "tutor") {
    const map: Record<string, string> = {
      timetable: "/tutor/timetable",
      quizzes: "/tutor/quizzes",
    };
    return map[target] ?? "/tutor";
  }
  // student
  const map: Record<string, string> = {
    timetable: "/student/timetable",
    learn: "/student/learn",
    mobile: "/student/mobile-setup",
  };
  return map[target] ?? "/student";
}

export default async function RoleOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, cohort_id, institution_id")
    .eq("id", user!.id)
    .maybeSingle();

  const identity = await getUserIdentity();
  const institutionId = identity?.institution_id ?? profile?.institution_id ?? null;
  const role =
    ((identity?.role ?? profile?.role ?? user?.user_metadata?.role ?? "—") as string | null)?.toLowerCase() ??
    "—";
  const isStudentPending = role === "student" && profile && profile.cohort_id == null;

  let institutionName: string | null = null;
  if (institutionId) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();
    institutionName = inst?.name ?? null;
  }

  if (isStudentPending) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">Pending Assignment</CardTitle>
            <CardDescription>Welcome to {institutionName ?? "your institution"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Your registration is successful. A tutor or headmaster will assign you to your class/cohort soon.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Once you&apos;re assigned to a cohort</strong>, learning and community tools will appear in your
              sidebar.
            </p>
            <p className="text-sm text-muted-foreground">
              Until then, you can use <strong>Mobile Setup</strong> to install Neon on your phone.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={pathFor("student", "mobile")}>Mobile Setup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student assigned overview (keep content; links point to new student routes)
  if (role === "student" && profile?.cohort_id && institutionId) {
    const todayDay = new Date().getDay();
    const { data: todaySlots } = await supabase
      .from("timetables")
      .select("id, subject, start_time, end_time, room")
      .eq("institution_id", institutionId)
      .eq("cohort_id", profile.cohort_id)
      .eq("day_of_week", todayDay)
      .order("start_time")
      .limit(5);

    const { data: latestMaterials } = await supabase
      .from("materials")
      .select("id, title, subject")
      .eq("cohort_id", profile.cohort_id)
      .order("created_at", { ascending: false })
      .limit(3);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-muted-foreground">{profile?.full_name ?? user?.email}</p>
        </div>

        {todaySlots && todaySlots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
              <CardDescription>Your classes for today</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {todaySlots.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.subject}</span>{" "}
                    {typeof s.start_time === "string" && typeof s.end_time === "string"
                      ? `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`
                      : ""}
                    {s.room ? ` · ${s.room}` : ""}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={pathFor("student", "timetable")}>View timetable</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {latestMaterials && latestMaterials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest materials</CardTitle>
              <CardDescription>Recently added for your cohort</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {latestMaterials.map((m) => (
                  <li key={m.id}>
                    <Link href={pathFor("student", "learn")} className="text-primary hover:underline">
                      {m.title}
                    </Link>
                    {m.subject ? ` · ${m.subject}` : ""}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={pathFor("student", "learn")}>Open learning</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Tutor overview (links point to tutor routes)
  if (role === "tutor" && institutionId) {
    const todayDay = new Date().getDay();
    const { data: todaySlots } = await supabase
      .from("timetables")
      .select("id, subject, start_time, end_time")
      .eq("institution_id", institutionId)
      .eq("day_of_week", todayDay)
      .order("start_time");

    const { data: institutionQuizIds } = await supabase
      .from("quizzes")
      .select("id")
      .eq("institution_id", institutionId);
    const quizIds = (institutionQuizIds ?? []).map((q) => q.id);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: pendingCount } = await supabase
      .from("quiz_attempts")
      .select("*", { count: "exact", head: true })
      .in("quiz_id", quizIds.length ? quizIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("submitted_at", sevenDaysAgo);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-muted-foreground">Welcome, {profile?.full_name ?? user?.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s classes</CardTitle>
              <CardDescription>Your schedule for today</CardDescription>
            </CardHeader>
            <CardContent>
              {todaySlots && todaySlots.length > 0 ? (
                <>
                  <ul className="space-y-1 text-sm">
                    {todaySlots.map((s) => (
                      <li key={s.id}>
                        <span className="font-medium">{s.subject}</span>
                        {s.start_time && s.end_time && (
                          <span className="text-muted-foreground">
                            {" "}
                            {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={pathFor("tutor", "timetable")}>Timetable</Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No classes scheduled today.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quiz submissions</CardTitle>
              <CardDescription>Recent activity to review</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {pendingCount != null && pendingCount > 0
                  ? `${pendingCount} submission(s) in the last 7 days.`
                  : "No recent submissions."}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={pathFor("tutor", "quizzes")}>View Quizzes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Headmaster overview (links point to headmaster routes)
  if (role === "headmaster" && institutionId) {
    const instId = institutionId;
    // Same sources as Cohorts + Staff pages (service role + getCohorts/getStaff) so counts stay in sync with RLS.
    const [cohortsList, staffPayload] = await Promise.all([getCohorts(), getStaff("", [])]);
    const cohortCount = cohortsList.length;
    const tutorCount = staffPayload.tutors.length;
    const studentCount = staffPayload.students.length;

    const admin = createServiceRoleClient();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: payments } = await admin
      .from("cash_payments")
      .select("amount")
      .eq("institution_id", instId)
      .gte("paid_at", startOfMonth.toISOString());
    const revenueThisMonth = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);

    // Keep the same fee heuristic as the Payments page (no invoicing table yet).
    const MONTHLY_FEE_PER_STUDENT = 500;
    const enrolledCount = studentCount;
    const expectedIncomeThisMonth = enrolledCount * MONTHLY_FEE_PER_STUDENT;
    const paymentsDueThisMonth = Math.max(0, expectedIncomeThisMonth - revenueThisMonth);

    // Upcoming timetable slots this week (next 7 days)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayDay = new Date().getDay();
    const { data: timetableSlots } = await admin
      .from("timetables")
      .select("id, subject, start_time, end_time, room, day_of_week, cohort_id")
      .eq("institution_id", instId)
      .order("day_of_week")
      .order("start_time")
      .limit(20);
    const slotsByDay = (timetableSlots ?? []).filter((s) => s.day_of_week != null);
    const nextDays = [0, 1, 2, 3, 4, 5, 6].map((i) => (todayDay + i) % 7);
    const upcomingSlots = nextDays
      .flatMap((d) =>
        slotsByDay
          .filter((s) => s.day_of_week === d)
          .slice(0, 3)
          .map((s) => ({ ...s, dayName: dayNames[d] }))
      )
      .slice(0, 8);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-muted-foreground">Welcome, {profile?.full_name ?? user?.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active students</CardTitle>
              <CardDescription>Enrolled in your centre</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{studentCount}</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={pathFor("headmaster", "staff")}>Staff & Students</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cohorts</CardTitle>
              <CardDescription>Classes available</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{cohortCount ?? 0}</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={pathFor("headmaster", "cohorts")}>Cohorts</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tutors</CardTitle>
              <CardDescription>Staff availability</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{tutorCount ?? 0} tutor(s)</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={pathFor("headmaster", "staff")}>Manage Staff</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="sm:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Payments (this month)</CardTitle>
              <CardDescription>Expected vs received</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Expected income</div>
                <p className="text-2xl font-semibold mt-1">P{expectedIncomeThisMonth.toFixed(2)}</p>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Received</div>
                <p className="text-base font-semibold mt-1">P{revenueThisMonth.toFixed(2)}</p>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Due (expected - received)</div>
                <p className="text-base font-semibold mt-1">P{paymentsDueThisMonth.toFixed(2)}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                <Link href={pathFor("headmaster", "payments")}>Payments</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {upcomingSlots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming this week</CardTitle>
              <CardDescription>Classes across your institution</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {upcomingSlots.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.dayName}</span>{" "}
                    <span className="text-muted-foreground">
                      {typeof s.start_time === "string" && typeof s.end_time === "string"
                        ? `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`
                        : ""}
                    </span>{" "}
                    <span className="font-medium">{s.subject}</span>
                    {s.room ? ` · ${s.room}` : ""}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={pathFor("headmaster", "cohorts")}>Cohorts & Timetable</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="text-muted-foreground">Welcome, {profile?.full_name ?? user?.email}.</p>
      <p className="text-sm text-muted-foreground">Use the sidebar to navigate.</p>
    </div>
  );
}

