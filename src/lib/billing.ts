export const BILLING_TIERS = ["starter", "growth", "elite"] as const;

export type BillingTier = (typeof BILLING_TIERS)[number];

export type BillingPlanDefinition = {
  key: BillingTier;
  displayName: string;
  targetClient: string;
  capacityHint: string;
  monthlyBaseFee: number;
  perStudentFee: number;
  pricingDisplay: string;
  homepageHighlights: string[];
  includedFeatures: string[];
  exclusions: string[];
};

/**
 * Central pricing placeholders.
 * Update these values and copy once final commercial values are approved.
 */
export const BILLING_PLAN_DEFINITIONS: Record<BillingTier, BillingPlanDefinition> = {
  starter: {
    key: "starter",
    displayName: "Starter",
    targetClient: "New or small tuition centres",
    capacityHint: "Up to 50 active students",
    monthlyBaseFee: 400,
    perStudentFee: 0,
    pricingDisplay: "P400/month",
    homepageHighlights: [
      "Core student records and cohorts",
      "Materials, quizzes, attendance",
      "Manual payment logging",
    ],
    includedFeatures: [
      "Student records and cohort grouping",
      "Materials and quiz workflows",
      "Attendance tracking",
      "Manual fee logging",
      "Calendar essentials",
    ],
    exclusions: [
      "No advanced billing analytics",
      "No custom branding controls",
    ],
  },
  growth: {
    key: "growth",
    displayName: "Growth",
    targetClient: "Established centres scaling operations",
    capacityHint: "Up to 250 active students",
    monthlyBaseFee: 800,
    perStudentFee: 0,
    pricingDisplay: "P800/month",
    homepageHighlights: [
      "Everything in Starter",
      "Community and parent communication",
      "Timetable and richer reporting",
    ],
    includedFeatures: [
      "Everything in Starter",
      "Community forums",
      "Timetables",
      "Headmaster billing views",
      "Monthly operational reporting",
    ],
    exclusions: [
      "No custom branding controls",
      "No premium support lane",
    ],
  },
  elite: {
    key: "elite",
    displayName: "Elite",
    targetClient: "High-growth or multi-campus institutions",
    capacityHint: "Unlimited students",
    monthlyBaseFee: 1300,
    perStudentFee: 1,
    pricingDisplay: "P1,300/month + P1 per active student",
    homepageHighlights: [
      "Everything in Growth",
      "Custom branding and priority support",
      "Advanced billing and DPO-ready workflows",
    ],
    includedFeatures: [
      "Everything in Growth",
      "Custom branding (logo and colours)",
      "Priority support",
      "Advanced finance analytics",
      "DPO-ready payment lifecycle support",
    ],
    exclusions: [],
  },
};

export const TIER_BASE_FEE: Record<BillingTier, number> = {
  starter: BILLING_PLAN_DEFINITIONS.starter.monthlyBaseFee,
  growth: BILLING_PLAN_DEFINITIONS.growth.monthlyBaseFee,
  elite: BILLING_PLAN_DEFINITIONS.elite.monthlyBaseFee,
};

/**
 * Legacy shared per-student value used in existing billing tables/UI.
 * Elite plan can define a specific fee in BILLING_PLAN_DEFINITIONS.
 */
export const PER_STUDENT_FEE = BILLING_PLAN_DEFINITIONS.elite.perStudentFee;

export const DEFAULT_TIER: BillingTier = "starter";

export function getTierBaseFee(tier: string): number {
  if (tier in TIER_BASE_FEE) {
    return TIER_BASE_FEE[tier as BillingTier];
  }
  return TIER_BASE_FEE[DEFAULT_TIER];
}

export function calculateTieredMonthlyDue(studentCount: number, tier: string): number {
  if (tier in BILLING_PLAN_DEFINITIONS) {
    const plan = BILLING_PLAN_DEFINITIONS[tier as BillingTier];
    return plan.monthlyBaseFee + studentCount * plan.perStudentFee;
  }
  return getTierBaseFee(tier) + studentCount * PER_STUDENT_FEE;
}

export function getCurrentReportMonth(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function getEffectiveTier(
  subscriptionTier: string | null | undefined,
  isTrial: boolean | null | undefined
): BillingTier {
  if (isTrial) return "elite";
  if (subscriptionTier && subscriptionTier in BILLING_PLAN_DEFINITIONS) {
    return subscriptionTier as BillingTier;
  }
  return DEFAULT_TIER;
}
