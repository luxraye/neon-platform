"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CheckCircle2, Plus, Search, Settings2, Wallet } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { qCashPayments, qPeople } from "@/app/data/queries";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/page";
import {
  getFeeSettings,
  getPlatformBillingSnapshot,
  initiatePlatformPayment,
  recordCashPayment,
  sendFeeReminders,
  setMonthlyFee,
} from "./actions";
import { FeatureGate } from "@/components/dashboard/feature-gate";

type Student = { id: string; email: string; full_name: string | null };
type Payment = { id: string; student_id: string; amount: number; paid_at: string };

const pula = (n: number) => `P${n.toLocaleString("en-BW", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const isHeadmaster = me?.profile?.role === "headmaster";

  const studentsQ = useQuery({
    queryKey: ["payments", "students"],
    queryFn: async (): Promise<Student[]> => qPeople("student"),
    enabled: isHeadmaster,
  });
  const paymentsQ = useQuery({
    queryKey: ["payments", "list"],
    queryFn: async (): Promise<Payment[]> => qCashPayments(),
    enabled: isHeadmaster,
  });
  const feeQ = useQuery({ queryKey: ["payments", "fee"], queryFn: getFeeSettings, enabled: isHeadmaster });
  const platformQ = useQuery({
    queryKey: ["payments", "platform"],
    queryFn: getPlatformBillingSnapshot,
    enabled: isHeadmaster,
  });

  const students = useMemo(() => studentsQ.data ?? [], [studentsQ.data]);
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const fee = feeQ.data?.monthlyFee ?? null;
  const nameOf = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s.full_name || s.email])) as Record<string, string>,
    [students]
  );

  const start = monthStart();
  const thisMonth = payments.filter((p) => new Date(p.paid_at) >= start);
  const paidByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of thisMonth) m[p.student_id] = (m[p.student_id] ?? 0) + Number(p.amount);
    return m;
  }, [thisMonth]);
  const collected = thisMonth.reduce((s, p) => s + Number(p.amount), 0);
  const expected = fee ? fee * students.length : null;
  const isPaid = (id: string) => (fee ? (paidByStudent[id] ?? 0) >= fee : (paidByStudent[id] ?? 0) > 0);
  const paidCount = students.filter((s) => isPaid(s.id)).length;
  const outstanding = students.length - paidCount;

  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const list = students
    .filter((s) => (filter === "all" ? true : filter === "paid" ? isPaid(s.id) : !isPaid(s.id)))
    .filter((s) => !q || (s.full_name ?? "").toLowerCase().includes(q) || s.email.toLowerCase().includes(q));

  const [recording, setRecording] = useState<{ studentId: string; amount: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [feeDraft, setFeeDraft] = useState("");
  const [reminding, setReminding] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["payments"] });

  async function record(e: React.FormEvent) {
    e.preventDefault();
    if (!recording) return;
    setSaving(true);
    const res = await recordCashPayment({ student_id: recording.studentId, amount: parseFloat(recording.amount) });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Recorded ${pula(parseFloat(recording.amount))} from ${nameOf[recording.studentId] ?? "student"}.`);
    setRecording(null);
    refresh();
  }

  async function saveFee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await setMonthlyFee(feeDraft.trim() ? parseFloat(feeDraft) : null);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Monthly fee saved.");
    setFeeOpen(false);
    refresh();
  }

  async function remind() {
    if (!confirm(`Send an in-app fee reminder to ${outstanding} ${outstanding === 1 ? "student" : "students"}?`)) return;
    setReminding(true);
    const res = await sendFeeReminders();
    setReminding(false);
    if (res.success) toast.success(`Reminded ${res.notified} ${res.notified === 1 ? "student" : "students"}.`);
    else toast.error(res.error);
  }

  const monthLabel = start.toLocaleDateString("en-GB", { month: "long" });

  if (!isHeadmaster) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" />
        <EmptyState icon={Wallet} title="Headmasters only" body="Fee tracking is managed by your centre's headmaster." />
      </div>
    );
  }

  return (
    <FeatureGate feature="billing" fallback={<PaymentsUpgradeMessage />}>
      <div className="space-y-6">
        <PageHeader
          title="Fees"
          description={`Record cash payments and see who still owes for ${monthLabel}.`}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFeeDraft(fee ? String(fee) : "");
                  setFeeOpen(true);
                }}
              >
                <Settings2 /> {fee ? `Fee ${pula(fee)}` : "Set monthly fee"}
              </Button>
              <Button onClick={() => setRecording({ studentId: "", amount: fee ? String(fee) : "" })}>
                <Plus /> Record payment
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            tone="primary"
            icon={Wallet}
            label={`Collected in ${monthLabel}`}
            value={pula(collected)}
            hint={expected ? `of ${pula(expected)} expected` : "Set a monthly fee to track what's expected"}
          />
          <StatCard
            icon={CheckCircle2}
            tone="success"
            label="Paid up"
            value={`${paidCount} / ${students.length}`}
            hint={students.length ? `${Math.round((paidCount / students.length) * 100)}% of students` : "No students yet"}
          />
          <StatCard
            icon={BellRing}
            tone={outstanding ? "warning" : "default"}
            label="Still to pay"
            value={outstanding}
            hint={expected ? `${pula(Math.max(expected - collected, 0))} outstanding` : undefined}
          />
        </div>

        <Panel
          title="Students this month"
          action={
            outstanding > 0 ? (
              <Button variant="outline" size="sm" onClick={remind} disabled={reminding}>
                <BellRing /> {reminding ? "Sending…" : "Remind unpaid"}
              </Button>
            ) : null
          }
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="inline-flex rounded-xl border border-border p-1">
              {(["unpaid", "paid", "all"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-sm font-semibold capitalize",
                    filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students" className="pl-9" aria-label="Search students" />
            </div>
          </div>

          {studentsQ.isLoading || paymentsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filter === "unpaid" && students.length ? "Everyone has paid this month. 🎉" : "No students to show."}
            </p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {list.map((s) => {
                const paid = paidByStudent[s.id] ?? 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.full_name || s.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {paid > 0 ? `Paid ${pula(paid)}${fee && paid < fee ? ` of ${pula(fee)}` : ""}` : "Nothing yet"}
                      </p>
                    </div>
                    {isPaid(s.id) ? (
                      <Badge tone="success">Paid</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRecording({
                            studentId: s.id,
                            amount: fee ? String(Math.max(fee - paid, 0) || fee) : "",
                          })
                        }
                      >
                        Record
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent payments">
          {payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {payments.slice(0, 15).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{nameOf[p.student_id] ?? "Former student"}</span>
                  <span className="text-muted-foreground">
                    {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span className="w-24 text-right font-mono font-semibold">{pula(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your Neon subscription">
          {platformQ.isLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
          ) : !platformQ.data?.invoices.length ? (
            <p className="text-sm text-muted-foreground">No invoices from Neon yet. They appear here at the start of each month.</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {platformQ.data.invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 font-medium">{inv.report_month}</span>
                  <Badge tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}>
                    {inv.status}
                  </Badge>
                  <span className="w-24 text-right font-mono font-semibold">{pula(Number(inv.amount_due))}</span>
                  {inv.status !== "paid" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await initiatePlatformPayment(inv.id);
                        if (res.success) toast.success(res.message);
                        else toast.info(res.error);
                      }}
                    >
                      Pay
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Dialog open={!!recording} onOpenChange={(o) => !o && setRecording(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record a cash payment</DialogTitle>
              <DialogDescription>It&apos;s dated today and shows on the student&apos;s record.</DialogDescription>
            </DialogHeader>
            {recording ? (
              <form onSubmit={record} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={recording.studentId} onValueChange={(v) => setRecording({ ...recording, studentId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-amount">Amount (Pula)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={recording.amount}
                    onChange={(e) => setRecording({ ...recording, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRecording(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !recording.studentId}>
                    {saving ? "Saving…" : "Record payment"}
                  </Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Monthly fee</DialogTitle>
              <DialogDescription>What each student pays per month. Used to work out who still owes.</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveFee} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fee">Amount (Pula)</Label>
                <Input id="fee" type="number" inputMode="decimal" step="0.01" min="0" value={feeDraft} onChange={(e) => setFeeDraft(e.target.value)} placeholder="500" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFeeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}

function PaymentsUpgradeMessage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Fees" />
      <EmptyState
        icon={Wallet}
        title="Fee tracking is on Growth and Elite"
        body="Upgrade to record cash payments, see who owes and send reminders."
      />
    </div>
  );
}
