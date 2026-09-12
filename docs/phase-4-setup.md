# Phase 4 setup: books and weekly timetable

## Rollout and migration order

Existing app, not a rebuild. Branch: codex/phase-4-books-schedule. Coordinate migrations with the Phase 4 deployment: the old three-argument book-save RPC is retired. Do not re-run historical schema/migrations on an existing database. Back up the database and retain uploaded originals first.

For an existing Phase 3 project, apply only missing migrations in order:

1. supabase/migrations/202609120002_phase4_books.sql
2. supabase/migrations/202609120003_phase4_weekly_schedule.sql

For a fresh development project the complete order is:

1. supabase/schema.sql
2. supabase/migrations/202609100001_phase2.sql
3. supabase/migrations/202609110001_phase3_avatar.sql
4. supabase/migrations/202609120001_phase3_schedule_import.sql
5. The two Phase 4 migrations above.

Owner status (2026-09-12): both real Supabase Phase 4 migrations have already been applied, as explicitly confirmed by the owner. Do not reapply them. The order above remains for fresh/missing-migration environments.

Use the owner's Supabase SQL Editor / migration process. The weekly migration installs PostgreSQL btree_gist if missing for concurrency-safe exclusion constraints. Regenerate Database types from the actual project if maintaining generated types. No privileged key is needed in the app. Never publish service-role keys, session tokens or signed links.

### Preservation and authorization

The owner confirmed permission for the intended school-provided textbook collection on 2026-09-12. This project-level statement is not a licence for arbitrary third-party materials or legal advice.

The books migration removes the publication approval CHECK, evidence triggers, approval-based read predicates and old RPC execution grant. Historical books.license_status, its enum, book_rights rows and retired private functions remain; none is a runtime publication gate. Existing publication states are unchanged. No historical book is automatically published.

Signed-in users read published books; students cannot read drafts/archives or write book metadata/files. Storage stays private. Admin publishing and server-verified 60-second signed access remain. Profile, avatar, Top 4, bookmark ownership and reading page bounds are unchanged. Already issued signed URLs can remain usable until expiry; private Storage is not DRM.

The old schedule table and date-based imports remain historical. No dated lesson is silently converted to a recurring week. Student UI and active admin workflow use weekly_schedule. Legacy JSON utilities remain for historical compatibility, not in the current admin page.

## PDF administration

1. Sign in as an administrator; open Admin → Materials → Create record.
2. Enter metadata and select a PDF. The UI displays filename, MiB and byte count before transfer. Choose draft/published/archive.
3. Save. The app validates extension, MIME (empty MIME accepted with a PDF header), size and PDF header; saves a referenced draft; uploads directly to private Storage with the administrator session; verifies stored size/type; saves the requested publication state.
4. Successful saves open the same record. New files use books/<book-id>.pdf. Postgres stores metadata/path, never PDF bytes.
5. To replace, select a new PDF and explicitly confirm replacement. The material becomes a draft during transfer. The canonical object is overwritten, not duplicated; keep originals because the app does not preserve versions.
6. To edit metadata only, do not select a file. Legacy paths remain until a new upload is selected.

PDF transfer bypasses Server Action body limits; only small metadata goes through actions. Bucket restrictions and admin-only Storage policies remain authoritative. Header sniffing is not a malware scanner; only trusted administrators should upload.

### Failure and retry

Metadata is saved before new file transfer. A prepare failure sends no PDF; upload/finalization failure leaves a referenced, recoverable draft. A lost response may follow a committed operation: refresh the record before retrying. Reuse the same book record and confirm replacement when retrying an ambiguous transfer. Do not create another record for each retry. The app does not delete objects after ambiguous network failure.

Replacing a legacy noncanonical path moves the book's reference to its canonical path; the old object is retained for safety. An operator can remove it through the Storage API only after checking all book references and retaining a backup. Never delete storage.objects rows directly. Concurrent edits of one book are not version-locked; coordinate replacements.

### Free-plan limits and bandwidth

Verified 2026-09-12: Free includes 1 GB file storage, 500 MB database, 5 GB egress plus 5 GB cached egress. The UI does not claim exact remaining quota. See [Supabase pricing](https://supabase.com/pricing).

Free's global file limit cannot exceed 50 MB; bucket limits cannot exceed the global setting. This project retains its existing 52,428,800-byte PDF bucket cap (50 MiB); a project's global limit can be lower. Check Storage settings. See [Supabase file limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

The roughly 68 MiB Physics planning PDF cannot upload as-is: compress externally below the effective limit and verify legibility/page count. It was not included in the Phase 4 package; no compressed copy is fabricated.

Standard direct uploads introduce no new dependency. Supabase recommends resumable uploads above 6 MB for reliability; interrupted uploads here restart, not resume. See [standard upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads). Compress further or retry on slow connections.

Reader retains PDF.js 6.3.289's matched legacy worker and Safari-compatible text extraction. One full-buffer download per mounted Reader session avoids later ranges against expired signed URLs. Page changes, zoom, text, bookmarks, theme and locale reuse the document. Leaving/reloading/explicit retry creates a new authorized session/download. No persistent private PDF cache, public URL or IndexedDB copy is introduced. Browser tests count one PDF request per session, two after reload.

## Weekly timetable and CSV/TSV

Admin → Schedule provides an instant week preview and bulk importer. Download [the template](../public/templates/weekly-schedule.csv) in the UI:

~~~csv
class,weekday,lesson_start,lesson_end,start_time,end_time,subject,teacher,room
9H,Mon,1,2,08:30,10:10,Mathematics,Teacher Name,305
~~~

All nine headers are required; optional values may be empty. Additional optional headers effective_from,effective_to accept inclusive ISO dates (YYYY-MM-DD); blank means unbounded. Unrecognized headers are rejected.

- UTF-8 CSV/TSV file or paste from Excel/Sheets; BOM, CRLF, quoted separators/newlines and escaped quotes are supported.
- Limit: 512 KiB and 1–1000 data records. Error rows count CSV records (header is record 1), not physical lines within quoted cells.
- Classes resolve by existing classes.name; subjects by canonical, Kazakh, English or short names. Matching trims, normalizes Unicode and ignores case. Unknown or ambiguous names fail; no rows are silently created. The UI lists accepted names.
- Weekdays accept 1–5 and common EN/RU/KZ names/abbreviations: Mon, Monday, Пн, понедельник, Дс, дүйсенбі, etc.
- Lessons: 1–20. Empty lesson_end means lesson_start. Double lesson 1–2 is one card.
- Optional times must both be blank or both HH:MM, end after start. Teacher ≤100 characters, room ≤40.
- Preview all rows, correct errors and confirm permission/review. Editing or replacing a file invalidates previous preview/confirmation.
- Duplicate natural keys, lesson overlaps and overlapping known times for the same class/day/effective period are rejected. Preview checks existing slots; server repeats validation and PostgreSQL enforces it atomically under concurrent writes.
- Natural key: (class_id, weekday, lesson_start, effective_from). Identical re-imports preserve row count, IDs and update timestamps. Omitted rows are not deleted. Changing a natural key requires explicit removal of the obsolete weekly record after review; conflicts otherwise intentionally reject import.
- Failed validation/transaction leaves valid schedules intact. No browser-side partial commit loop.
- Weekly loading is bounded to 10,000 rows in 500-row pages; over-limit fails explicitly, never silently truncates.

Student Schedule defaults to the profile class and today's school weekday; weekends display Monday of the current week. Day tabs and class changes filter locally without navigation/fetches. Home shows today's effective blocks for the profile class; weekends are empty. Dates use Asia/Oral. Holidays, substitutions and week navigation are not introduced.

### Screenshots, EduPage and scope

No scraping, OCR, AI API or paid parser dependency. For screenshot/photo sources, use an external approved tool to convert to CSV/TSV, then manually inspect every cell. Do not send private/student data to external converters without authorization. [Phase 3 research](schedule-source-research.md) remains authorization background; the active Phase 4 boundary is the weekly database adapter and manual import. No EduPage passwords, session sharing or private endpoint access.

## Verification

~~~sh
NIS_READER_TEST_PDF=/absolute/path/nis-hub-reader-test.pdf npm test
npm run typecheck
npm run lint
npm run build
# Separate terminal:
npm run start -- --hostname 127.0.0.1 --port 3101
NIS_TEST_ORIGIN=http://127.0.0.1:3101 NIS_TEST_CONFIGURED=1 npm run test:http
npm run test:browser
NIS_READER_TEST_PDF=/absolute/path/nis-hub-reader-test.pdf npm run test:browser:phase4
~~~

Install Playwright Chromium/WebKit first; set PLAYWRIGHT_BROWSERS_PATH for a custom installation. Browser tests use real UI/Reader with isolated transport, never privileged production test routes. Verify real admin/student sessions after migration as listed in the [Phase 4 report](phase-4-report.md).
