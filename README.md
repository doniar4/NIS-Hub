# NIS Hub - v0.6.4

NIS Hub is a student learning workspace built with Next.js 16 and Supabase. It provides a private library and PDF reader, schedules, SMS Diary sessions, support tickets, profile management, community features, and administrator-controlled timetable tools.

## Current capabilities

- Supabase Auth, PostgreSQL RLS and private Storage for accounts, profiles, avatars, books and covers.
- RU, KZ and EN interface with Light, Dark and System appearance.
- Library, PDF Reader, bookmarks, reading progress and optional Gemini AI Study.
- Timetable, calendar exceptions, version history, CSV/TSV import and optional administrator-reviewed EduPage sync.
- Personal tasks with priorities, deadlines and reminders; SMS Diary sessions, support tickets with optional Telegram notifications, community, homework, direct messages and admin tools.

EduPage sync uses a public timetable source only. It has no EduPage password, session sharing or browser-side source fetch. It is disabled unless `EDUPAGE_TIMETABLE_ENABLED=true` is set in the deployment environment.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Populate `.env.local` with values from [.env.example](.env.example). Do not commit credentials, service-role keys, session secrets or production URLs.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions runs the same checks for pull requests and pushes to `main`.

To include the local Reader PDF runtime regression:

```bash
NIS_READER_TEST_PDF=/absolute/path/to/nis-hub-reader-test.pdf npm test
```

For browser verification, install Playwright browsers, build/start the app on a separate local port, then run the relevant browser smoke test. Browser harnesses use synthetic data or local services and do not prove live Supabase, email, Telegram, SMS or EduPage behaviour.

## Production release

Follow the [production release checklist](docs/production-release-checklist.md) before a public deployment. In particular, compare the production Supabase migration history with `supabase/migrations/` and apply only the missing migrations in filename order. Vercel deploys the application; it does not apply Supabase migrations.

The project requires a real-session verification of authentication, private Storage, Admin, Support, SMS Diary, locales, themes and mobile/Safari behaviour before public launch. Confirm that all distributed learning materials have the required rights and finalize the privacy policy for the actual user age group before release.

## Historical documentation

Earlier phase and v0.5 documents remain in `docs/` as historical implementation records. They may describe superseded boundaries, including the period before EduPage sync was introduced. Use this README and the production checklist for the current release workflow.
