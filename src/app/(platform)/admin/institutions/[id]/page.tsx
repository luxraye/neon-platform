import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstitutionDetailClient } from "./institution-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminInstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: inst } = await admin
    .from("institutions")
    .select("id, name, subdomain, subscription_tier, is_trial, trial_ends_at, created_at, logo_url, primary_color")
    .eq("id", id)
    .single();

  if (!inst) notFound();

  const { count: studentCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("institution_id", id)
    .eq("role", "student");

  const { count: tutorCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("institution_id", id)
    .eq("role", "tutor");

  const { data: headmaster } = await admin
    .from("profiles")
    .select("id, email, full_name, created_at")
    .eq("institution_id", id)
    .eq("role", "headmaster")
    .maybeSingle();

  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, name, created_at")
    .eq("institution_id", id)
    .order("created_at", { ascending: false });

  const { data: recentPayments } = await admin
    .from("cash_payments")
    .select("id, student_id, amount, paid_at")
    .eq("institution_id", id)
    .order("paid_at", { ascending: false })
    .limit(10);

  const studentIds = [...new Set((recentPayments ?? []).map((p) => p.student_id))];
  const { data: payers } =
    studentIds.length > 0
      ? await admin.from("profiles").select("id, full_name, email").in("id", studentIds)
      : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const payersMap = Object.fromEntries((payers ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">← Dashboard</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{inst.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">{inst.subdomain}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="capitalize">{inst.subscription_tier}</p>
            {inst.is_trial && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Trial ends {inst.trial_ends_at ? new Date(inst.trial_ends_at).toLocaleDateString() : "—"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{studentCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tutors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{tutorCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cohorts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{cohorts?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Headmaster</CardTitle>
          <CardDescription>Primary contact for this institution</CardDescription>
        </CardHeader>
        <CardContent>
          {headmaster ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium">{headmaster.full_name || "—"}</span>
              <span className="text-muted-foreground">{headmaster.email}</span>
              <span className="text-muted-foreground">
                Joined {new Date(headmaster.created_at).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground">No headmaster assigned.</p>
          )}
        </CardContent>
      </Card>

      {cohorts && cohorts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohorts</CardTitle>
            <CardDescription>Classes at this institution</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
          <CardDescription>Last 10 cash payments recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments && recentPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {payersMap[p.student_id]?.full_name || payersMap[p.student_id]?.email || "—"}
                    </TableCell>
                    <TableCell>P{p.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No payments recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <InstitutionDetailClient
        institutionId={id}
        institutionName={inst.name}
        subscriptionTier={inst.subscription_tier}
        isTrial={inst.is_trial}
        trialEndsAt={inst.trial_ends_at}
      />
    </div>
  );
}
