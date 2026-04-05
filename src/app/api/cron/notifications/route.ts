import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import {
  getHeadmastersForInstitution,
  getStudentsForMaterialAudience,
  notifyUser,
  tryClaimEmailDedupe,
} from "@/lib/notify-dispatch";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  return bearer === secret || header === secret;
}

/** Scheduled reminders: platform invoice due dates + quiz due dates. Call every 5–15 minutes from Vercel Cron or any scheduler. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  let invoiceReminders = 0;
  let quizReminders = 0;

  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 3);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data: invoices, error: invErr } = await admin
    .from("platform_invoices")
    .select("id, institution_id, report_month, amount_due, due_date, status")
    .not("due_date", "is", null)
    .lte("due_date", horizonIso)
    .gte("due_date", `${y}-${m}-${d}`)
    .in("status", ["pending", "draft", "overdue"]);

  if (invErr) {
    console.error("[cron/notifications] invoices", invErr.message);
  } else {
    for (const inv of invoices ?? []) {
      const heads = await getHeadmastersForInstitution(inv.institution_id as string);
      for (const h of heads) {
        const dedupe = `platform-inv:${inv.id}:${h.id}:${dateKey}`;
        const claimed = await tryClaimEmailDedupe(dedupe);
        if (!claimed) continue;
        await notifyUser(
          h.id,
          h.email,
          "Platform subscription payment due",
          `Invoice for ${String(inv.report_month).slice(0, 7)} — amount P${Number(inv.amount_due).toFixed(2)}. Due ${inv.due_date}. Open Payments in your dashboard.`,
          "announcement"
        );
        invoiceReminders += 1;
      }
    }
  }

  const { data: quizzes, error: quizErr } = await admin
    .from("quizzes")
    .select("id, institution_id, cohort_id, title, due_at")
    .not("due_at", "is", null)
    .not("cohort_id", "is", null)
    .lte("due_at", horizonIso)
    .gte("due_at", dateKey);

  if (quizErr) {
    console.error("[cron/notifications] quizzes", quizErr.message);
  } else {
    for (const q of quizzes ?? []) {
      const cohortId = q.cohort_id as string;
      const instId = q.institution_id as string;
      const students = await getStudentsForMaterialAudience(instId, cohortId);
      const title = q.title as string;
      const dueAt = q.due_at as string;
      for (const s of students) {
        const dedupe = `quiz-due:${q.id}:${s.id}:${dateKey}`;
        const claimed = await tryClaimEmailDedupe(dedupe);
        if (!claimed) continue;
        await notifyUser(
          s.id,
          s.email,
          "Quiz deadline approaching",
          `Reminder: "${title}" is due by ${dueAt}. Open Learn to complete it.`,
          "announcement"
        );
        quizReminders += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    invoiceReminders,
    quizReminders,
    date: dateKey,
  });
}
