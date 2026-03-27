# Incident report: Settings / Profile (hydration & load failures)

**Status:** Open — error reported to persist after mitigation attempts  
**Area:** `ThemeToggle`, `RoleShell` sidebars, `/dashboard/settings/*`, role-prefixed settings/profile routes (`/headmaster/settings/profile`, `/tutor/profile`, `/student/profile`)  
**Stack:** Next.js 16.x (App Router, Turbopack), React 19, `next-themes`, Supabase Auth + `@tanstack/react-query`

---

## 1. Symptoms

### 1.1 Recoverable hydration error (ThemeToggle)

- **Message (typical):** React hydration failed — server-rendered text did not match the client.
- **Observed diff:** `Dark mode` (server) vs `Light mode` (client) inside the theme toggle button.
- **Stack location:** `HeadmasterSidebar` → `ThemeToggle` → `Button` (`src/components/ui/button.tsx`).
- **Route when reproduced:** e.g. `http://localhost:3000/headmaster/settings/profile` (also plausible anywhere `ThemeToggle` is SSR’d in the sidebar).

### 1.2 Profile page error state

- **UI:** “Couldn’t load your profile. This can happen if your session isn’t ready yet.” with **Try again** / sign-in hint.
- **Source:** `src/app/dashboard/settings/profile/page.tsx` when `!data?.user || isError` from `useProfile()`.

### 1.3 UX context (non-blocking for this incident)

- Settings/profile navigation was previously aligned via `src/lib/settings-navigation.ts` (pathname-first links, dashboard shell profile hrefs).
- Name updates use server action `updateMyFullName` in `src/app/dashboard/settings/actions.ts`.

---

## 2. Likely technical causes

### 2.1 Theme / hydration (`next-themes`)

- `resolvedTheme` from `useTheme()` is **not reliable during SSR**; it is often `undefined` until the client runs and reads `localStorage` / system preference.
- Any **visible string** derived directly from `resolvedTheme` on the first paint (e.g. “Light mode” vs “Dark mode”) can diverge between:
  - HTML produced on the server, and
  - First client render after hydration, if the client resolves theme earlier or differently than the server assumed.
- **Mitigation attempted** in `src/components/theme/theme-toggle.tsx`:
  - `mounted` flag set in `useEffect` so the **first paint** uses a stable placeholder (`Sun` icon + “Theme”), then swaps to theme-specific label/icon after mount.
  - `suppressHydrationWarning` on the `Button`.
- **If the error still appears:** suspect one or more of:
  - Stale `.next` / Turbopack cache serving an older bundle.
  - **Another** component or extension mutating DOM before React hydrates (error overlay lists browser extensions).
  - **SVG / icon** subtree differences between server and client for `lucide-react` (less common but possible with streaming/SSR quirks).
  - **Duplicate or nested** `ThemeProvider` / theme-related providers (only one `ThemeProvider` in `AppProviders` today — verify no duplicate).
  - React 19 + Strict Mode interaction with `next-themes` (worth checking upstream issues).

### 2.2 Profile not loading (`useProfile`)

- `src/hooks/use-profile.ts` depends on:
  - `auth-user` query → `supabase.auth.getUser()`
  - `profile` query → `profiles` + optional `institutions` via browser Supabase client
- Failure modes for “no user” / error on profile route:
  - Cookies / session not available on first paint in a way the client expects (middleware vs client timing).
  - RLS or network errors on `profiles` / `institutions` (`isError` path).
  - Race: `enabled: isFetched` on profile query — edge cases if `auth-user` never stabilizes.
- The profile page includes a **300ms delayed invalidate** if `!data?.user && !isLoading`; if the session is slow, this may still miss or double-fetch.

---

## 3. Files to inspect first

| File | Relevance |
|------|-----------|
| `src/components/theme/theme-toggle.tsx` | Hydration mismatch surface |
| `src/components/providers/AppProviders.tsx` | `ThemeProvider` config (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) |
| `src/app/layout.tsx` | `suppressHydrationWarning` on `<html>` |
| `src/components/navigation/HeadmasterSidebar.tsx` | Embeds `ThemeToggle` |
| `src/hooks/use-profile.ts` | Profile load logic |
| `src/app/dashboard/settings/profile/page.tsx` | Error / loading UI |
| `src/utils/supabase/client.ts` | Browser Supabase singleton / cookie handling |

---

## 4. Suggested investigation steps

1. **Confirm bundle**
   - Delete `.next`, restart `npm run dev`, hard-refresh. Confirm `theme-toggle.tsx` in DevTools Sources matches repo (placeholder + post-mount labels).

2. **Isolate ThemeToggle**
   - Temporarily replace `ThemeToggle` content with a static `<button type="button">Theme</button>` (no `next-themes`). If hydration errors disappear, focus remains on theme resolution / SSR.

3. **Try icon-only / client-only mount**
   - Render `ThemeToggle` as `null` on server and only mount after `useEffect` (sidebar will flash empty slot — acceptable for a test) or dynamic import with `ssr: false` for the toggle only.

4. **Profile pipeline**
   - Log `getUser()` and `profiles` select in `useProfile` (temporarily) on the failing route; check Network tab for Supabase requests and HTTP status.
   - Verify middleware (`src/middleware.ts` / `src/utils/supabase/middleware.ts`) refreshes session cookies before hitting app routes.

5. **Upstream**
   - Search issues for `next-themes` + Next.js 15/16 + React 19 hydration.

---

## 5. Product / QA checklist (when fixed)

- [ ] No hydration warning on `/headmaster/settings/profile`, `/tutor/profile`, `/student/profile`, `/dashboard/settings/profile`.
- [ ] Profile loads for headmaster, tutor, student with valid session.
- [ ] Theme toggle works and label is readable after first paint (acceptable brief “Theme” state).
- [ ] Edit name + change password still succeed (regression test).

---

## 6. References

- React: [Hydration mismatch](https://react.dev/link/hydration-mismatch)
- `next-themes` avoids FOUC / hydration notes in their README (use `mounted` pattern; avoid theme-dependent UI before mount)

---

*Document generated for handoff; update this file when root cause is confirmed and fix is shipped.*
