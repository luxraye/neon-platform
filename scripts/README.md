# Scripts

- **`seed-admin.cjs`**, **`set-first-admin.cjs`**, **`repair-headmaster-link.cjs`** — Node one-offs (see `package.json` scripts if present).

For a fresh project bootstrap, run:

- **`bootstrap-new-supabase.sql`** — creates core tables, trigger, RLS policies, grants, and storage buckets expected by the current app.

Notes:
- Branding fields are stored on `institutions` (`primary_color`, `logo_url`).
- Bootstrap creates public buckets:
  - `institution-logos` (institution branding logos)
  - `material-documents` (subject/resources uploads)
- If your Supabase tenant enforces stricter storage policies, add matching bucket policies after bootstrap.
