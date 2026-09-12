# Phase 4 implementation report

Date: 2026-09-12. Branch: codex/phase-4-books-schedule. Target: main; no automatic merge.

## Scope, baseline and review

Read all six files in the supplied Phase 4 package: 00-START-HERE.md, 01-MASTER-CODEX-PROMPT.md, 02-SCHEDULE-CSV-TEMPLATE.csv, 03-ACCEPTANCE-CRITERIA.md, 04-FIRST-MESSAGE.txt and 05-OWNER-NOTES.md. The master prompt controls the implementation, subject to the owner's explicit requests.

Inspected current GitHub main and created the branch from a149efa96b61c200c34786bad9d58a897c6c0176 (Phase 3 merge). Baseline passed: 43 tests including the existing PDF, typecheck, lint and build. The existing application was extended, not rebuilt. No subagents performed simultaneous rewrites.

Finalization review inspected changed/new application code, SQL, tests and documentation. No unfinished Phase 4 TODO/FIXME markers or placeholder workflow branches remain. Legacy rights types and date-based utilities are intentional historical compatibility, not active runtime gates/UI. Existing legal documents remain explicitly Draft/not legal advice; operator placeholders are pre-existing release obligations, not hidden completed legal work.

## Changes

### Books and private access

- Removed per-book approval/evidence runtime requirements from validation, catalogue/read queries, signed access, reading writes and admin UI.
- Replaced approval-based SQL policies and evidence checks with authenticated published-book access; draft/archive remain unavailable to students. Admin-only metadata/file writes and private Storage remain.
- New metadata-only save_book(jsonb) RPC, administrator check and invoker RLS. Retired execution of the old three-argument rights RPC. Historical licence values and evidence rows are preserved; no automatic publication.
- Project-level collection permission is recorded in setup, based on the owner's explicit statement. It does not authorize arbitrary collections.

### PDF workflow

- Admin PDF selection, visible size, localized validation and 50 MiB cap; extension/MIME/header checks before network.
- Direct authenticated browser-to-private-Storage upload, outside Server Action body limits.
- Referenced draft before upload, then stored size/MIME check before finalization. Failed prepare cannot upload; failed/ambiguous transfer keeps a recoverable referenced draft instead of unsafe compensating deletion.
- Canonical books/<book-id>.pdf, stable retry ID, explicit replacement consent, no accidental duplicate canonical objects. Metadata-only edits retain legacy paths.
- Free-plan limits, external compression, interrupted upload retry and legacy-file cleanup considerations documented.

### Reader audit

PDF.js remains 6.3.289 with its matching legacy worker, Safari-compatible text extraction, v6 canvas render parameters, viewport/DPR transform and cancellation cleanup. The Reader downloads the authorized PDF once into memory; page/zoom/text/bookmark/theme/locale changes reuse that document. The read route now keys the component by book ID, preventing state reuse between different books.

No public URLs, permanent signed links, persistent private PDF cache or range requests after URL expiry were introduced. Reload/explicit retry obtains fresh authorized access and downloads again.

### Weekly timetable

- Additive weekly_schedule model with class, Mon–Fri weekday, single/double lesson range, optional time/teacher/room/effective dates and timestamps.
- Natural-key uniqueness and PostgreSQL GiST exclusion constraints reject overlapping lesson/time blocks, including concurrent writers.
- Atomic administrator-only import RPC, idempotent updates and no implicit deletion of omitted slots.
- CSV/TSV upload or paste, downloadable template, robust quoting/BOM/CRLF, bounded payload, existing/localized reference resolution, row-level validation and preview, explicit confirmation and server revalidation.
- Home uses today's effective blocks for the profile class. Schedule provides local class/day selection, keyboard tabs, one card per double lesson, mobile layout and RU/KZ/EN copy.
- New weekly ScheduleSource boundary. No EduPage scraping, credentials, OCR, AI service or paid dependency.

## Migrations and preservation

1. supabase/migrations/202609120002_phase4_books.sql
2. supabase/migrations/202609120003_phase4_weekly_schedule.sql

Owner explicitly confirmed during finalization that both migrations are already applied to the real Supabase project. The agent did not apply cloud migrations or change credentials. Fresh-project order and rollout cautions are in [setup](phase-4-setup.md).

Historical book_rights, books.license_status/enum and date-based schedule rows are preserved. Old migrations are unchanged. No avatar policy, 60-second cooldown, profile ownership, Top 4 constraint or book-files privacy restriction was weakened. No cloud books, schedules or test users were created by the agent.

## Automated verification

Final required commands (rerun during finalization):

- npm test with NIS_READER_TEST_PDF pointing to the existing local fixture: 49 passing tests, zero skipped.
- npm run typecheck: passed.
- npm run lint: passed.
- npm run build: passed (Next.js 16.3.4 production build).

Additional verification during this implementation:

- Phase 4 Chromium/WebKit browser suite: 7 passing tests (parent + six browser cases).
- Existing Phase 3 browser suite: 7 passing tests, including instant library filtering, Top 4, expired-avatar recovery, themes/locales, legal drafts and logged-out access.
- HTTP smoke against the configured, logged-out production server: 3 passing tests. Tests explicitly support Next 16 streaming redirects and bound request timeouts; default unconfigured mode is retained.
- Actual signed-access route tested with isolated session/Storage boundaries: authenticated published access without historical approval; logged-out/draft/archive/invalid-path denial; 60-second signing; no-store/no-referrer; sanitized provider failure.
- PGlite applies all actual migrations and exercises RLS, historical preservation, published/draft/archive access, student file-write denial, reading ownership, atomic failed imports, idempotence, unknown references, overlaps and weekly defaults.

An initial browser failure was Playwright's own >50 MB in-memory file-upload limit; using a browser File/DataTransfer tests the app's rejection correctly. An initial optional HTTP invocation used its obsolete default unconfigured target; rerun used explicit configured mode and port 3101. These are resolved test-harness issues, not ignored failing assertions.

The existing nis-hub-reader-test.pdf has four actual pages (three content pages plus a blank fourth). Runtime tests render all four; browser tests verify visible page ink, page navigation, zoom, text, bookmark and progress. The file and screenshots stay outside the repository.

## Browser/manual evidence and remaining real-session checks

Completed in isolated Chromium and WebKit with production components:

- Day/class switching changes the view with zero requests and no navigation; keyboard arrows/Home work.
- CSV and TSV preview/confirm/import, row errors, double blocks, mobile width and RU/KZ/EN.
- Small PDF create/publish and explicit replacement workflow; oversized file blocked before requests.
- Real PDF.js canvas content, pages, zoom, text, bookmark/progress persistence through the simulated storage boundary.
- Exactly one signed-access/PDF request per Reader session, including theme/locale changes; a reload makes the second authorized download.
- Visual inspection of WebKit mobile timetable and rendered Reader screenshots.

Browser transport boundaries are synthetic and SQL tests model PostgreSQL, not GoTrue/Storage HTTP. These do not establish live cloud upload/expiry behavior. Applying migrations is confirmed; successful completion of all live Phase 4 workflows has not yet been separately confirmed.

Remaining checks using real sessions (no secrets or signed URLs should be shared):

1. Admin: upload a small permitted PDF, publish without per-book evidence, inspect the single private canonical object, open Reader, then replace with a visibly different PDF using explicit confirmation. Confirm latest content after reload.
2. Student/logged-out: published material opens only when signed in; draft/archive and file mutation are denied. Archive a test book and confirm a fresh signed-access request is denied; previously issued links can remain valid until their 60-second expiry.
3. Admin: import a permitted CSV and pasted TSV using actual class/subject names; repeat to confirm no duplicates. Submit an invalid/overlapping batch and verify the previous valid timetable remains. Check Home for today's profile class and Schedule across weekdays.
4. Live Reader: after signed URL expiry, page/zoom changes retain the loaded PDF; after reload it gets fresh access. Confirm bookmarks and reading position persist in real Supabase.

## Known limitations and release notes

- Full-buffer Reader trades memory/bandwidth for reliable short-lived signed access; it is not range/resumable loading.
- Standard PDF uploads restart after interruption; resumable uploads and exact quota telemetry are not included.
- The package mentioned a ~68 MiB Physics PDF but did not include it. External compression and legibility validation remain owner tasks before that file can be uploaded.
- Legacy replaced noncanonical files are retained for safe operator cleanup after reference/backup checks. Replacements do not retain canonical file versions; concurrent admin edits are not version-locked.
- Weekly data uses current-week effective dates, not automatic holidays/substitutions or arbitrary week navigation. Old dated rows are not guessed into recurring weeks.
- Imports are limited to 512 KiB / 1000 records; weekly initial loading fails explicitly above 10,000 rows. The existing admin book list displays up to 200 with direct-ID retrieval; the student library retains bounded pagination and its explicit cap.
- New workflow copy is RU/KZ/EN; the existing general admin shell/reference-management labels remain Russian.
- No cloud permission/RLS weakening, paid dependencies, OCR or unauthorized EduPage access was added.

## Handoff

The branch is intended for a pull request to main, not automatic merge. Required checks, staged-file/secret inspection and the final commit are performed before pushing. Do not re-run already applied migrations. Complete the real-session checks above before release.
