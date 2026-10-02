# NIS Hub navigation and performance audit — 2026-10-02

Scope: current branch based on `757e775`, focusing on frequent Home/Schedule navigation without changing auth/RLS or shared caching. Measurements below distinguish inspected query shape from actual timed browser results; no authenticated test account was available in this agent's browser session.

## Initial problems and root causes

1. Home and Schedule call `getTimetableMaterials()` to choose textbook destinations for lesson cards. It called `getLibraryBooks()`, which paginates **all** published books in 200-row pages up to 5,000 and scans published editions in further 200-row batches. That entire catalog was loaded again on Home/Schedule server navigation before reducing it to the few schedule subjects. This was a request/row-count waterfall, not a rendering problem.
2. Main navigation already uses Next.js `<Link>` and an optimistic active indicator, but set `prefetch={false}` on every route. That avoids eager private-data requests, yet common destinations could not warm on hover or keyboard focus. The existing root and section `loading.tsx` files provide skeletons; there was no blank-page fallback to invent.
3. `SiteShell` is rendered per page and signs the user's avatar URL; `NotificationCenter` mounts with it and polls every 15 seconds. This can re-run viewer/avatar/notification work between sections. Moving it to a persistent authenticated layout would be broader than this safe patch because public welcome and authenticated routes share `/`, so it remains an explicit bottleneck for a later measured refactor.

## Changes made

- `src/lib/schedule-material-queries.ts` now queries only published books matching the timetable's canonical subject IDs and grade(s), selecting `id,title,subject_id,grade` and capping at 1,000. It checks only those books' published editions, starts the independent reading-preference query concurrently, and retains the existing `materialDestinations` logic. The cap always degrades to the filtered Library URL rather than guessing one textbook. RLS remains in force; no private result is placed in a cross-user cache.
- `src/components/app-frame.tsx` keeps automatic prefetch disabled for every private link, but warms likely `/`, `/library`, `/schedule`, `/profile` routes on pointer hover or keyboard focus. Expensive/rare pages are not prefetched indiscriminately. The existing optimistic active state and mobile drawer behavior remain.
- `tests/schedule-material-query.test.ts` checks the bounded subject/grade query, narrow selected columns, published-edition navigation, and safe fallback for missing/capped results. No new database index was added: `books_grade_subject_idx` already exists in `supabase/migrations/202609150001_v051_book_grades.sql` for `publication_status,grade,subject_id`. The live advisor's unindexed-FK and unused-index observations are not enough to justify blind migrations.

## Before / after observations

| Observation | Before | After | Evidence/limit |
| --- | --- | --- | --- |
| Home/Schedule book metadata | Full Library scan: up to 5,000 books in 200-row pages, then edition batches | One bounded published-book query with relevant subject/grade IDs, then edition batches only for returned books | Static query path and isolated integration test; **not** a production latency measurement |
| Independent reading-progress query | Started after full catalog and edition scan | Started before book query and awaited with edition batches | Code path and test |
| Main nav warm-up | All main links `prefetch={false}` | Only four likely destinations prefetch on hover/focus; links remain client-side | Code inspection; authenticated browser timing not measured |
| Browser bundle | No dependency was moved or added for this optimization | No bundle architecture change; `.next/static/chunks` was about 2.5 MiB before this patch | Aggregate build artifact, not per-route transfer size |
| Database indexes | Existing grade/subject and browse indexes | Unchanged | Migration inventory |

## Other routes and tabs reviewed

- Library intentionally loads its catalog once on route entry, then filters locally with `useMemo` and URL `history.replaceState`; no per-keystroke Supabase request was found. Its 5,000-book ceiling is explicit. It is a separate route, so the full catalog cost is appropriate there rather than on every schedule view.
- Weekly schedule and welcome/auth tab selection are local React state; no tab-triggered route navigation or duplicate query was found. Admin URL-driven tabs refetch on navigation, but are rare and security-sensitive, so they were not converted into shared client caches.
- Main internal navigation uses `<Link>`; the `window.location.assign` calls found in browser **system notification** click handlers are a separate browser context, not ordinary app tab navigation. External SMS links remain external. Reader/PDF and AI modules are not imported into the global shell.
- `getCatalogOptions()` and viewer calls use React request-local `cache()` where present; private data is not stored in a global cache. Home's independent weekly schedule, calendar, reading, tasks and SMS-session checks already use `Promise.all`. The material lookup still depends on the resulting lesson IDs, so a second stage is necessary.
- Next.js route loading boundaries already exist for `/`, Library, Schedule, Diary, Messages, Profile, Support and book routes. No fake delay or full-screen spinner was added.

Local unauthenticated smoke check: Chromium at 1280/390/320px and WebKit at 390px showed no horizontal overflow or page errors, and protected `/library` redirected to login. RU/KZ/EN and light/dark renders showed both gated social controls when flags were enabled. One early DOMContentLoaded sample counted zero controls before streaming completed; waiting for the actual Apple button produced the expected result. These are development-server observations and do not measure signed-in navigation speed.

## Remaining bottlenecks and verification limits

The avatar signed URL and notification polling can repeat across page-level `SiteShell` mounts. Library's intentional full catalog load can still dominate first entry with a large catalog. The new schedule book query is bounded; if a school ever exceeds 1,000 relevant books it falls back safely, but a server-side keyset pagination or aggregate RPC may then be warranted. The current build output does not report useful per-route client JS sizes, so no precise bundle improvement is claimed.

Public desktop/mobile smoke tests can check layout, auth redirects and console errors without private data. Real private-route rapid switching, tab network counts, Back/Forward and first-contentful navigation timings need a consenting non-personal demo account; those checks must not be marked passed from static tests alone. A production performance trace should compare Home→Schedule→Library with and without the patch after deployment, recording RSC request count/duration and actual Supabase query metrics. No database query-plan measurement was possible without modifying or probing production data.
