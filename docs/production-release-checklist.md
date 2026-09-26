# Production release checklist

This checklist is intentionally operational. A successful Vercel build does not confirm production database schema, provider configuration or authenticated workflows.

## 1. Supabase migrations

Back up the production project and compare its migration history with `supabase/migrations/`. Apply only missing migrations, once each, in filename order. Do not rerun `schema.sql` or migrations that are already recorded by the production project.

Current migrations, in order:

1. `202609100001_phase2.sql`
2. `202609110001_phase3_avatar.sql`
3. `202609120001_phase3_schedule_import.sql`
4. `202609120002_phase4_books.sql`
5. `202609120003_phase4_weekly_schedule.sql`
6. `202609140001_v05_school_calendar.sql`
7. `202609140002_v05_schedule_versions.sql`
8. `202609140003_v05_support.sql`
9. `202609140004_v05_private_covers.sql`
10. `202609150001_v051_book_grades.sql`
11. `202609150002_v051_book_variants.sql`
12. `202609150003_v051_subject_localization.sql`
13. `202609150004_v051_book_pages.sql`
14. `202609150005_v051_ai_study.sql`
15. `202609170001_subject_localization_corrections.sql`
16. `202609180001_direct_messages.sql`
17. `202609180002_subject_names.sql`
18. `202609190001_v053_people_friends.sql`
19. `202609190002_v053_community_safety.sql`
20. `202609190003_v053_homework.sql`
21. `202609200001_v055_sms_sessions.sql`
22. `202609210001_v058_edupage_sync.sql`
23. `202609250001_v063_edupage_catalog.sql`
24. `202609260001_v064_personal_tasks.sql`

Regenerate or compare database types against the deployed schema after migration work.

## 2. Vercel and provider configuration

Set real production values in Vercel. Do not use placeholders from `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key)
- `APP_BASE_URL`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID`, if Support notifications are enabled
- `SMS_SESSION_SECRET`, if SMS Diary is enabled
- `GEMINI_API_KEY` and `GEMINI_MODEL`, if AI Study is enabled
- `EDUPAGE_TIMETABLE_ENABLED=true`, only after authorizing and validating the timetable source
- `AI_STUDY_ENABLED=true`, only when the Gemini configuration is ready

In Supabase Authentication, configure the canonical production Site URL and approved redirect URLs. Confirm that the deployed `APP_BASE_URL` matches the canonical URL.

## 3. Authenticated production smoke test

Use a real test account and verify:

1. Sign up, email confirmation, sign in, page reload, sign out and repeat sign in.
2. Home, timetable, materials, Reader, Library and Profile/avatar.
3. Support, SMS Diary and AI Study when the corresponding environment flags are enabled.
4. Administrator import, EduPage preview/sync/rollback and private covers using an admin account.
5. RU/KZ/EN, Light/Dark/System appearance, a narrow mobile viewport and Safari/iPhone.

Do not use real student data or production secrets in test tickets, messages or screenshots.

## 4. Launch decisions

Before making the service public, record:

- the legal operator and data-contact details;
- the policy for minor users, including age, consent and data-retention handling;
- the basis for distributing every learning PDF and cover;
- the owner for Telegram, Supabase, Vercel and EduPage operational access;
- retention and deletion procedures for Supabase, backups, logs and Telegram messages.

The application code cannot make these policy decisions on behalf of the operator.
