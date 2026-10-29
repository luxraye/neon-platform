# Firebase setup and data model

## 1. Create the project

1. In the [Firebase console](https://console.firebase.google.com) create a project (for example `neon-prod`).
2. **Authentication** → Get started → enable **Email/Password**.
3. **Firestore Database** → Create database in production mode. Pick a region close to users (`africa-south1` Johannesburg is closest to Botswana).
4. **Storage** → Get started (same region).
5. **Project settings → General → Your apps** → add a **Web app**. Copy the config values into `.env.local` as the `NEXT_PUBLIC_FIREBASE_*` variables.
6. **Project settings → Service accounts** → Generate new private key. Paste the whole JSON on one line as `FIREBASE_SERVICE_ACCOUNT_KEY` in `.env.local`. (Not needed on App Hosting, which has its own service account.)
7. Put the project id in `.firebaserc`, then deploy the rules:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

8. Create your admin account: `npm run create-admin -- --email you@example.com`.

## 2. How security works

- The browser only uses Firebase to **sign in**. It sends the ID token to `POST /api/auth/session`, which sets an httpOnly `__session` cookie (5 days) and a single-device lock.
- Every read and write goes through server code using the **Admin SDK**. Each query is scoped to the signed-in user's `institution_id` via `getActor()` in `src/lib/auth/identity.ts`.
- `firestore.rules` and `storage.rules` deny all direct client access. Uploaded files are served through long-lived download URLs created on the server.
- Quiz answer keys never leave the server. Quiz timers, due dates and focus limits are checked on submit.
- Public forms (join requests, demo requests) have a honeypot and an hourly per-IP limit.

## 3. Collections

All documents carry `id` and (where noted) `created_at`. Optional fields are stored as `null`, never left out, because Firestore can only match `== null` on fields that exist. Defaults live in `src/lib/server/schema.ts`.

| Collection | Key fields |
| --- | --- |
| `institutions` | name, subdomain, subscription_tier (starter/growth/elite), is_trial, trial_ends_at, student_limit, monthly_fee, primary_color, logo_url |
| `profiles` (doc id = Auth uid) | email, full_name, role (admin/headmaster/tutor/student), institution_id, cohort_id, deleted_at, deleted_by |
| `cohorts` | institution_id, name, description |
| `join_requests` | institution_id, email, full_name, message, status (pending/approved/rejected), decided_at, decided_by |
| `materials` | institution_id, cohort_id (null = all), title, subject, description, content_url |
| `quizzes` | institution_id, cohort_id, title, questions[] (with correctIndex), time_limit_minutes, access_password_hash, max_focus_violations, due_at |
| `quiz_attempts` | quiz_id, student_id, status, score, answers[], question_snapshot[], focus_violations, submitted_reason, started_at, submitted_at |
| `timetables` | institution_id, cohort_id, day_of_week (1 = Monday … 7 = Sunday), start_time, end_time, subject, tutor_id, room |
| `attendance` | institution_id, cohort_id, student_id, date (YYYY-MM-DD), status (present/late/absent), remarks |
| `cash_payments` | institution_id, student_id, amount, paid_at, recorded_by |
| `forum_posts` / `forum_comments` | institution_id, author_id, subject, title, content / post_id, author_id, content |
| `notifications` | user_id, title, body, type, is_read |
| `leads` | name, email, phone, institution_name, plan, message, status |
| `financial_reports`, `platform_invoices`, `platform_payment_transactions` | platform billing |
| `user_feedback` | created_by, institution_id, feedback_type, area, severity, summary, details, screenshot_url, status |
| `user_session_locks` (doc id = uid) | single-device sign-in lock |
| `email_dispatch_log` (doc id = dedupe key) | stops duplicate reminder emails |

Only equality and `in` filters are sent to Firestore; ranges, `or`, sorting and limits run in memory on the server (`src/lib/server/db.ts`). That keeps the project free of composite indexes and is fine at tuition-centre scale. If one centre ever passes tens of thousands of documents in a collection, add indexes and push those filters down.

## 4. Deploy

### Firebase App Hosting (recommended)

1. Replace the `REPLACE_ME` values in `apphosting.yaml` with your web-app config and domain.
2. Add secrets:

   ```bash
   firebase apphosting:secrets:set RESEND_API_KEY
   firebase apphosting:secrets:set CRON_SECRET
   ```

3. `firebase apphosting:backends:create` and connect the GitHub repo, or deploy from the console.
4. Daily reminders: create a Cloud Scheduler job that calls `GET https://<your-domain>/api/cron/notifications` every morning with header `Authorization: Bearer <CRON_SECRET>`.

### Vercel

Import the repo, add every variable from `.env.example` (including `FIREBASE_SERVICE_ACCOUNT_KEY`), and deploy. `vercel.json` already schedules the daily cron.

## 5. Moving data from the old Supabase project

The Supabase tables map one-to-one onto the collections above (same column names). Export each table as JSON, then write each row with `put()` from `scripts/_firebase.ts`, using the old row `id` as the document id so links between records still line up. Users need new Firebase Auth accounts: create them with the same uid as their old profile id (`auth.createUser({ uid, email })`) and send each person a password-reset link.
