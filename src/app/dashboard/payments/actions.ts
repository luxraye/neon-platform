"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import type { PlatformInvoice, PlatformPaymentTransaction } from "@/lib/platform-payments";

export type RecordPaymentResult =
  | { success: true }
  | { success: false; error: string };

export async function recordCashPayment(formData: {
  student_id: string;
  amount: number;
}): Promise<RecordPaymentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "headmaster" || !profile.institution_id) {
    return { success: false, error: "Only headmasters can record payments." };
  }

  const amount = Number(formData.amount);
  if (!formData.student_id || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Valid student and amount are required." };
  }

  const { error } = await supabase.from("cash_payments").insert({
    institution_id: profile.institution_id,
    student_id: formData.student_id,
    amount,
    paid_at: new Date().toISOString(),
  });

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    (profile?.role !== "headmaster" && profile?.role !== "admin") ||
    !profile?.institution_id
  ) {
    return { success: false, error: "Only headmasters (or admins) can send reminders." };
  }

  const instId = profile.institution_id;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const { data: students, error: studentsError } = await admin
    .from("profiles")
    .select("id")
    .eq("institution_id", instId)
    .eq("role", "student");
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
  const rows = pending.map((id) => ({
    user_id: id,
    title: "Fee reminder",
    message: `Your fees for ${monthName} are pending. Please contact your center if you've already paid.`,
    type: "fee_reminder" as const,
    is_read: false,
  }));

  const { error: notifError } = await admin.from("notifications").insert(rows);
  if (notifError) return { success: false, error: notifError.message };
  return { success: true, notified: pending.length };
}

type PlatformBillingSnapshot = {
  invoices: PlatformInvoice[];
  transactions: PlatformPaymentTransaction[];
  available: boolean;
  message?: string;
};

export async function getPlatformBillingSnapshot(): Promise<PlatformBillingSnapshot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { invoices: [], transactions: [], available: false, message: "Not authenticated." };
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.institution_id || profile.role !== "headmaster") {
    return { invoices: [], transactions: [], available: false, message: "Headmaster access only." };
  }

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
      message: "Platform billing tables are not yet enabled in this environment.",
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
      message: "Transactions table is not yet enabled in this environment.",
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
