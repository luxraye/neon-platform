# Neon

Neon runs a tuition centre from one place: students join with a link, tutors share notes and set timed quizzes, attendance is a few taps, fees are tracked, and parents get a printable report. It's built for centres in Botswana and works on cheap phones and patchy data.

**Stack:** Next.js 16 (App Router, React 19), Firebase (Auth, Firestore, Cloud Storage), Tailwind CSS 4, TanStack Query, Dexie for offline, Resend for email.

## Who sees what

| Role | Main screens |
| --- | --- |
| Platform admin | Centres, plans and trials, leads from the website, billing, in-app feedback |
| Headmaster | Overview, People (approve join requests, add staff and students), Cohorts, Timetable, Fees, Results, Reports, Plan, Settings and branding |
| Tutor | Today, Attendance, Materials, Quizzes, Results, Reports, Timetable, Community |
| Student | Home, Learn (quizzes and materials), Timetable, Results, Community, Install app |

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in the Firebase values (see docs/FIREBASE.md)
npm run create-admin -- --email you@example.com
npm run seed-demo              # optional: a full demo centre to click around
npm run dev
```

Open http://localhost:3000 and sign in.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs all four on every pull request.

## Project layout

```
src/app/(auth)/login            sign-in and password reset
src/app/join/[subdomain]        public "ask to join" page for each centre
src/app/(platform)/admin        platform admin area
src/app/(institution)/<role>    headmaster, tutor and student routes (thin wrappers)
src/app/_screens                the shared screens and their server actions
src/app/data/queries.ts         read-only server loaders used by the screens
src/lib/server/db.ts            small Firestore query layer (server only)
src/lib/auth                    session cookie, identity and role checks
src/components/shell            sidebar, top bar, phone bottom bar
src/components/ui               buttons, inputs, dialogs, page building blocks
scripts/                        create-admin and seed-demo
```

## Deploying

Firebase App Hosting is the default target (`apphosting.yaml`). Vercel also works (`vercel.json`). Both are covered in [docs/FIREBASE.md](docs/FIREBASE.md).
