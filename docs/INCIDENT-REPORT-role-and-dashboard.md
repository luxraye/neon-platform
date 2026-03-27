# Bug and Incident Report: Role and Dashboard Mixup

**Date:** March 2026  
**Status:** Documented; mitigations and fixes in progress  
**Affected:** Headmaster and institution flows (Neon subdomain; headmaster@neon.com)

---

## 1. Executive Summary

Users in the headmaster role experienced repeated failures: landing on the **unauthorized** page despite valid auth, **provisioned tutors not appearing** in the Staff list after a successful “Tutor hired” message, and **inconsistent use of institution identity** between Auth metadata and the `profiles` table. Cohorts continue to persist and display; the main issues are with **role resolution**, **institution_id consistency**, and **staff list loading** for headmasters.

Recent changes to the **admin dashboard** (pending deletions, soft delete, restore) did not directly break headmaster flows but introduced a second source of truth for “removed” users and reinforced reliance on `profiles` columns (`deleted_at`, `institution_id`, `role`) that were sometimes out of sync with Auth.

---

## 2. Symptoms

| Symptom | Description |
|--------|-------------|
| Unauthorized redirect | Headmaster with valid Auth (role and institution_id in `raw_user_meta_data`) lands on `/unauthorized` when accessing `/headmaster`. |
| Tutors not visible | After “Tutor hired” success, new tutors do not appear in the Headmaster Staff list. Cohorts still show. |
| Inconsistent institution | Auth user has `institution_id` in metadata; `public.profiles` for the same user can have `institution_id` NULL or stale. |
| Logout not visible | Headmaster (and other institution role) sidebars did not show a Log out control until layout/shell was fixed. |

---

## 3. Root Causes

### 3.1 Two sources of truth for role and institution

- **Auth:** `auth.users.raw_user_meta_data` (e.g. `role`, `institution_id`) is set at signup/provisioning.
- **App:** Most server logic reads **only** from `public.profiles` (e.g. `role`, `institution_id`).

If the `profiles` row is missing, created with wrong/null values, or not yet written by the trigger, the app treats the user as having no role or no institution and can redirect to `/unauthorized` or return empty staff lists.

### 3.2 Profile creation and trigger dependency

- **Headmaster “Hire Tutor” / “Provision Student”** pass the headmaster’s `institution_id` (and role, full_name) in `user_metadata` to `admin.auth.admin.createUser()`.
- A DB trigger `handle_new_user()` is supposed to insert a row into `public.profiles` from `NEW.raw_user_meta_data` on `auth.users` INSERT.
- If the trigger is missing, fails, or runs in an environment where metadata is not yet committed, the new user can have **no profile row** or a row with **NULL `institution_id`**.
- The app then:
  - Uses **only** `profiles` in `getStaff()` to decide the headmaster’s `institution_id`. If `profiles.institution_id` is NULL, `getStaff()` returns `{ tutors: [], students: [] }`, so the Staff page shows no tutors even though the tutor was created.

### 3.3 getStaff() did not use Auth metadata fallback

- **Headmaster layout** was updated to allow access using `user_metadata` when `profiles` was wrong (role/institution_id fallback + self-heal of `profiles`).
- **getStaff()** continued to use only `profiles.role` and `profiles.institution_id`. So even after the headmaster could open `/headmaster`, the Staff list could still be empty if the headmaster’s `profiles.institution_id` was NULL or out of sync.

### 3.4 Admin dashboard changes (recent)

Recent admin dashboard work added:

- **Soft delete:** `profiles.deleted_at` and `profiles.deleted_by`; headmasters can “Remove” tutor/student (mark for removal).
- **Admin “Pending deletions” view:** Lists profiles where `deleted_at` IS NOT NULL; admin can restore within 72 hours.
- **Admin dashboard** loads institutions and student counts with `.is("deleted_at", null)` so only non-deleted students are counted.
- **Block login** for deleted users (redirect to `/deactivated`).

These changes did not directly cause the headmaster “unauthorized” or “no tutors” issues. However they:

- Increased reliance on `profiles` (role, institution_id, deleted_at) being correct.
- Introduced a recoverable “removed” state that can confuse operators (e.g. “tutors disappeared” when some were soft-deleted vs. never visible due to institution_id mismatch).
- Made it more important that **provisioning always sets `profiles.institution_id`** so staff lists and deletion/restore behave correctly.

---

## 4. Fixes and Mitigations Already Applied

| Change | Purpose |
|--------|---------|
| Headmaster layout: role/institution from `user_metadata` fallback | Allow headmaster access when `profiles` is wrong; self-heal profile when we use metadata. |
| getStaff(): use `user_metadata` fallback for headmaster role and institution_id | Ensure Staff list uses the same institution as layout so tutors/students appear when Auth has correct metadata. |
| getStaff(): include `institution_id IS NULL` in tutor/student query | Show tutors/students provisioned when headmaster’s profile had NULL institution_id (orphaned rows). |
| hireTutor / provisionStudent: explicit profile upsert after createUser | Set `profiles.institution_id` (and role, etc.) from headmaster’s institution immediately so we do not rely only on the DB trigger. |
| SQL backfill script | Sync `profiles.institution_id` and role from Auth metadata for existing users. |
| RoleShell + HeadmasterSidebar: full-height sidebar + Log out button | Logout visible at bottom of headmaster (and tutor/student) sidebar. |
| Navbar title | Show “Headmaster: Neon” (and Tutor/Student: &lt;Institution&gt;) using institution name from DB. |

---

## 5. Remaining / Follow-up

- **Verify** after deploy that headmaster can open Staff and see newly hired tutors without refresh.
- **Confirm** SQL backfill has been run so headmaster (and any other affected) profiles have correct `institution_id` and role.
- **Optional:** Add a small “Not linked to institution” indicator and “Link to my institution” for profiles with NULL `institution_id` in headmaster Staff view.
- **Cohorts:** Cohorts persist as designed; no change required unless product decides otherwise.

---

## 6. Recommended Testing

1. Log in as Neon headmaster (headmaster@neon.com).
2. Open **Headmaster → Staff** and confirm existing tutors (if any) and cohorts appear.
3. **Hire Tutor** with a new email/password; confirm success message and that the new tutor appears in the Staff list without leaving the page or hard refresh.
4. Confirm **Log out** is visible at the bottom of the headmaster sidebar and works.
5. Confirm navbar shows “Headmaster: Neon”.
6. (Optional) As admin, open Pending deletions and confirm only intentionally removed users appear; restore one and confirm they can sign in again.

---

## 7. Files Touched (Reference)

- `src/app/(institution)/headmaster/layout.tsx` – metadata fallback, self-heal, institution title.
- `src/app/(institution)/tutor/layout.tsx`, `src/app/(institution)/student/layout.tsx` – institution title.
- `src/app/dashboard/staff/actions.ts` – hireTutor/provisionStudent profile upsert; getStaff() metadata fallback and institutionId for queries.
- `src/components/navigation/RoleShell.tsx` – full-height sidebar so logout is visible.
- `src/components/navigation/HeadmasterSidebar.tsx` – Log out button.
- DB trigger (optional): `handle_new_user` on `auth.users` — app still performs explicit `profiles` upsert on hire/provision.
- Admin: `src/app/(platform)/admin/page.tsx`, `admin-dashboard.tsx`, `actions.ts` (pending deletions, restore, student counts with deleted_at filter).
