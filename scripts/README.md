# Scripts

One-off admin tasks. They read `.env.local` and use the same Firebase service account as the app.

| Command | What it does |
| --- | --- |
| `npm run create-admin -- --email you@example.com` | Creates a platform admin (or promotes an existing account). Add `--password` and `--name` if you like; otherwise a password is generated and printed. |
| `npm run seed-demo` | Builds a demo centre, "Bright Minds Tuition", with staff, students, a timetable, materials, a quiz, attendance, fees and a forum thread. Re-running resets it. |

See `docs/FIREBASE.md` for the full setup.
