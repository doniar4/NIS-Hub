# Messages, web notifications and demo diary

## Supabase setup

Apply all existing migrations first, then these two files in order using Supabase SQL Editor:

1. `supabase/migrations/202609180001_direct_messages.sql`
2. `supabase/migrations/202609180002_subject_names.sql`

This change has not been applied to the remote project. The workspace only supplies a publishable key, which cannot administer the database.

Before applying the first migration, check existing display names:

```sql
select lower(btrim(display_name)) as name, count(*)
from public.profiles
where display_name is not null
group by lower(btrim(display_name))
having count(*) > 1;

select id, display_name from public.profiles
where display_name is not null and btrim(display_name) = '';
```

Resolve any results in Table Editor with the account owners. The migration deliberately stops on collisions instead of silently renaming people. NULL display names remain allowed for new accounts. A student chooses an available name on Profile, or an operator sets `public.profiles.display_name` in Table Editor. Names are unique ignoring case and leading/trailing spaces. The database constraint also covers Table Editor updates and concurrent profile edits.

## Behavior and access

- `/messages` requires sign-in. Starting a conversation needs the exact recipient display name and a nonempty sender display name. No email, class or full profile is exposed by lookup.
- A thread has exactly two participants. Table RLS allows only these participants to read messages. App administrators do not get a message-reading policy. Database operators retain infrastructure access; messages are not end-to-end encrypted.
- `start_dm` and `send_dm` are authenticated RPCs. Direct table writes by students are denied. A sender has a maximum of 20 new messages per minute, 2,000 characters per message and 30 newly created conversations per hour.
- Message retries carry a client UUID. Repeating the same request produces one message and one notification. Reusing the UUID with changed content is rejected.
- History is loaded in batches of 50 with a timestamp/UUID cursor. Inbox shows the 200 most recently active conversations.
- Messages refresh every 10 seconds; notifications every 15 seconds, only while the document is visible. This implementation uses polling, so no Realtime publication setup is required.
- The bell shows the total unread count and the latest 30 notifications. New messages produce up to three in-site toast cards. Closing a toast only hides it; opening its conversation or marking it read updates stored state.
- Notifications work inside an open web page. No browser notification permission, service worker or background push is used.
- If migrations are missing, Messages and the bell display a setup state; the rest of the application remains usable.
- Deleting an account cascades its threads, messages and notifications. Per-message editing/deletion and user blocking are not included in this version.

## Demo diary

`/diary` explicitly labels the sample data as demo data. There is no live login, session scraping, API claim or verified SMS connector. `https://sms.nis.ura.kz` could not be inspected from this environment, and no authenticated sample was supplied.

The local adapter imports one table with these columns (English, Russian and Kazakh header aliases are supported):

```csv
subject,date,score,max,type
Алгебра,2026-09-14,17,20,СОР
Физика,2026-09-15,13,16,СОР
```

CSV/TSV and saved HTML tables are supported. Dates accept `YYYY-MM-DD` and `DD.MM.YYYY`. A score such as `8/10` can replace separate score/max cells. HTML is parsed with parse5 without executing scripts or fetching embedded resources. Files stay in browser memory and are discarded when the page is left/reloaded. Nothing is sent to Supabase or a school service. Maximum file size is 1 MiB and maximum row count is 1,000. Invalid rows reject the import; old displayed data is retained.

The displayed average is the arithmetic average of work percentages, not an official term-grade formula. To support a different real SMS table structure, provide an anonymised saved table and extend the tested adapter.

## Design and PDF covers

- Profile avatar sits next to the title; upload settings remain in a neighboring panel.
- AI Study is an expandable full-width panel above the PDF, avoiding a narrow reader on laptops.
- Shared panels use theme-aware forest, sage and copper tints. Sidebar icon divider moves with state. Reduced motion disables effects.
- The cursor bloom has a 10 by 10 px core, keeps the native cursor, ignores input and is disabled on touch/reduced-motion devices.
- Recent books lazily render actual page 1 using the existing authenticated PDF access route. PDF.js uses range requests where supported and destroys its document after rendering. A stored cover is a fallback if PDF rendering fails. No PDF page images are made public or persisted.

## Local verification

`node --import tsx --test tests/community.test.ts tests/catalog.test.ts tests/v051-books.test.ts tests/theme.test.ts` — 14 passing checks.

`node --import tsx --test tests/community-browser.smoke.ts` — Chromium UI with isolated PostgreSQL transport, screenshots in `/tmp/nis-community-browser`. Set `NIS_CHROMIUM_PATH` if Chromium is installed elsewhere. Requires a completed production build for its CSS. This harness does not log into the remote Supabase project or contact real message recipients. See `design-qa.md` for visual evidence and limits.
