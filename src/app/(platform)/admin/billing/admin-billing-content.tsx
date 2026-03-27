"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTieredMonthlyDue, getTierBaseFee, PER_STUDENT_FEE } from "@/lib/billing";
import { PLATFORM_PAYMENT_LIFECYCLE } from "@/lib/platform-payments";

type InstRow = { id: string; name: string; subscription_tier: string };
type ReportRow = {
  id: string;
  institution_id: string;
  report_month: string;
  student_count: number;
  total_revenue_due: number;
  status: string;
};

export function AdminBillingContent({
  institutions,
  studentCounts,
  financialReports,
  instByName,
}: {
  institutions: InstRow[];
  studentCounts: Record<string, number>;
  financialReports: ReportRow[];
  instByName: Record<string, string>;
}) {
  const router = useRouter();
  const [reportLoading, setReportLoading] = useState(false);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    const { generateMonthlyReport } = await import("../actions");
    const result = await generateMonthlyReport();
    setReportLoading(false);
    if (result.success) {
      toast.success("Monthly report generated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg">Billing (Base tier + ${PER_STUDENT_FEE}/student)</CardTitle>
            <CardDescription>Current month snapshot</CardDescription>
          </div>
          <Button onClick={handleGenerateReport} disabled={reportLoading}>
            {reportLoading ? "Generating…" : "Generate monthly report"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Base fee</TableHead>
                <TableHead>Per student (${PER_STUDENT_FEE})</TableHead>
                <TableHead>Total due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No institutions.
                  </TableCell>
                </TableRow>
              ) : (
                institutions.map((inst) => {
                  const students = studentCounts[inst.id] ?? 0;
                  const base = getTierBaseFee(inst.subscription_tier);
                  const total = calculateTieredMonthlyDue(students, inst.subscription_tier);
                  return (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/institutions/${inst.id}`} className="text-primary hover:underline">
                          {inst.name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{inst.subscription_tier}</TableCell>
                      <TableCell>{students}</TableCell>
                      <TableCell>{base}</TableCell>
                      <TableCell>{students * PER_STUDENT_FEE}</TableCell>
                      <TableCell>{total}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent reports</CardTitle>
          <CardDescription>Generated monthly reports</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Total due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No reports yet. Generate a monthly report.
                  </TableCell>
                </TableRow>
              ) : (
                financialReports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{instByName[r.institution_id] ?? "—"}</TableCell>
                    <TableCell>{r.report_month}</TableCell>
                    <TableCell>{r.student_count}</TableCell>
                    <TableCell>{r.total_revenue_due.toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DPOPay rollout status</CardTitle>
          <CardDescription>Architecture scaffold is in place; live processing is not enabled yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-4">
            {PLATFORM_PAYMENT_LIFECYCLE.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
