import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Minus, Sparkles } from "lucide-react";
import { BILLING_PLAN_DEFINITIONS, BILLING_TIERS, getEffectiveTier } from "@/lib/billing";
import { getUserIdentity } from "@/lib/auth/identity";
import { getDb } from "@/lib/server/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.role !== "headmaster") redirect("/unauthorized");

  const { data: inst } = await getDb()
    .from("institutions")
    .select("subscription_tier, is_trial, trial_ends_at, student_limit")
    .eq("id", identity.institution_id!)
    .maybeSingle();
  const subscribed = (BILLING_TIERS as readonly string[]).includes(inst?.subscription_tier) ? (inst!.subscription_tier as (typeof BILLING_TIERS)[number]) : "starter";
  const isTrial = !!inst?.is_trial;
  const effective = getEffectiveTier(inst?.subscription_tier, isTrial);
  const trialEnds = inst?.trial_ends_at ? new Date(inst.trial_ends_at) : null;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Your plan" description="What your centre pays for Neon and what each plan includes." />

      <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-8">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/70">You&apos;re on</p>
            <p className="mt-1 flex items-center gap-3 text-3xl font-extrabold">
              {BILLING_PLAN_DEFINITIONS[subscribed].displayName}
              {isTrial ? <Badge tone="neon">Trial</Badge> : null}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {BILLING_PLAN_DEFINITIONS[subscribed].pricingDisplay}
              {inst?.student_limit ? ` · ${inst.student_limit} student seats` : ""}
            </p>
            {isTrial ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-neon">
                <Sparkles className="size-4" />
                Every Elite feature is unlocked during your trial
                {daysLeft !== null ? `, ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : ""}.
              </p>
            ) : null}
          </div>
          <Button asChild variant="neon">
            <Link href="/contact?plan=elite">Talk to us about upgrading</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {BILLING_TIERS.map((tier) => {
          const plan = BILLING_PLAN_DEFINITIONS[tier];
          const current = tier === subscribed;
          return (
            <article
              key={tier}
              className={cn("flex flex-col rounded-2xl border bg-card p-6", current ? "border-primary ring-2 ring-primary/20" : "border-border")}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold">{plan.displayName}</h2>
                {current ? <Badge tone="primary">Current</Badge> : tier === effective && isTrial ? <Badge tone="neon">Trial</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.targetClient}</p>
              <p className="mt-4 text-2xl font-extrabold">{plan.pricingDisplay}</p>
              <p className="text-xs text-muted-foreground">{plan.capacityHint}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.includedFeatures.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
                {plan.exclusions.map((f) => (
                  <li key={f} className="flex gap-2 text-muted-foreground">
                    <Minus className="mt-0.5 size-4 shrink-0" /> {f.replace(/^No /, "")}
                  </li>
                ))}
              </ul>
              {!current ? (
                <Button asChild variant="outline" className="mt-6">
                  <Link href={`/contact?plan=${tier}`}>Switch to {plan.displayName}</Link>
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Neon invoices arrive at the start of each month and show on the Fees page. Questions about billing?{" "}
        <Link href="/contact" className="font-semibold text-primary hover:underline">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
