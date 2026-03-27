import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BILLING_PLAN_DEFINITIONS,
  BILLING_TIERS,
  getEffectiveTier,
} from "@/lib/billing";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";
import { createServiceRoleClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PricingGuidePage() {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.role !== "headmaster") redirect("/unauthorized");

  let subscriptionTier: string | null = null;
  let isTrial = false;

  if (identity.institution_id) {
    const admin = createServiceRoleClient();
    const { data: institution } = await admin
      .from("institutions")
      .select("subscription_tier, is_trial")
      .eq("id", identity.institution_id)
      .maybeSingle();
    subscriptionTier = institution?.subscription_tier ?? null;
    isTrial = institution?.is_trial ?? false;
  }

  const effectiveTier = getEffectiveTier(subscriptionTier, isTrial);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pricing Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clear breakdown of what each Neon plan includes. Pricing values are centrally configurable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your institution plan status</CardTitle>
          <CardDescription>Billing tier and trial access behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Subscribed tier:</span> {(subscriptionTier ?? "starter").toUpperCase()}
          </p>
          <p>
            <span className="font-medium">Trial active:</span> {isTrial ? "Yes" : "No"}
          </p>
          <p>
            <span className="font-medium">Effective feature tier right now:</span> {effectiveTier.toUpperCase()}
          </p>
          {isTrial ? (
            <p className="text-emerald-600 dark:text-emerald-400">
              Trial mode unlocks Elite-level features so your team can evaluate the full platform.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {BILLING_TIERS.map((tier) => {
          const plan = BILLING_PLAN_DEFINITIONS[tier];
          return (
            <Card key={tier}>
              <CardHeader>
                <CardTitle className="text-base">{plan.displayName}</CardTitle>
                <CardDescription>{plan.targetClient}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium">{plan.pricingDisplay}</p>
                <p className="text-muted-foreground">{plan.capacityHint}</p>
                <div>
                  <p className="font-medium mb-1">Included</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {plan.includedFeatures.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                {plan.exclusions.length > 0 ? (
                  <div>
                    <p className="font-medium mb-1">Not included</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {plan.exclusions.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing FAQ (summary)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Billing is tied to your subscribed tier; trial only changes feature access level.</p>
          <p>• Headmaster dashboards support manual payment reconciliation for cash-heavy workflows.</p>
          <p>• DPOPay lifecycle is scaffolded and can be activated fully once live credentials are configured.</p>
        </CardContent>
      </Card>
    </div>
  );
}
