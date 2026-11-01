"use server";

import { getActor } from "@/lib/auth/identity";
import { profileBelongsTo } from "@/lib/server/guards";
import { getDb } from "@/lib/server/db";
import { notifyUsers } from "@/lib/notify-dispatch";
import type { PlatformInvoice, PlatformPaymentTransaction } from "@/lib/platform-payments";

export type RecordPaymentResult =
  | { success: true }
  | { success: false; error: string };

export async function recordCashPayment(formData: {
  student_id: string;
  amount: number;
}): Promise<RecordPaymentResult> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) {
    return { success: false, error: "Only headmasters can record payments." };
  }

  const amount = Math.round(Number(formData.amount) * 100) / 100;
  if (!formData.student_id || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { success: false, error: "Valid student and amount are required." };
  }
  if (!(await profileBelongsTo(formData.student_id, actor.institution_id, "student"))) {
    return { success: false, error: "Student not found in your centre." };
  }

  const { error } = await getDb().from("cash_payments").insert({
    institution_id: actor.institution_id,
    student_id: formData.student_id,
    amount,
    paid_at: new Date().toISOString(),
    recorded_by: actor.user.id,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type FeeSettings = { monthlyFee: number | null };

export async function getFeeSettings(): Promise<FeeSettings> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) return { monthlyFee: null };
  const { data } = await getDb().from("institutions").select("monthly_fee").eq("id", actor.institution_id).maybeSingle();
  const fee = Number(data?.monthly_fee);
  return { monthlyFee: Number.isFinite(fee) && fee > 0 ? fee : null };
}

export async function setMonthlyFee(amount: number | null): Promise<{ success: true } | { success: false; error: string }> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) return { success: false, error: "Only headmasters can set fees." };
  const fee = amount === null ? null : Math.round(Number(amount) * 100) / 100;
  if (fee !== null && (!Number.isFinite(fee) || fee <= 0 || fee > 1_000_000)) {
    return { success: false, error: "Enter a fee above zero." };
  }
  const { error } = await getDb().from("institutions").update({ monthly_fee: fee }).eq("id", actor.institution_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type SendFeeRemindersResult =
  | { success: true; notified: number }
  | { success: false; error: string };

/**
 * Creates in-app notifications for students who have no payment recorded this month.
 * (Heuristic "pending" until we have an explicit invoicing table.)
 */
export async function sendFeeReminders(): Promise<SendFeeRemindersResult> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) {
    return { success: false, error: "Only headmasters can send reminders." };
  }

  const admin = getDb();
  const instId = actor.institution_id;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const { data: students, error: studentsError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("institution_id", instId)
    .eq("role", "student")
    .is("deleted_at", null);
  if (studentsError) return { success: false, error: studentsError.message };

  const studentIds = (students ?? []).map((s: { id: string }) => s.id);
  if (studentIds.length === 0) return { success: true, notified: 0 };

  const { data: payments, error: payError } = await admin
    .from("cash_payments")
    .select("student_id, paid_at")
    .eq("institution_id", instId)
    .gte("paid_at", startIso);
  if (payError) return { success: false, error: payError.message };

  const paidSet = new Set((payments ?? []).map((p: { student_id: string }) => p.student_id));
  const pending = studentIds.filter((id) => !paidSet.has(id));

  if (pending.length === 0) return { success: true, notified: 0 };

  const now = new Date();
  const monthName = now.toLocaleString(undefined, { month: "long" });
  const message = `Your fees for ${monthName} are pending. Please contact your center if you've already paid.`;
  const pendingProfiles = (students ?? []).filter((s: { id: string }) => pending.includes(s.id)) as {
    id: string;
    email: string | null;
  }[];

  try {
    await notifyUsers(
      pendingProfiles.map((p) => ({ userId: p.id, email: p.email })),
      "Fee reminder",
      message,
      "fee_reminder"
    );
  } catch (e) {
    console.error("[sendFeeReminders]", e);
    return { success: false, error: e instanceof Error ? e.message : "Failed to notify." };
  }
  return { success: true, notified: pending.length };
}

type PlatformBillingSnapshot = {
  invoices: PlatformInvoice[];
  transactions: PlatformPaymentTransaction[];
  available: boolean;
  message?: string;
};

export async function getPlatformBillingSnapshot(): Promise<PlatformBillingSnapshot> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) {
    return { invoices: [], transactions: [], available: false, message: "Headmaster access only." };
  }
  const admin = getDb();
  const profile = { institution_id: actor.institution_id };

  const invoicesQuery = await admin
    .from("platform_invoices")
    .select("id, institution_id, report_month, amount_due, status, due_date")
    .eq("institution_id", profile.institution_id)
    .order("report_month", { ascending: false })
    .limit(6);

  if (invoicesQuery.error) {
    return {
      invoices: [],
      transactions: [],
      available: false,
      message: "Could not load platform invoices.",
    };
  }

  const transactionsQuery = await admin
    .from("platform_payment_transactions")
    .select("id, invoice_id, institution_id, provider, provider_reference, status, checkout_url, created_at")
    .eq("institution_id", profile.institution_id)
    .order("created_at", { ascending: false })
    .limit(8);

  if (transactionsQuery.error) {
    return {
      invoices: (invoicesQuery.data ?? []) as PlatformInvoice[],
      transactions: [],
      available: false,
      message: "Could not load payment transactions.",
    };
  }

  return {
    invoices: (invoicesQuery.data ?? []) as PlatformInvoice[],
    transactions: (transactionsQuery.data ?? []) as PlatformPaymentTransaction[],
    available: true,
  };
}

export type InitiatePlatformPaymentResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Architecture-only placeholder for DPOPay payment initialization.
 */
export async function initiatePlatformPayment(invoiceId: string): Promise<InitiatePlatformPaymentResult> {
  void invoiceId;
  return {
    success: false,
    error:
      "DPOPay initialization is in architecture-only mode. Add provider credentials and adapter wiring to activate payments.",
  };
}
