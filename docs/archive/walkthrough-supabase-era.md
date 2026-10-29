# Neon Platform — Walkthrough

**Purpose:** Status of the app and how it works. This document is updated at the end of every directive.

---

## 1. App status

| Area | Status |
|------|--------|
| **Unified identity (server)** | ✅ `getUserIdentity()` — single source: `auth.getUser()` + `profiles` (service role), merge with `user_metadata`, **synchronous upsert** when row missing or `institution_id`/role out of sync |
| **Hydration / theme** | ✅ `ThemeToggle` uses `next/dynamic` **ssr: false** + client-only inner; no “Dark mode” / “Light mode” in SSR HTML |
| **Profile hook resilience** | ✅ `useProfile` — **auth-user** query then **profile** query (`enabled` only after auth success), **retry: 3** on both, console logging for session diagnostics |
| **Staff provisioning** | ✅ `hireTutor` / `provisionStudent` — required `profiles` upsert + **verify** row before success |
| **Role layouts** | ✅ `(platform)/admin` + `(institution)/*` use **only** `getUserIdentity()`; **RoleShell** passes `institutionName` into sidebars |
| Next.js app | ✅ Scaffolded (Next 16, App Router, `src/`, `@/*` alias) |
| Tailwind CSS | ✅ Configured |
| Supabase | ✅ Browser + server clients, session middleware |
| Auth / session | ✅ Middleware refreshes session on every request |
| Profile + institution | ✅ `useProfile()` hook (user, profile, institution) |
| Providers | ✅ ThemeProvider + QueryClientProvider in root layout |
| Database schema | ✅ `institutions` + `profiles` + RLS applied in Supabase |
| Shadcn UI | ✅ Initialized (Nova/Radix); button, card, input, label, dialog, select, table, sonner) |
| Auth UI | ✅ Login page; role-based redirect (admin → /admin, others → /dashboard); Logout button |
| Admin Command Center | ✅ fully operational — Institutions table; Provision New Center; Extend Trial (7 days); change subscription_tier (Starter/Growth/Elite); Billing + monthly report |
| Provisioning | ✅ fully operational — Create institution then headmaster via auth.admin.createUser; institution_id/role/full_name in user_metadata; optional DB trigger + app upserts keep `profiles` in sync |
| Headmaster Dashboard | ✅ fully operational — `getUserIdentity()` + headmaster layout; headmaster with no institution_id sees “Contact Admin” state; Cohorts + Staff (list/create, Hire Tutor) linked to institution via RLS |
| Cohorts | ✅ `cohorts` table + RLS; dashboard Cohorts page with list + Create Cohort (headmaster); NLM via Dexie |
| Staff | ✅ Tutors + Students tables; Hire Tutor (headmaster, user_metadata + trigger); New Students (Pending Assignment) section + assign to cohort; full Students table |
| NLM (Dexie) | ✅ NeonOffline: profiles, institutions, cohorts, materials, quizzes, forum_posts, pending_forum_replies, timetables, attendance_drafts |
| Materials | ✅ Dashboard Materials page; Upload Material (tutor/headmaster), assign to cohort |
| Quizzes | ✅ List + New Quiz builder (JSON MC, time limit); save to `quizzes` |
| Join flow | ✅ fully operational — `/join/[subdomain]` resolves institution by subdomain; JoinForm signUp with role, full_name, institution_id in user_metadata; trigger creates profile (cohort_id null); fallback upsert if trigger missing |
| Learn (LMS) | ✅ fully operational — Student view: materials and quizzes by cohort_id only; Quiz Taker; mobile-responsive; Materials/Quiz builder wired (tutor/headmaster) |
| Admin redirect | ✅ fully operational — Middleware + server layouts: admin always sent to /admin; non-admin cannot enter /admin; useProfile cache keyed by user + auth invalidation |
| Community forum | ✅ fully operational — Subject-filtered; post & reply; NLM; offline reply queue; mobile-responsive; gated to Growth/Elite |
| Payments | ✅ Headmaster: Record Cash Payment; recent payments list; gated to Growth/Elite |
| Admin Billing | ✅ Billing tab: tier fee + $1/student per school; Generate monthly report → financial_reports |
| Timetables | ✅ fully operational — Weekly grid (Mon–Fri); staff add/remove slots (subject, time, room); students read-only by cohort; NLM (Dexie timetables); gated to Growth/Elite |
| Custom branding | ✅ fully operational — Elite only: logo upload (Supabase Storage), primary color picker; --primary-brand in sidebar |
| Feature gating | ✅ fully operational — community & billing: Growth/Elite; custom_branding & timetable: Elite / Growth+Elite; sidebar and page content wrapped |
| Attendance system | ✅ fully operational — Daily attendance by cohort/date; Present/Absent/Late + remarks; Save batch; offline draft in Dexie (attendance_drafts); staff only |
| Grade analytics | ✅ fully operational — My Progress (/dashboard/learn/progress): quiz scores over time (CSS bar chart), subject/quiz breakdown; students only |
| Performance reports | ✅ fully operational — Reports page: select student (headmaster) or own (student); timeframe; attendance %, quiz average, attempts list, materials; Print / Save as PDF |
| Parent / student view | ✅ My Progress and Reports in sidebar for students; Reports for headmasters (select any student) |
| Public landing page | ✅ fully operational — Marketing home at `/` with hero, value props, pricing tiers, Get Started CTA and contact form |
| School finder | ✅ fully operational — Landing page search (name/subdomain) → `/join/[subdomain]` or “not found” message |
| Leads / onboarding inbox | ✅ fully operational — `leads` table + landing contact submits; admin inbox tab + admin notification |
| Student pending assignment gate | ✅ fully operational — Students with `cohort_id = NULL` see a “wait to be assigned” dashboard state |
| SEO / PWA | ✅ SEO metadata in `layout.tsx` (title, description, OG); offline-friendly shell and manifest/branding ready for PWA |
| Strict permissions | ✅ fully operational — Sidebar filtered by role (`src/lib/dashboard-routes.ts`); page-level guard redirects unauthorized URLs to /dashboard with "Unauthorized" toast |
| Mobile QR setup | ✅ fully operational — Students: `/dashboard/mobile-setup` shows QR of site URL + Add to Home Screen steps for PWA |
| Lead conversion | ✅ fully operational — Admin can provision an institution directly from a lead; lead marked converted; temp password returned for sharing |
| Tutor provisioning | ✅ fully operational — Headmasters can provision tutor accounts; tutor lands in correct institution via metadata + handle_new_user trigger |
| Role-based route groups | ✅ fully operational — App Router refactored into `(auth)`, `(platform)`, `(institution)` groups with dedicated layouts and nav |
| Strict server guards | ✅ fully operational — `/admin`, `/headmaster`, `/tutor`, `/student` layouts enforce roles server-side and redirect to `/unauthorized` |

### Dashboard links by role

| Link | Student | Tutor | Headmaster |
|------|---------|-------|------------|
| Overview | ✅ | ✅ | ✅ |
| Cohorts | — | — | ✅ |
| Staff | — | — | ✅ |
| Materials | — | ✅ | ✅ |
| Quizzes | — | ✅ | ✅ |
| Learn | ✅ | — | — |
| My Progress | ✅ | — | — |
| Reports | ✅ | ✅ | ✅ |
| Attendance | — | ✅ | ✅ |
| Community | ✅ (tier) | ✅ (tier) | ✅ (tier) |
| Payments | — | — | ✅ (tier) |
| Timetable | ✅ (tier) | ✅ (tier) | ✅ (tier) |
| Add to Phone | ✅ | — | — |
| Settings | ✅ | — (Profile only) | ✅ |

---

## 2. Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4
- **Backend / Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **Data / cache:** TanStack React Query
- **Theming:** next-themes (ready for light/dark)
- **Other:** lucide-react, dexie (IndexedDB / NLM cache)

---

## 3. Project structure (relevant)

```
neon-platform/
├── .env.local                    # Copy from .env.example; Supabase URL, anon key, service role key
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout; AppProviders + Toaster (sonner)
│   │   ├── page.tsx              # Home (Sign in link)
│   │   ├── globals.css
│   │   ├── login/
│   │   │   └── page.tsx          # Login form; redirect by role (admin → /admin, else → /dashboard)
│   │   ├── join/
│   │   │   └── [subdomain]/
│   │   │       ├── page.tsx      # Resolve institution by subdomain; show JoinForm
│   │   │       ├── join-form.tsx # Student self-register (email, password, name)
│   │   │       └── actions.ts    # getInstitutionBySubdomain, signUpForInstitution (service role)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx        # Pass-through (role shells live under `(institution)`)
│   │   │   ├── page.tsx          # Redirects to /headmaster | /tutor | /student | /admin
│   │   │   ├── cohorts/
│   │   │   │   ├── page.tsx      # List cohorts + Create Cohort dialog (headmaster); NLM
│   │   │   │   └── actions.ts    # createCohort (headmaster only)
│   │   │   ├── staff/
│   │   │   │   ├── page.tsx      # Tutors + Students (Unassigned + assign cohort); Hire Tutor
│   │   │   │   └── actions.ts    # hireTutor, assignStudentToCohort (headmaster)
│   │   │   ├── materials/
│   │   │   │   ├── page.tsx      # List materials; Upload Material (tutor/headmaster)
│   │   │   │   └── actions.ts    # createMaterial
│   │   │   ├── quizzes/
│   │   │   │   ├── page.tsx      # List quizzes
│   │   │   │   ├── new/page.tsx  # Quiz builder (MC questions, cohort, time limit)
│   │   │   │   └── actions.ts    # createQuiz
│   │   │   ├── learn/
│   │   │   │   ├── page.tsx      # Student: materials + quizzes by cohort; Quiz Taker
│   │   │   │   └── quiz-taker.tsx
│   │   │   ├── community/
│   │   │   │   ├── page.tsx      # Subject filter, New post; NLM sync
│   │   │   │   ├── [id]/page.tsx # Post detail + replies
│   │   │   │   └── actions.ts    # createPost, createComment
│   │   │   ├── payments/
│   │   │   │   ├── page.tsx      # Headmaster: Record Cash Payment; recent payments (Growth/Elite)
│   │   │   │   └── actions.ts    # recordCashPayment
│   │   │   ├── timetable/
│   │   │   │   ├── page.tsx      # Weekly grid; staff add slots, students read-only (Growth/Elite)
│   │   │   │   └── actions.ts    # createTimetableSlot, deleteTimetableSlot
│   │   │   └── settings/
│   │   │       ├── page.tsx      # Branding (Elite: logo + primary color)
│   │   │       └── actions.ts   # updateInstitutionBranding
│   │   └── admin/
│   │       ├── layout.tsx       # Admin guard (redirect non-admin to /login)
│   │       ├── page.tsx         # Fetches institutions; renders AdminCommandCenter
│   │       ├── actions.ts       # provisionInstitution (use server; service role for createUser)
│   │       └── admin-command-center.tsx  # Institutions + Billing tabs; Provision; Generate monthly report
│   ├── components/
│   │   ├── providers/
│   │   │   └── AppProviders.tsx
│   │   ├── auth/
│   │   │   └── logout-button.tsx
│   │   ├── dashboard/
│   │   │   ├── dashboard-shell.tsx  # Sidebar (feature-gated links), logo + --primary-brand
│   │   │   └── feature-gate.tsx     # Tier gating: community/billing (growth+elite), custom_branding/timetable (elite / growth+elite)
│   │   └── ui/                  # Shadcn: button, card, dialog, input, label, select, table, sonner
│   ├── hooks/
│   │   ├── use-profile.ts       # Query key includes user id; auth invalidation
│   │   ├── use-cohorts.ts       # TanStack Query + Dexie NLM (offline fallback)
│   │   ├── use-forum-posts.ts   # Forum list + Dexie NLM
│   │   └── use-timetable.ts     # Timetable slots + Dexie NLM (offline)
│   ├── lib/
│   │   ├── utils.ts
│   │   └── db.ts                # Dexie NeonOffline + forum_posts (v3)
│   ├── middleware.ts
│   └── utils/
│       └── supabase/
│           ├── client.ts
│           ├── server.ts        # createClient() — async, use await createClient()
│           ├── middleware.ts
│           └── admin.ts         # createServiceRoleClient() — server-only, for provisioning
├── scripts/
│   ├── README.md                 # Notes; DB DDL lives in your Supabase project
│   ├── seed-admin.cjs            # One-off: set an email as admin
│   ├── set-first-admin.cjs       # Set user as platform admin by email/ID
│   └── repair-headmaster-link.cjs
└── walkthrough.md
```

---

## 4. Supabase / auth flow

1. **Browser:** Client components use `createBrowserSupabaseClient()` from `@/utils/supabase/client`.
2. **Server:** Server components and route handlers use `await createClient()` from `@/utils/supabase/server` (async; uses `await cookies()` from `next/headers` per Next.js 15+).
3. **Every request:** `src/middleware.ts` runs `updateSession(request)`, which uses `createServerClient` with request/response cookies and calls `supabase.auth.getUser()` so access/refresh tokens stay in sync.
4. **Environment:** Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (**Settings → API**). Schema and RLS are maintained in that project, not in committed `.sql` files.

---

## 5. Database (Supabase)

- **Extension:** `uuid-ossp`
- **Tables:**
  - **institutions** — id, name, subdomain, subscription_tier, branding_config, student_limit, is_trial, trial_ends_at, created_at
  - **profiles** — id (→ auth.users), institution_id (→ institutions), email, role (admin | headmaster | tutor | student), full_name, cohort_id (→ cohorts), created_at
  - **cohorts** — id, institution_id (→ institutions), name, description, created_at
  - **materials** — id, institution_id, cohort_id, title, content_url, description, subject, created_at
  - **quizzes** — id, institution_id, cohort_id, title, questions (JSONB), time_limit_minutes, created_at
  - **quiz_attempts** — id, quiz_id, student_id, answers (JSONB), score, submitted_at
  - **forum_posts** — id, institution_id, author_id, subject, title, content, created_at
  - **forum_comments** — id, post_id, author_id, content, created_at
  - **financial_reports** — id, institution_id, report_month, student_count, total_revenue_due, status (pending|paid|overdue)
  - **cash_payments** — id, institution_id, student_id, amount, paid_at, created_at (run SQL in Phase 5 if missing)
- **RLS:** forum_posts (institution isolation); forum_comments (add policy: same institution as post); financial_reports (admin ALL, headmaster SELECT own); cash_payments (headmaster insert/select own institution).
- **Policies (summary):** Materials, Quizzes, Quiz attempts as before; Forum: institution-scoped; Financial: admin full, headmaster read own; Cash payments: headmaster manage own.

---

## 6. Using `useProfile()` in the app

In any **client** component:

```tsx
'use client';
import { useProfile } from '@/hooks/use-profile';

export function MyComponent() {
  const { data, isLoading, isError, error } = useProfile();
  // data: { user, profile, institution } or null when signed out
  if (isLoading) return <div>Loading…</div>;
  if (isError) return <div>Error: {error?.message}</div>;
  if (!data?.user) return <div>Not signed in</div>;
  return <div>Hello, {data.profile?.full_name ?? data.user.email}</div>;
}
```

---

## 7. Run the app

```bash
cd neon-platform
yarn dev
```

Open http://localhost:3000. Ensure `.env.local` has valid `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 7b. First admin & seed script

There is no way to set profile roles in the Supabase dashboard. Use the seed script to create the first platform admin and (optionally) a demo institution:

```bash
yarn seed:admin
```

This runs `scripts/seed-admin.cjs`, which: finds or creates the user `giftjrnakedi@gmail.com`, sets their profile to `role: 'admin'`, and creates one institution (subdomain `demo`). Edit the script to change the email or institution. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## 8. Directive log

*Append a short entry at the end of every directive describing what was done.*

### Directive: Neon SaaS Foundation (Yarn Edition)

- Scaffolded Next.js app with Yarn, Tailwind, ESLint, App Router, `src/`, `@/*`.
- Installed Supabase (browser + server + SSR), React Query, next-themes, lucide-react, dexie.
- Added Supabase utils: `client.ts`, `server.ts`, `middleware.ts` (updateSession).
- Registered global middleware to call `updateSession` on every request.
- Implemented `useProfile()` hook (React Query + Supabase) for user, profile, and institution.
- Wrapped root layout with `AppProviders` (ThemeProvider + QueryClientProvider).
- Created `.env.local` with Supabase placeholders (user filled in keys).
- Applied multi-tenant schema in Supabase (institutions, profiles, RLS).
- Created `walkthrough.md` and agreed to update it at the end of every directive.

**Date:** 2025-03-16 (approximate).

### Directive: Auth UI & Admin Command Center

- **Shadcn UI:** Added button, card, input, label, dialog, select, table; sonner used instead of deprecated toast. Toaster added to root layout.
- **Auth UI:** Login page at `src/app/login/page.tsx` (email/password via Supabase client). On success, redirect by role: `admin` → `/admin`, headmaster/tutor/student → `/dashboard`. Logout button at `@/components/auth/logout-button.tsx`.
- **Admin Command Center:** Admin-only layout at `src/app/admin/layout.tsx` (server-side role check; redirect to `/login` if not admin). Dashboard at `src/app/admin/page.tsx` lists all institutions with subscription_tier and is_trial indicators; “Provision New Center” button opens a dialog.
- **Provisioning:** Dialog form collects institution (name, subdomain, tier) and headmaster (email, password, optional full name). Server action `provisionInstitution` in `src/app/admin/actions.ts`: validates admin session, creates institution row, uses service-role client (`src/utils/supabase/admin.ts`) to create headmaster via `auth.admin.createUser` and insert profile with `role: 'headmaster'` and `institution_id`. Success/error feedback via sonner toasts.
- **Dashboard:** Placeholder `/dashboard` page for non-admin users; home page given “Sign in” link.

**Date:** 2025-03-16.

### Fixes & scripts (post–Auth UI)

- **Seed script:** Added `scripts/seed-admin.cjs` and `yarn seed:admin` to set a given email as platform admin and create one institution (no role UI in Supabase dashboard).
- **Hydration:** Added `suppressHydrationWarning` on root `<html>` in `layout.tsx` to avoid next-themes class mismatch.
- **Server cookies (Next.js 15+):** `cookies()` is async; `createClient()` in `@/utils/supabase/server` is now `async` and all server call sites use `await createClient()`.

### Directive: Phase 3 — Institution Engine & NLM Foundation

- **Database:** User applied SQL for `cohorts` table (institution_id, name, description), RLS (view in institution; headmasters manage), and `profiles.cohort_id` FK to cohorts.
- **NLM (Dexie):** `src/lib/db.ts` defines NeonOffline DB with stores `profiles`, `institutions`, `cohorts` for local cache.
- **Tenant dashboard shell:** `src/app/dashboard/layout.tsx` guards auth and wraps with `DashboardShell`. `DashboardShell` (client) shows sidebar with institution name from `useProfile`, nav links (Overview, Cohorts, Staff, Payments, Settings), Sync Status at bottom (Online / Offline Cache via `navigator.onLine`), and Logout.
- **Cohorts:** `src/app/dashboard/cohorts/page.tsx` lists cohorts via `useCohorts(institutionId)`. When online, data is fetched from Supabase and written to Dexie; when offline, `useCohorts` reads from Dexie. “Create Cohort” dialog (headmaster only) calls `createCohort` server action in `src/app/dashboard/cohorts/actions.ts`.
- **Staff:** `src/app/dashboard/staff/page.tsx` lists profiles with `role === 'tutor'` for the current institution. “Hire Tutor” dialog (headmaster only) calls `hireTutor` server action in `src/app/dashboard/staff/actions.ts`; action uses service-role client to create auth user and profile with `role: 'tutor'`.
- **Placeholders:** Payments and Settings pages added so nav links work.

### Directive: Phase 4 — LMS Engine & Student Enrollment

- **Database:** User applied SQL for `materials`, `quizzes`, `quiz_attempts`; RLS for materials (students see by cohort, tutors/headmasters manage) and quizzes (students see by cohort). If quiz creation fails, add: `CREATE POLICY "Tutors/Headmasters manage quizzes" ON quizzes FOR ALL USING (institution_id = (SELECT institution_id FROM profiles WHERE id = auth.uid()) AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('headmaster', 'tutor'));` If quiz submission fails, add: `CREATE POLICY "Students insert own attempt" ON quiz_attempts FOR INSERT WITH CHECK (student_id = auth.uid());` and `SELECT USING (student_id = auth.uid())`.
- **NLM (Dexie):** `src/lib/db.ts` v2 adds stores `materials` and `quizzes` for offline pre-fetch.
- **Materials:** `src/app/dashboard/materials/page.tsx` lists materials by institution; “Upload Material” dialog (tutor/headmaster) with title, content URL, description, subject, cohort; `createMaterial` action.
- **Quizzes:** `src/app/dashboard/quizzes/page.tsx` lists quizzes; `quizzes/new/page.tsx` JSON-based quiz builder (multiple-choice questions, options, correct index, cohort, time limit); `createQuiz` action.
- **Join flow:** `src/app/join/[subdomain]/page.tsx` resolves institution by subdomain (service-role); `JoinForm` lets students self-register (email, password, full name); `signUpForInstitution` creates auth user + profile with `role: 'student'`, `cohort_id: null`.
- **Staff/Students:** Staff page now has Tutors section and Students section. Students show cohort or “Unassigned”; headmasters can assign unassigned students to a cohort via dropdown; `assignStudentToCohort` action.
- **Learn (student LMS):** `src/app/dashboard/learn/page.tsx` for students only: shows materials and quizzes filtered by student’s `cohort_id`; “Take quiz” opens `QuizTaker` with timer (time_limit_minutes), multiple-choice UI, and submission to `quiz_attempts` (score computed client-side). Non-students or students without cohort see a message.
- **Sidebar:** Nav updated with Materials, Quizzes, and Learn.

### Directive: Phase 5 — Financials & Community Forum

- **Admin detection & redirect:** `src/middleware.ts`: after session refresh, if path starts with `/dashboard` and user profile role is `admin`, redirect to `/admin`. `src/app/dashboard/layout.tsx`: server-side check — if profile role is admin, redirect to `/admin`. Login page: strict `role === 'admin'` → `router.replace('/admin')`, else `/dashboard`. `useProfile`: profile query key includes user id (via `useAuthUserId()`); `onAuthStateChange` invalidates `auth-user` and `profile` queries so cache stays fresh.
- **Database:** `forum_posts`, `forum_comments`, `financial_reports`, `cash_payments`, and RLS — created in the Supabase project (SQL Editor / migrations) as needed.
- **NLM (Dexie):** `src/lib/db.ts` v3 adds `forum_posts` store for offline forum reading.
- **Community forum:** `src/app/dashboard/community/page.tsx` — subject filter (Mathematics, Science, English, General), list posts from `useForumPosts` (online: Supabase + persist to Dexie; offline: read from Dexie). “New post” dialog: subject, title, content; `createPost` action. `community/[id]/page.tsx` — post detail, comments list, reply form; `createComment` action. Sidebar: Community link.
- **Payments:** `src/app/dashboard/payments/page.tsx` — headmasters see students table and “Record Cash Payment” button; dialog records student + amount into `cash_payments`; recent payments table. `recordCashPayment` action.
- **Admin Billing:** Admin page fetches institutions, student counts (service-role), and financial_reports. `AdminCommandCenter` has Institutions and Billing tabs. Billing tab: table of institutions with tier, student count, base fee (starter 50, growth 100, elite 200), $1/student, total due; “Generate monthly report” button calls `generateMonthlyReport` server action (inserts into `financial_reports` for current month, one row per institution). Recent reports table below.

### Directive: Phase 9 — Final Launch Readiness & Lead Generation

- **Leads:** `leads` table + RLS in Supabase; landing contact form calls `submitLead` (server action).
- **Admin notification:** On new lead submission, `submitLead` creates a notification for the first admin profile found: “New Lead: [Institution Name] has inquired!”
- **Admin inbox:** Restored `/admin` page and `AdminCommandCenter` component; added a **Leads** tab that lists contact submissions. Admin UI subscribes to realtime inserts on `leads` and refreshes automatically.
- **Student pending state:** `/dashboard` now shows a specialized welcome/waiting screen when `role === 'student'` and `cohort_id` is null.
- **SEO:** Updated `layout.tsx` metadata title/description + OpenGraph so shared links look professional.
- **Sync status:** Dashboard sidebar now subscribes to realtime updates on the current user’s `profiles` row to keep cohort assignment and institution data fresh.

**Date:** 2026-03-16.

### Directive: Phase 11 — Professional Onboarding & Provisioning

- **Admin lead conversion:** In `src/app/admin/admin-command-center.tsx`, Leads tab now has a **Provision** button per lead. Clicking it opens the Provision dialog with **Institution Name** and **Headmaster Email** prefilled (manual Provision still starts empty).
- **Robust provisioning:** `src/app/admin/actions.ts` `provisionInstitution` now:
  - creates the institution
  - creates the headmaster via `auth.admin.createUser` with metadata (`role: headmaster`, `institution_id`, `full_name`)
  - updates converted leads (`leads.status = 'converted'`) when `lead_id` is provided
  - returns a **temporary password** (auto-generated if left blank) for the admin to share
- **Tutor provisioning:** `src/app/dashboard/staff/page.tsx` Headmasters can **Provision New Tutor** (email, password, full name). `hireTutor` uses `auth.admin.createUser` with metadata (`role: tutor`, `institution_id`) so the DB trigger places them in the correct institution automatically.
- **Permissions check:** Tutors can access Materials, Quizzes, Attendance, Timetable, Reports, Community (tier) and Profile. Tutors cannot see Billing or Institution Settings (only Profile remains available).

**Date:** 2026-03-16.

### Directive: Phase 12 — Architectural Cleanup & Strict Role Isolation

- **Route groups:** Introduced role-based route groups:
  - `(auth)` → `/login`
  - `(platform)` → `/admin`
  - `(institution)` → `/headmaster`, `/tutor`, `/student`
- **Traffic controller:** `/dashboard` now acts as the role redirector (admin → `/admin`, headmaster → `/headmaster`, tutor → `/tutor`, student → `/student`). Legacy deep links under `/dashboard/*` are redirected via `src/app/dashboard/[...rest]/page.tsx`.
- **Dedicated navigation:** Added dedicated sidebar components in `src/components/navigation/` and used them only within their respective role layouts.
- **Strict server-side guards:** Each role layout performs a server-side profile role check and redirects unauthorized access to `/unauthorized` before rendering.

**Date:** 2026-03-16.

### Directive: Phase 10 — Permissions & Mobile QR Access

- **Strict sidebar filtering:** `src/components/dashboard/dashboard-shell.tsx` — nav array now has a `roles` property per link. Sidebar filters links with `.filter(item => item.roles.includes(role))` so students never see Cohorts, Staff, Materials, Quizzes, etc. Permission matrix: Overview / Reports / Community / Timetable / Settings for all; Cohorts / Staff / Payments headmaster only; Materials / Quizzes tutor + headmaster; Learn / My Progress / Add to Phone student only; Attendance tutor + headmaster.
- **Page-level guard:** `src/lib/dashboard-routes.ts` defines `getAllowedRolesForPath` and `checkRole`. `src/components/dashboard/dashboard-route-guard.tsx` uses `usePathname` + `useProfile`; if current path is not allowed for the user’s role, redirects to `/dashboard` and shows “Unauthorized” toast. Layout wraps children with `DashboardRouteGuard`.
- **Student mobile-setup:** `src/app/dashboard/mobile-setup/page.tsx` (students only) shows a QR code of `window.location.origin` via `qrcode.react` (QRCodeSVG) and step-by-step instructions: Scan → Share (iOS) or Menu (Android) → Add to Home Screen.
- **Student dashboard (pending vs assigned):** Pending: large “Pending Assignment” card with friendly copy and tip to use Add to Phone. Assigned: “Welcome back” with today’s timetable, latest materials, and a quick-link to latest quiz / Learn.
- **Staff overview:** Tutors: today’s classes (timetable slots for current day) + recent quiz submissions count (last 7 days). Headmasters: active students count, revenue this month (sum of `cash_payments`), Staff Status (tutor count).
- **Walkthrough:** Strict permissions and Mobile QR Setup marked ✅; added “Dashboard links by role” matrix.

**Date:** 2026-03-16.

### Directive: Unified Identity & Staffing Fail-Safe

- **Unified identity provider:** Added `src/utils/supabase/get-user-identity.ts` to centralize role + `institution_id` resolution from `public.profiles` with a fallback to `auth.users.user_metadata`, plus best-effort self-healing upserts.
- **Layout refactor:** Updated `(institution)` role layouts (`headmaster`, `tutor`, `student`) to rely on `getUserIdentity()` for authorization and to display `Role: Institution` titles.
- **Atomic provisioning:** Updated headmaster staff server actions (`hireTutor`, `provisionStudent`) to upsert `public.profiles` immediately after `auth.admin.createUser` (no reliance on trigger timing).
- **Fail-safe staff loading:** Updated `getStaff()` to accept an `institutionId`, always enforce the caller’s own institution, filter out soft-deleted rows (`deleted_at IS NULL`), and include a small “provisioned email” fail-safe list to cover any remaining metadata/profile lag.
- **Instant UI feedback:** Updated Headmaster Staff page to (a) refresh immediately on success via a refresh nonce, (b) add a manual `Refresh List` button, and (c) fall back to `user.user_metadata.institution_id` when client `useProfile()` hasn’t yet populated `profiles.institution_id`.
- **Unauthorized loops:** With the identity unification and self-healing in layouts, unauthorized redirects should be resolved; verify in QA by repeating the headmaster→staff provisioning flow.

**Date:** 2026-03-19.

### Directive: Unified Identity & UI Stability Fix

- **`getUserIdentity` (`src/utils/supabase/get-user-identity.ts`):** Single server entry for identity. Reads session via `createClient()`, loads `profiles` with **service role**, merges **`user_metadata`**, and runs a **synchronous** `profiles.upsert` when the row is missing or metadata diverges. Includes `full_name` in heal payload when available.
- **Admin layout:** Uses **`getUserIdentity()`** only (same as institution layouts): `admin` role + `deleted_at` checks; removed duplicate profile fetch.
- **Theme toggle:** **`theme-toggle.tsx`** wraps **`theme-toggle-inner.tsx`** with `next/dynamic` **`{ ssr: false }`** and a skeleton loader. Inner component never shows “Light mode” / “Dark mode” until after **`mounted`** (`useEffect`).
- **`hireTutor` / `provisionStudent`:** Require `newUserId`, **upsert** `profiles`, then **SELECT** to verify role + `institution_id` before returning success.
- **`useProfile`:** Split into **`auth-user`** and **`profile`** queries; profile **`enabled: authQuery.isSuccess && !!authQuery.data?.id`**; **`retry: 3`** on both; **`[neon auth-user]`** / **`[neon profile]`** logs in dev.
- **RoleShell / sidebars:** **`sidebarProps`** (e.g. `{ institutionName }`) passed from layouts; **Headmaster / Tutor / Student** sidebars show institution name under the shell title when present.
- **Architecture note:** With server layouts gating on **`getUserIdentity()`** merged identity, **blank role** and spurious **`/unauthorized`** from profile/metadata drift should not occur for valid sessions; client **`useProfile`** retries cover transient Supabase blips.

**Date:** 2026-03-21.
