# Phase 3 implementation report

Date: 12 September 2026  
Repository: `doniar4/NIS-Hub`  
Branch: `codex/phase-3-experience` → `main`  
Base: `c00dc4d882d7e4421f5665181cca850c1df54c67` (main rechecked on 12 September). No work was performed directly on main; no merge was requested or performed.

## Scope and baseline

All six handoff files were read, with `01-MASTER-CODEX-PROMPT.md` controlling and the implementation sequence from `02-IMPLEMENTATION-ORDER.md`. The continuation kept the existing branch and the owner's `c94b93c` commit. Existing Next/Supabase architecture was extended, not rebuilt.

Initial Phase 3 baseline: lint, typecheck, build and 26 tests passed, including the local PDF fixture. Continuation baseline after the existing theme/localization/avatar work: 33 tests passed. Independent agents were used only for read-only security/Supabase, accessibility/i18n and QA review.

## Changes

- **Theme:** Light/Dark/System, local persistence, OS changes and storage-event synchronization, pre-paint resolution, semantic dark tokens and keyboard-friendly control. Selected-text contrast corrected in dark mode.
- **Localization:** central RU/KZ/EN dictionaries, locale cookie and server/client provider, correct HTML `lang=ru/kk/en`, localized core student flows and legal pages. Stored subject translations are used with a fallback to the original name; book titles and user content are not auto-translated.
- **Reader:** localized controls/errors without coupling document/render effects to dictionary identity. Existing PDF.js 6.3.289 legacy worker, Safari text-extraction fix, canvas lifecycle, cancellation, signed book access and progress/bookmark behavior are retained.
- **Top 4:** controlled unique selections disable chosen subjects in other slots. Existing server schema, atomic profile RPC and database uniqueness remain intact.
- **Avatar:** private fixed `<uid>/avatar.webp`, JPEG/PNG/WebP ≤2 MiB input, real decoding/MIME check, static image only, ≤16 million pixels, metadata stripping and 256×256 WebP output. Overwrites the existing object, then updates the profile. Timestamp-backed localized cooldown feedback; eager preview plus explicit retry/re-signing recovery for failed or expired image requests.
- **Library:** server loads approved published metadata and reference options for initial rendering. Books use keyset pagination, 200 per request, up to 5000 plus a one-record truncation probe. `LibraryBrowser` owns local `q/classId/subject`, memoized filtering, exact IDs and case-insensitive title search. Native `history.replaceState` updates the URL; no filter action form, router navigation or filter-triggered Supabase request. Links disable prefetch. Reset restores the loaded catalog; explicit empty class survives reload despite a profile default. Fresh route props reset stale local filters.
- **Privacy/Terms:** implementation-grounded drafts in all three languages covering Auth, profiles, avatars, reading, Supabase, cookies/localStorage, retention/deletion limits, minors, rights and beta status. Operator/contact/effective-date/hosting details remain visibly unfilled, with no legal-compliance or school-endorsement claim.
- **Schedule:** [official-source research](schedule-source-research.md), normalized `ScheduleSource` boundary, school-authorised manual JSON adapter and admin preview/confirmation. Strict versioned payload, ≤256 KiB, 1–500 lessons, existing references and unique dated slots. New admin-only invoker RPC performs atomic idempotent upserts, never implicit deletion.
- **Documentation/testing:** replaced outdated README/setup claims; added pagination, locale/legal, image, all-migration SQL and Chromium/WebKit coverage.

## Migrations and data safety

1. `202609110001_phase3_avatar.sql`: already applied according to the owner. Private canonical ownership, ≤256 KiB WebP bucket, existing-object profile guard and 60-second replacement policy. No DELETE policy. Do not reapply.
2. `202609120001_phase3_schedule_import.sql`: new additive admin import function; **not applied to the live cloud database by this agent**. Review and apply once before using bulk import.

The initial schema and Phase 2 migration were not replayed against the live project. No book metadata, publication state, book-file policy, authorization requirement or existing RLS was weakened. No live schedule/import, auth account creation, object deletion or privileged-key use was performed by the agent. See [migration instructions](supabase-setup.md).

The avatar guard is a practical sequential 60-second restriction, not a strict distributed/concurrent rate limiter. Storage preflight and upload completion are separate. Canonical naming plus bucket constraints prevent unbounded new avatar filenames. Browser timing is not the security boundary.

## Automated verification

Final commands:

| Check | Result |
| --- | --- |
| `NIS_READER_TEST_PDF=<existing local PDF> npm test` | 43 passed, 0 failed, 0 skipped |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed, Next.js 16.3.4 production webpack build |
| `npm run test:browser` with installed Chromium/WebKit | 7 passed, 0 failed |
| `git diff --check` | Passed |

The exact existing `nis-hub-reader-test.pdf` was tested, not replaced. This local file contains three content pages plus a fourth blank trailing page. Runtime checks cover all pages, back/forward sequence, extracted text, zoom/DPR, cancellation and the Safari missing-stream-iterator regression.

New PostgreSQL tests apply **all** migrations in disposable PGlite. They cover avatar first insert, immediate UPSERT denial, successful replacement after 61-second fixture aging, one remaining object, cross-user/noncanonical/anonymous denial, failed-upload/profile ordering; admin-only imports, duplicates/limits/invalid fields, atomic rollback, idempotence and retention of omitted lessons. An all-migrations regression additionally verifies approved/published private book visibility, draft/anonymous denial, role protection, Top4 uniqueness, bookmarks/progress ownership and archive behavior.

PGlite models PostgreSQL/auth/storage schema surfaces, **not** the Supabase Storage HTTP service.

## Browser and manual verification

Automated Chromium and WebKit checks use:

- Real client components with synthetic data on a separate loopback fixture server: 125 books, initial query restoration, instant title/class/subject filters, keyboard reset, unchanged document identity and **zero requests after initial load** during filtering. Fresh route-prop reset, Top4 disabled options/keyboard selection, translated subject names, failed-image retry, invalid/valid import preview and submission are covered.
- The actual production Next app for Light/Dark/System, OS dark preference, theme reload persistence, RU/KZ/EN cookie persistence and HTML language, both legal pages, responsive layout, anonymous protected-page redirects and 401 private PDF access.
- A disposable local HTTPS proxy for production Secure cookies; production cookie settings are not weakened. Tests wait for route prefetches to settle before intentionally navigating again.
- No production test route, auth bypass, personal browser session or cloud mutation. Import submission and image 403 recovery in the component harness are synthetic boundary tests, not live-server claims.

Screenshots were visually inspected for library layout and mobile dark Privacy. Generated screenshots are local diagnostic artifacts, not checked-in user data.

**Owner-confirmed real-session checks on 12 September 2026:**

- Avatar migration applied.
- First avatar upload succeeds.
- Immediate replacement displays cooldown.
- Replacement after 60 seconds succeeds.
- Waiting more than a minute and reloading restores a visible avatar with refreshed signed access.
- Library title/class/subject/reset update results and URL without new Network requests.
- Top4 prevents reuse of a selected subject.

These confirmations are attributed to the owner, not represented as agent-controlled authenticated browser tests.

## Schedule research conclusion

The owner supplied [NIS Uralsk EduPage](https://nisuralsk.edupage.org/timetable/) and indicated permission. A single credential-free GET returned 200 for the timetable landing page. Official sources document administrator exports, XML configuration, changeable temporary IDs and configurable public visibility.

A stable general-purpose API, exact automated-access terms and documented school permission scope were **not established**. Public landing-page access is not an automation licence. Phase 3 therefore stops at research + adapter + authorised manual import. There is no scraper, hidden-endpoint client, credential collection or background polling. Details and primary-source links are in the [research document](schedule-source-research.md).

## Known limitations and release gates

- Apply the **new schedule import migration** before using that UI. No live school export/import was available for end-to-end verification.
- Catalog search covers at most 5000 initially loaded books and explicitly warns when truncated. It is a bounded snapshot, not a realtime catalog; simultaneous catalog changes may require reload.
- Avatar signed links last 60 seconds. Expiration does not remove already-decoded pixels or revoke downloaded copies. A failed new image request can be retried; no continuous refresh/polling is added. Supabase CDN propagation may delay an overwrite despite requesting zero cache age.
- Image byte validation applies to the app upload pipeline; direct Storage clients remain subject to the provider's MIME/size checks and canonical RLS.
- Some legacy administrator CRUD/setup text remains Russian; core student UI, preferences, Reader, legal pages and the new import flow are localized. Existing action feedback can retain its submission language until the next action.
- Legal drafts are not launch-ready legal advice. Operator/contact, real hosting/region, retention periods, request handling and minors-related requirements need owner/legal review.
- School approval must define permitted data, audience, stable IDs, term/week/substitution handling and refresh responsibility. The single-slot internal model does not automatically resolve split groups.
- Full authenticated admin/Reader browser regression was not automated with live credentials; existing runtime/SQL coverage was retained and expanded. No claim of comprehensive screen-reader or live concurrency testing is made.

## Handoff

Open a pull request from `codex/phase-3-experience` to `main`; do not merge automatically. The PR should retain migration and legal/schedule release gates above.
