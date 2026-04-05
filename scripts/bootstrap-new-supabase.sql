-- Neon Platform: Bootstrap schema for a brand-new Supabase project
-- Run in Supabase SQL Editor (safe to rerun in most parts).

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Core identity helpers (avoid recursive profiles RLS)
-- -----------------------------------------------------------------------------
create or replace function public.get_auth_institution_id()
returns uuid
language plpgsql
security definer
set search_path = public
volatile
as $$
begin
  set local row_security = off;
  return (select institution_id from public.profiles where id = auth.uid());
end;
$$;

grant execute on function public.get_auth_institution_id() to authenticated;
grant execute on function public.get_auth_institution_id() to anon;

create or replace function public.get_auth_role()
returns text
language sql
stable
as $$
  select lower(coalesce((auth.jwt() ->> 'role'), ''));
$$;

create or replace function public.get_auth_cohort_id()
returns uuid
language plpgsql
security definer
set search_path = public
volatile
as $$
begin
  set local row_security = off;
  return (select cohort_id from public.profiles where id = auth.uid());
end;
$$;

grant execute on function public.get_auth_cohort_id() to authenticated;
grant execute on function public.get_auth_cohort_id() to anon;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text not null unique,
  subscription_tier text not null default 'starter'
    check (subscription_tier in ('starter', 'growth', 'elite')),
  branding_config jsonb default '{}'::jsonb,
  primary_color text,
  logo_url text,
  student_limit integer not null default 100,
  is_trial boolean not null default false,
  trial_ends_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  email text,
  role text not null default 'student'
    check (role in ('admin', 'headmaster', 'tutor', 'student')),
  full_name text,
  cohort_id uuid,
  avatar_url text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Supabase Postgres does not support `ADD CONSTRAINT IF NOT EXISTS` in all versions.
-- Add FKs only when missing.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_deleted_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_deleted_by_fkey
      foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_cohort_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_cohort_fkey
      foreign key (cohort_id) references public.cohorts(id) on delete set null;
  end if;
end $$;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  title text not null,
  content_url text,
  description text,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  time_limit_minutes integer not null default 30 check (time_limit_minutes > 0),
  access_password_hash text not null default '',
  security_mode text not null default 'medium' check (security_mode in ('light', 'medium', 'strict')),
  max_focus_violations integer not null default 2 check (max_focus_violations between 1 and 10),
  due_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  question_snapshot jsonb not null default '[]'::jsonb,
  score numeric(5,2),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted', 'invalidated')),
  submitted_reason text not null default 'manual' check (submitted_reason in ('manual', 'timer_expired', 'security_violation')),
  focus_violations integer not null default 0 check (focus_violations >= 0),
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  submitted_at timestamptz not null default now()
);

alter table if exists public.quizzes
  add column if not exists access_password_hash text not null default '';
alter table if exists public.quizzes
  add column if not exists security_mode text not null default 'medium';
alter table if exists public.quizzes
  add column if not exists max_focus_violations integer not null default 2;
alter table if exists public.quizzes
  drop constraint if exists quizzes_security_mode_check;
alter table if exists public.quizzes
  add constraint quizzes_security_mode_check
  check (security_mode in ('light', 'medium', 'strict'));
alter table if exists public.quizzes
  drop constraint if exists quizzes_max_focus_violations_check;
alter table if exists public.quizzes
  add constraint quizzes_max_focus_violations_check
  check (max_focus_violations between 1 and 10);
alter table if exists public.quizzes
  add column if not exists due_at date;

alter table if exists public.quiz_attempts
  alter column answers set default '[]'::jsonb;
alter table if exists public.quiz_attempts
  add column if not exists question_snapshot jsonb not null default '[]'::jsonb;
alter table if exists public.quiz_attempts
  add column if not exists started_at timestamptz not null default now();
alter table if exists public.quiz_attempts
  add column if not exists ended_at timestamptz;
alter table if exists public.quiz_attempts
  add column if not exists status text not null default 'in_progress';
alter table if exists public.quiz_attempts
  add column if not exists submitted_reason text not null default 'manual';
alter table if exists public.quiz_attempts
  add column if not exists focus_violations integer not null default 0;
alter table if exists public.quiz_attempts
  add column if not exists time_spent_seconds integer not null default 0;
alter table if exists public.quiz_attempts
  drop constraint if exists quiz_attempts_status_check;
alter table if exists public.quiz_attempts
  add constraint quiz_attempts_status_check
  check (status in ('in_progress', 'submitted', 'auto_submitted', 'invalidated'));
alter table if exists public.quiz_attempts
  drop constraint if exists quiz_attempts_submitted_reason_check;
alter table if exists public.quiz_attempts
  add constraint quiz_attempts_submitted_reason_check
  check (submitted_reason in ('manual', 'timer_expired', 'security_violation'));
alter table if exists public.quiz_attempts
  drop constraint if exists quiz_attempts_focus_violations_check;
alter table if exists public.quiz_attempts
  add constraint quiz_attempts_focus_violations_check
  check (focus_violations >= 0);
alter table if exists public.quiz_attempts
  drop constraint if exists quiz_attempts_time_spent_seconds_check;
alter table if exists public.quiz_attempts
  add constraint quiz_attempts_time_spent_seconds_check
  check (time_spent_seconds >= 0);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  subject text not null,
  tutor_id uuid references public.profiles(id) on delete set null,
  room text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  date date not null default current_date,
  remarks text,
  created_at timestamptz not null default now(),
  unique(student_id, date)
);

create table if not exists public.cash_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_reports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  report_month date not null,
  student_count integer not null default 0,
  total_revenue_due numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  unique(institution_id, report_month)
);

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  report_month date not null,
  amount_due numeric(12,2) not null default 0,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'paid', 'failed', 'overdue', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, report_month)
);

create table if not exists public.platform_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.platform_invoices(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null default 'dpopay' check (provider in ('dpopay')),
  provider_reference text not null unique,
  status text not null default 'initiated'
    check (status in ('initiated', 'pending', 'success', 'failed', 'expired', 'cancelled')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'BWP',
  checkout_url text,
  callback_payload jsonb,
  callback_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('challenge', 'recommendation')),
  area text not null check (area in ('auth', 'navigation', 'attendance', 'payments', 'materials', 'quizzes', 'timetable', 'community', 'reports', 'settings', 'performance', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  summary text not null,
  details text,
  screenshot_url text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_session_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lock_token text not null,
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('fee_reminder', 'quiz_result', 'announcement')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotent dedupe keys for scheduled email (cron); service role only.
create table if not exists public.email_dispatch_log (
  dedupe_key text primary key,
  sent_at timestamptz not null default now()
);

create index if not exists idx_email_dispatch_log_sent on public.email_dispatch_log(sent_at desc);

alter table public.email_dispatch_log enable row level security;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  institution_name text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted')),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_profiles_institution_role on public.profiles(institution_id, role);
create index if not exists idx_cohorts_institution on public.cohorts(institution_id);
create index if not exists idx_materials_institution_subject on public.materials(institution_id, subject);
create index if not exists idx_quizzes_institution on public.quizzes(institution_id);
create index if not exists idx_quiz_attempts_student on public.quiz_attempts(student_id, submitted_at desc);
create index if not exists idx_quiz_attempts_quiz_submitted on public.quiz_attempts(quiz_id, submitted_at desc);
create index if not exists idx_quiz_attempts_quiz_status on public.quiz_attempts(quiz_id, status);
create index if not exists idx_forum_posts_institution_created on public.forum_posts(institution_id, created_at desc);
create index if not exists idx_forum_comments_post on public.forum_comments(post_id);
create index if not exists idx_timetables_institution_cohort on public.timetables(institution_id, cohort_id, day_of_week, start_time);
create index if not exists idx_attendance_cohort_date on public.attendance(cohort_id, date);
create index if not exists idx_cash_payments_inst_paidat on public.cash_payments(institution_id, paid_at desc);
create index if not exists idx_fin_reports_inst_month on public.financial_reports(institution_id, report_month desc);
create index if not exists idx_platform_invoices_inst_month on public.platform_invoices(institution_id, report_month desc);
create index if not exists idx_platform_tx_inst_created on public.platform_payment_transactions(institution_id, created_at desc);
create index if not exists idx_platform_tx_invoice on public.platform_payment_transactions(invoice_id);
create index if not exists idx_user_feedback_inst_created on public.user_feedback(institution_id, created_at desc);
create index if not exists idx_user_feedback_status_created on public.user_feedback(status, created_at desc);
create index if not exists idx_user_feedback_area_created on public.user_feedback(area, created_at desc);
create index if not exists idx_user_session_locks_updated on public.user_session_locks(updated_at desc);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_leads_status_created on public.leads(status, created_at desc);

-- -----------------------------------------------------------------------------
-- Trigger: auth.users -> profiles (optional, app also self-heals with upsert)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, institution_id, email, role, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'institution_id', '')::uuid,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'student'),
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
  set
    institution_id = excluded.institution_id,
    email = excluded.email,
    role = excluded.role,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.cohorts enable row level security;
alter table public.materials enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.timetables enable row level security;
alter table public.attendance enable row level security;
alter table public.cash_payments enable row level security;
alter table public.financial_reports enable row level security;
alter table public.platform_invoices enable row level security;
alter table public.platform_payment_transactions enable row level security;
alter table public.user_feedback enable row level security;
alter table public.user_session_locks enable row level security;
alter table public.notifications enable row level security;
alter table public.leads enable row level security;

-- Clear old policies by name (idempotent)
drop policy if exists "institutions_select_own_or_admin" on public.institutions;
drop policy if exists "Strict Institution Access" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "cohorts_select_institution" on public.cohorts;
drop policy if exists "cohorts_manage_staff" on public.cohorts;
drop policy if exists "materials_select_institution" on public.materials;
drop policy if exists "materials_manage_staff" on public.materials;
drop policy if exists "quizzes_select_institution" on public.quizzes;
drop policy if exists "quizzes_manage_staff" on public.quizzes;
drop policy if exists "quiz_attempts_select_own_or_staff" on public.quiz_attempts;
drop policy if exists "quiz_attempts_insert_student" on public.quiz_attempts;
drop policy if exists "quiz_attempts_update_own_open" on public.quiz_attempts;
drop policy if exists "forum_posts_select_institution" on public.forum_posts;
drop policy if exists "forum_posts_insert_own" on public.forum_posts;
drop policy if exists "forum_comments_select_institution" on public.forum_comments;
drop policy if exists "forum_comments_insert_own" on public.forum_comments;
drop policy if exists "timetables_select_institution" on public.timetables;
drop policy if exists "timetables_manage_staff" on public.timetables;
drop policy if exists "attendance_select_own_or_staff" on public.attendance;
drop policy if exists "attendance_manage_staff" on public.attendance;
drop policy if exists "cash_payments_select_staff_or_admin" on public.cash_payments;
drop policy if exists "cash_payments_insert_staff_or_admin" on public.cash_payments;
drop policy if exists "financial_reports_select_staff_or_admin" on public.financial_reports;
drop policy if exists "financial_reports_insert_admin" on public.financial_reports;
drop policy if exists "platform_invoices_select_staff_or_admin" on public.platform_invoices;
drop policy if exists "platform_invoices_manage_admin" on public.platform_invoices;
drop policy if exists "platform_transactions_select_staff_or_admin" on public.platform_payment_transactions;
drop policy if exists "platform_transactions_manage_admin" on public.platform_payment_transactions;
drop policy if exists "user_feedback_insert_scoped" on public.user_feedback;
drop policy if exists "user_feedback_select_scoped" on public.user_feedback;
drop policy if exists "user_feedback_update_admin" on public.user_feedback;
drop policy if exists "session_locks_select_own" on public.user_session_locks;
drop policy if exists "session_locks_insert_own" on public.user_session_locks;
drop policy if exists "session_locks_update_own" on public.user_session_locks;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_staff_or_admin" on public.notifications;
drop policy if exists "leads_admin_all" on public.leads;

create policy "institutions_select_own_or_admin" on public.institutions
for select using (
  id = public.get_auth_institution_id() or public.get_auth_role() = 'admin'
);

create policy "Strict Institution Access" on public.profiles
for select using (
  id = auth.uid()
  or institution_id = public.get_auth_institution_id()
  or public.get_auth_role() = 'admin'
);

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

create policy "cohorts_select_institution" on public.cohorts
for select using (institution_id = public.get_auth_institution_id());

create policy "cohorts_manage_staff" on public.cohorts
for all using (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
)
with check (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
);

create policy "materials_select_institution" on public.materials
for select using (institution_id = public.get_auth_institution_id());

create policy "materials_manage_staff" on public.materials
for all using (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
)
with check (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
);

create policy "quizzes_select_institution" on public.quizzes
for select using (institution_id = public.get_auth_institution_id());

create policy "quizzes_manage_staff" on public.quizzes
for all using (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
)
with check (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
);

create policy "quiz_attempts_select_own_or_staff" on public.quiz_attempts
for select using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.quizzes q
    where q.id = quiz_attempts.quiz_id
      and q.institution_id = public.get_auth_institution_id()
      and public.get_auth_role() in ('headmaster', 'tutor')
  )
);

create policy "quiz_attempts_insert_student" on public.quiz_attempts
for insert with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.quizzes q
    where q.id = quiz_attempts.quiz_id
      and q.institution_id = public.get_auth_institution_id()
  )
);

create policy "quiz_attempts_update_own_open" on public.quiz_attempts
for update using (
  student_id = auth.uid()
  and status = 'in_progress'
)
with check (
  student_id = auth.uid()
);

create policy "forum_posts_select_institution" on public.forum_posts
for select using (
  institution_id = public.get_auth_institution_id()
  and (
    public.get_auth_role() <> 'student'
    or public.get_auth_cohort_id() is not null
  )
);

create policy "forum_posts_insert_own" on public.forum_posts
for insert with check (
  author_id = auth.uid()
  and institution_id = public.get_auth_institution_id()
  and (
    public.get_auth_role() <> 'student'
    or public.get_auth_cohort_id() is not null
  )
);

create policy "forum_comments_select_institution" on public.forum_comments
for select using (
  exists (
    select 1
    from public.forum_posts p
    where p.id = forum_comments.post_id
      and p.institution_id = public.get_auth_institution_id()
  )
  and (
    public.get_auth_role() <> 'student'
    or public.get_auth_cohort_id() is not null
  )
);

create policy "forum_comments_insert_own" on public.forum_comments
for insert with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.forum_posts p
    where p.id = forum_comments.post_id
      and p.institution_id = public.get_auth_institution_id()
  )
  and (
    public.get_auth_role() <> 'student'
    or public.get_auth_cohort_id() is not null
  )
);


create policy "timetables_select_institution" on public.timetables
for select using (institution_id = public.get_auth_institution_id());

create policy "timetables_manage_staff" on public.timetables
for all using (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
)
with check (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
);

create policy "attendance_select_own_or_staff" on public.attendance
for select using (
  student_id = auth.uid()
  or (
    institution_id = public.get_auth_institution_id()
    and public.get_auth_role() in ('headmaster', 'tutor')
  )
);

create policy "attendance_manage_staff" on public.attendance
for all using (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
)
with check (
  institution_id = public.get_auth_institution_id()
  and public.get_auth_role() in ('headmaster', 'tutor')
);

create policy "cash_payments_select_staff_or_admin" on public.cash_payments
for select using (
  (institution_id = public.get_auth_institution_id() and public.get_auth_role() = 'headmaster')
  or public.get_auth_role() = 'admin'
);

create policy "cash_payments_insert_staff_or_admin" on public.cash_payments
for insert with check (
  (institution_id = public.get_auth_institution_id() and public.get_auth_role() = 'headmaster')
  or public.get_auth_role() = 'admin'
);

create policy "financial_reports_select_staff_or_admin" on public.financial_reports
for select using (
  (institution_id = public.get_auth_institution_id() and public.get_auth_role() = 'headmaster')
  or public.get_auth_role() = 'admin'
);

create policy "financial_reports_insert_admin" on public.financial_reports
for insert with check (public.get_auth_role() = 'admin');

create policy "platform_invoices_select_staff_or_admin" on public.platform_invoices
for select using (
  (institution_id = public.get_auth_institution_id() and public.get_auth_role() = 'headmaster')
  or public.get_auth_role() = 'admin'
);

create policy "platform_invoices_manage_admin" on public.platform_invoices
for all using (public.get_auth_role() = 'admin')
with check (public.get_auth_role() = 'admin');

create policy "platform_transactions_select_staff_or_admin" on public.platform_payment_transactions
for select using (
  (institution_id = public.get_auth_institution_id() and public.get_auth_role() = 'headmaster')
  or public.get_auth_role() = 'admin'
);

create policy "platform_transactions_manage_admin" on public.platform_payment_transactions
for all using (public.get_auth_role() = 'admin')
with check (public.get_auth_role() = 'admin');

create policy "user_feedback_insert_scoped" on public.user_feedback
for insert with check (
  created_by = auth.uid()
  and (
    (institution_id = public.get_auth_institution_id() and public.get_auth_role() in ('student', 'tutor', 'headmaster'))
    or public.get_auth_role() = 'admin'
  )
);

create policy "user_feedback_select_scoped" on public.user_feedback
for select using (
  created_by = auth.uid()
  or public.get_auth_role() = 'admin'
  or (public.get_auth_role() = 'headmaster' and institution_id = public.get_auth_institution_id())
);

create policy "user_feedback_update_admin" on public.user_feedback
for update using (public.get_auth_role() = 'admin')
with check (public.get_auth_role() = 'admin');

create policy "session_locks_select_own" on public.user_session_locks
for select using (user_id = auth.uid());

create policy "session_locks_insert_own" on public.user_session_locks
for insert with check (user_id = auth.uid());

create policy "session_locks_update_own" on public.user_session_locks
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_select_own" on public.notifications
for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_insert_staff_or_admin" on public.notifications
for insert with check (
  public.get_auth_role() in ('admin', 'headmaster', 'tutor')
);

create policy "leads_admin_all" on public.leads
for all using (public.get_auth_role() = 'admin')
with check (public.get_auth_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.institutions to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cohorts to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant update on public.quiz_attempts to authenticated;
grant select, insert on public.forum_posts to authenticated;
grant select, insert on public.forum_comments to authenticated;
grant select, insert, update, delete on public.timetables to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert on public.cash_payments to authenticated;
grant select, insert on public.financial_reports to authenticated;
grant select on public.platform_invoices to authenticated;
grant select on public.platform_payment_transactions to authenticated;
grant select, insert, update on public.user_feedback to authenticated;
grant select, insert, update on public.user_session_locks to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update, delete on public.leads to authenticated;

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('material-documents', 'material-documents', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('institution-logos', 'institution-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', true)
on conflict (id) do nothing;
