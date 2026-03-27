export const FEEDBACK_TYPES = ["challenge", "recommendation"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_AREAS = [
  { value: "navigation", label: "Navigation and menus" },
  { value: "attendance", label: "Attendance" },
  { value: "payments", label: "Payments and billing" },
  { value: "materials", label: "Materials and learning content" },
  { value: "quizzes", label: "Quizzes and assessments" },
  { value: "timetable", label: "Timetable" },
  { value: "community", label: "Community and forum" },
  { value: "reports", label: "Reports and analytics" },
  { value: "settings", label: "Settings and profile" },
  { value: "auth", label: "Login or access" },
  { value: "performance", label: "Performance or speed" },
  { value: "other", label: "Other" },
] as const;

export type FeedbackArea = (typeof FEEDBACK_AREAS)[number]["value"];

export const FEEDBACK_SEVERITIES = ["low", "medium", "high"] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export const FEEDBACK_STATUSES = [
  "new",
  "reviewing",
  "planned",
  "resolved",
  "dismissed",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_SCREENSHOT_BUCKET = "feedback-screenshots";
export const MAX_SCREENSHOT_MB = 5;

export function isAllowedFeedbackArea(value: string): value is FeedbackArea {
  return FEEDBACK_AREAS.some((area) => area.value === value);
}

export function isAllowedFeedbackType(value: string): value is FeedbackType {
  return FEEDBACK_TYPES.includes(value as FeedbackType);
}

export function isAllowedFeedbackSeverity(value: string): value is FeedbackSeverity {
  return FEEDBACK_SEVERITIES.includes(value as FeedbackSeverity);
}
