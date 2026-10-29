/**
 * Neon's Firestore collections and the default values every new document gets.
 *
 * Firestore only matches `field == null` when the field exists and holds null, so every
 * optional field is written explicitly as null. Keep this list in sync with the data model
 * in docs/FIREBASE.md.
 */

export const COLLECTIONS = [
  "institutions",
  "profiles",
  "cohorts",
  "materials",
  "quizzes",
  "quiz_attempts",
  "forum_posts",
  "forum_comments",
  "timetables",
  "attendance",
  "cash_payments",
  "financial_reports",
  "platform_invoices",
  "platform_payment_transactions",
  "user_feedback",
  "user_session_locks",
  "notifications",
  "email_dispatch_log",
  "leads",
  "join_requests",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

type Defaults = Record<string, unknown>;

export const COLLECTION_DEFAULTS: Record<CollectionName, Defaults> = {
  institutions: {
    subscription_tier: "starter",
    branding_config: {},
    primary_color: null,
    logo_url: null,
    student_limit: 100,
    is_trial: false,
    trial_ends_at: null,
    join_mode: "approval",
  },
  profiles: {
    institution_id: null,
    email: null,
    role: "student",
    full_name: null,
    cohort_id: null,
    avatar_url: null,
    deleted_at: null,
    deleted_by: null,
  },
  cohorts: { description: null },
  materials: { cohort_id: null, content_url: null, description: null, subject: null },
  quizzes: {
    cohort_id: null,
    questions: [],
    time_limit_minutes: 30,
    access_password_hash: "",
    security_mode: "medium",
    max_focus_violations: 2,
    due_at: null,
  },
  quiz_attempts: {
    answers: [],
    question_snapshot: [],
    score: null,
    ended_at: null,
    status: "in_progress",
    submitted_reason: "manual",
    focus_violations: 0,
    time_spent_seconds: 0,
  },
  forum_posts: {},
  forum_comments: {},
  timetables: { cohort_id: null, tutor_id: null, room: null },
  attendance: { cohort_id: null, remarks: null },
  cash_payments: { recorded_by: null },
  financial_reports: { student_count: 0, total_revenue_due: 0, status: "pending" },
  platform_invoices: {
    amount_due: 0,
    status: "pending",
    due_date: null,
    paid_at: null,
    created_by: null,
  },
  platform_payment_transactions: {
    provider: "dpopay",
    status: "initiated",
    currency: "BWP",
    checkout_url: null,
    callback_payload: null,
    callback_signature: null,
  },
  user_feedback: {
    institution_id: null,
    severity: "medium",
    details: null,
    screenshot_url: null,
    status: "new",
    admin_notes: null,
  },
  user_session_locks: {},
  notifications: { is_read: false },
  email_dispatch_log: {},
  leads: { institution_name: null, message: null, phone: null, plan: null, requester_fingerprint: null, status: "new" },
  join_requests: {
    full_name: null,
    message: null,
    status: "pending",
    decided_at: null,
    decided_by: null,
    requester_fingerprint: null,
  },
};

/** Collections whose documents get `created_at` automatically. */
export const HAS_CREATED_AT = new Set<CollectionName>(
  COLLECTIONS.filter((c) => c !== "user_session_locks" && c !== "email_dispatch_log")
);

/**
 * Some collections are keyed by a field other than a random id (the old primary keys).
 * Writing to them with that field as the document id keeps upserts cheap and unique.
 */
export const NATURAL_KEYS: Partial<Record<CollectionName, string>> = {
  user_session_locks: "user_id",
  email_dispatch_log: "dedupe_key",
};
