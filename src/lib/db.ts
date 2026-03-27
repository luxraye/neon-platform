import Dexie, { type Table } from "dexie";

export type ProfileRecord = {
  id: string;
  institution_id: string | null;
  email: string;
  role: "admin" | "headmaster" | "tutor" | "student";
  full_name: string | null;
  cohort_id: string | null;
  updated_at?: number;
};

export type InstitutionRecord = {
  id: string;
  name: string;
  subdomain: string;
  subscription_tier: string;
  branding_config: unknown;
  student_limit: number;
  is_trial: boolean;
  trial_ends_at: string | null;
  updated_at?: number;
};

export type CohortRecord = {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at?: number;
};

export type MaterialRecord = {
  id: string;
  institution_id: string;
  cohort_id: string | null;
  title: string;
  content_url: string | null;
  description: string | null;
  subject: string | null;
  created_at: string;
  updated_at?: number;
};

export type QuizRecord = {
  id: string;
  institution_id: string;
  cohort_id: string | null;
  title: string;
  questions: unknown;
  time_limit_minutes: number;
  created_at: string;
  updated_at?: number;
};

export type ForumPostRecord = {
  id: string;
  institution_id: string;
  author_id: string;
  subject: string;
  title: string;
  content: string;
  created_at: string;
  updated_at?: number;
};

export type PendingForumReplyRecord = {
  id: string;
  post_id: string;
  content: string;
  created_at: number;
};

export type TimetableRecord = {
  id: string;
  institution_id: string;
  cohort_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  tutor_id: string | null;
  room: string | null;
  created_at: string;
  updated_at?: number;
};

export type AttendanceDraftRecord = {
  id: string;
  cohort_id: string;
  date: string;
  student_id: string;
  status: "present" | "absent" | "late";
  remarks: string | null;
  pending: number; // 1 = pending sync
  updated_at?: number;
};

export class NeonOfflineDB extends Dexie {
  profiles!: Table<ProfileRecord>;
  institutions!: Table<InstitutionRecord>;
  cohorts!: Table<CohortRecord>;
  materials!: Table<MaterialRecord>;
  quizzes!: Table<QuizRecord>;
  forum_posts!: Table<ForumPostRecord>;
  pending_forum_replies!: Table<PendingForumReplyRecord>;
  timetables!: Table<TimetableRecord>;
  attendance_drafts!: Table<AttendanceDraftRecord>;

  constructor() {
    super("NeonOffline");
    this.version(1).stores({
      profiles: "id, institution_id, email, role",
      institutions: "id, subdomain",
      cohorts: "id, institution_id",
    });
    this.version(2).stores({
      materials: "id, institution_id, cohort_id",
      quizzes: "id, institution_id, cohort_id",
    });
    this.version(3).stores({
      forum_posts: "id, institution_id, subject",
    });
    this.version(4).stores({
      pending_forum_replies: "id, post_id, created_at",
    });
    this.version(5).stores({
      timetables: "id, institution_id, cohort_id, day_of_week",
    });
    this.version(6).stores({
      attendance_drafts: "id, [cohort_id+date], student_id",
    });
  }
}

export const db = new NeonOfflineDB();
