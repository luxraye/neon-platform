"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPlatformBillingSnapshot,
  initiatePlatformPayment,
  recordCashPayment,
} from "./actions";
import { FeatureGate } from "@/components/dashboard/feature-gate";

type StudentProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

type PaymentRow = {
  id: string;
  student_id: string;
  amount: number;
  paid_at: string;
};

type PlatformInvoiceRow = {
  id: string;
  report_month: string;
  amount_due: number;
  status: string;
  due_date: string | null;
};

type PlatformTransactionRow = {
  id: string;
  provider_reference: string;
  status: string;
  created_at: string;
};

function useStudents(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["payments", "students", institutionId ?? ""],
    queryFn: async (): Promise<StudentProfile[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StudentProfile[];
    },
    enabled: !!institutionId,
  });
}

function usePayments(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["payments", "list", institutionId ?? ""],
    queryFn: async (): Promise<PaymentRow[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("cash_payments")
        .select("id, student_id, amount, paid_at")
        .eq("institution_id", institutionId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    enabled: !!institutionId,
  });
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: students } = useStudents(institutionId);
  const { data: payments, isLoading } = usePayments(institutionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isHeadmaster = profileData?.profile?.role === "headmaster";
  const platformSnapshot = useQuery({
    queryKey: ["payments", "platform-snapshot", institutionId ?? ""],
    queryFn: getPlatformBillingSnapshot,
    enabled: isHeadmaster,
  });

  // Expected income: enrolled students × monthly fee (configurable placeholder; no DB column yet)
  const enrolledCount = students?.length ?? 0;
  const MONTHLY_FEE_PER_STUDENT = 500;
  const expectedIncomeThisMonth = enrolledCount * MONTHLY_FEE_PER_STUDENT;
  const thisMonth = new Date().getMonth();
  const revenueSoFar = (payments ?? [])
    .filter((p) => new Date(p.paid_at).getMonth() === thisMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!selectedStudentId || !Number.isFinite(num) || num <= 0) {
      toast.error("Select a student and enter a valid amount.");
      return;
    }
    setSubmitting(true);
    const result = await recordCashPayment({ student_id: selectedStudentId, amount: num });
    setSubmitting(false);
    if (result.success) {
      toast.success("Payment recorded.");
      setDialogOpen(false);
      setSelectedStudentId("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["payments", "list", institutionId ?? ""] });
    } else {
      toast.error(result.error);
    }
  };

  const handleInitiatePlatformPayment = async (invoiceId: string) => {
    const result = await initiatePlatformPayment(invoiceId);
    if (result.success) {
      toast.success(result.message);
      return;
    }
    toast.info(result.error);
  };

  return (
    <FeatureGate feature="billing" fallback={<PaymentsUpgradeMessage />}>
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Payments</h1>
        {isHeadmaster && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Record Cash Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Cash Payment</DialogTitle>
                <DialogDescription>
                  Record a cash payment received from a student.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecord} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <select
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                  >
                    <option value="">Select student</option>
                    {students?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Recording…" : "Record"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isHeadmaster && (
        <p className="text-muted-foreground">Payment tracking is available to headmasters.</p>
      )}

      {isHeadmaster && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Expected income this month</h3>
              <p className="text-2xl font-semibold mt-1">
                P{expectedIncomeThisMonth.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on {enrolledCount} enrolled student(s) × P{MONTHLY_FEE_PER_STUDENT}/month
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Recorded revenue this month</h3>
              <p className="text-2xl font-semibold mt-1">P{revenueSoFar.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Cash payments received</p>
            </div>
          </div>

          <h2 className="text-lg font-medium mb-3">Students</h2>
          <div className="rounded-lg border bg-card mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!students?.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                      No students in this institution.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <h2 className="text-lg font-medium mb-3">Recent payments</h2>
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!payments?.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {students?.find((s) => s.id === p.student_id)?.full_name ||
                            students?.find((s) => s.id === p.student_id)?.email ||
                            "—"}
                        </TableCell>
                        <TableCell>{p.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.paid_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <h2 className="text-lg font-medium mb-3 mt-8">Platform subscription billing</h2>
          {platformSnapshot.isLoading && <p className="text-muted-foreground">Loading platform invoices…</p>}
          {!platformSnapshot.isLoading && (
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                This section is prepared for DPOPay activation from the admin dashboard.
              </p>
              {platformSnapshot.data?.message && (
                <p className="text-xs text-amber-500">{platformSnapshot.data.message}</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!platformSnapshot.data?.invoices.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No platform invoices yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (platformSnapshot.data?.invoices as PlatformInvoiceRow[]).map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.report_month}</TableCell>
                        <TableCell>P{Number(invoice.amount_due).toFixed(2)}</TableCell>
                        <TableCell className="capitalize">{invoice.status}</TableCell>
                        <TableCell>
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInitiatePlatformPayment(invoice.id)}
                            disabled={invoice.status === "paid"}
                          >
                            {invoice.status === "paid" ? "Paid" : "Pay with DPOPay"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div>
                <p className="text-xs font-medium mb-2">Recent transaction callbacks</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {!platformSnapshot.data?.transactions.length ? (
                    <li>No callback transactions yet.</li>
                  ) : (
                    (platformSnapshot.data?.transactions as PlatformTransactionRow[]).map((tx) => (
                      <li key={tx.id}>
                        {tx.provider_reference} - <span className="capitalize">{tx.status}</span> -{" "}
                        {new Date(tx.created_at).toLocaleString()}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </FeatureGate>
  );
}

function PaymentsUpgradeMessage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Payments</h1>
      <p className="text-muted-foreground">Payments and billing features are available on Growth and Elite plans. Contact your admin to upgrade.</p>
    </div>
  );
}
