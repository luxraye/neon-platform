"use client";

import { useProfile } from "@/hooks/use-profile";
import { getEffectiveTier } from "@/lib/billing";

export type GatedFeature = "community" | "billing" | "custom_branding" | "timetable";

const TIER_ACCESS: Record<GatedFeature, ("starter" | "growth" | "elite")[]> = {
  community: ["starter", "growth", "elite"],
  billing: ["growth", "elite"],
  custom_branding: ["elite"],
  timetable: ["starter", "growth", "elite"],
};

export function useFeatureAccess(feature: GatedFeature): boolean {
  const { data } = useProfile();
  const tier = getEffectiveTier(
    data?.institution?.subscription_tier,
    data?.institution?.is_trial
  );
  return TIER_ACCESS[feature].includes(tier);
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: GatedFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = useFeatureAccess(feature);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

export function featureAllowed(
  tier: string,
  feature: GatedFeature,
  options?: { isTrial?: boolean }
): boolean {
  const effectiveTier = getEffectiveTier(tier, options?.isTrial ?? false);
  return TIER_ACCESS[feature].includes(effectiveTier);
}
