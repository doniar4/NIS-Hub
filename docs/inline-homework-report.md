# Inline daily-schedule homework

Implemented locally on 2026-10-05 against current main `517359eff32defd63a843350f15857233df897fc`. No deployment, push or production migration was performed.

## Changed files

- `src/app/actions/homework.ts`
- `src/components/day-homework-provider.tsx` (new)
- `src/components/inline-lesson-homework.tsx` (new)
- `src/components/weekly-schedule.tsx`
- `src/components/home-study-dashboard.tsx`
- `src/components/homework-preview.tsx`
- `src/components/class-homework.tsx`
- `src/lib/daily-homework.ts` (new)
- `src/lib/v053-copy.ts`
- `src/styles/pages.css`
- `tests/daily-homework.test.ts` (new)
- `tests/inline-homework-browser.smoke.ts` (new)
- `tests/browser/inline-homework-harness.tsx` (new)
- `tests/homework-telegram-cta.test.ts` (action fixture export only)
- `tests/v053-browser.smoke.ts` (action fixture boundary only)
- `tests/liquid-glass-browser.smoke.ts` (action fixture export only)
- `tests/redesign-browser.smoke.ts` (action fixture export only)
- `docs/inline-homework-report.md` (new)

## Data and security

- Source remains `public.class_homework`. No table, policy, database RPC, Telegram code or environment variable was added/changed.
- Existing `loadHomework(date, offset)` still returns 20 records per page. Its read query is shared with `loadDailyHomework(date)` in the same server-action module. Both validate input, authenticate via `actionContext`, derive the class from the logged-in profile and require the requested date, `moderation_status = visible`, and `deleted_at IS NULL`.
- The day action authenticates once and normally executes one homework query (up to 1,000 rows). Larger days use bounded 1,000-row pages, independent of lesson count. Above 10,000 records it reports failure rather than displaying a silently incomplete day. There is no N+1 query per lesson and no silent 20-record truncation.
- `DayHomeworkProvider` is page-scoped, not a shared/global private-data cache. Home rows and preview share it; Schedule rows, preview and the existing editor share it. Editor pagination slices the loaded day locally. If the editor chooses a different date independently, it uses its own date-scoped load.
- Grouping uses canonical `subject_id`, displayed date, visibility/deletion and class checks. Browsing another class never displays the current user's homework on that class's lesson rows or requests that other class's private homework. The existing editor remains the logged-in user's class editor.
- Day/class/revision tags and effect cleanup prevent previous-day flashes and stale asynchronous responses. `nis-homework-change` refreshes the shared day once; existing quick-add plus editor save/delete use that same event.

## Presentation

- Desktop: secondary homework text occupies the middle column between lesson information and the existing action buttons. Rows without matching homework render no homework element or empty-state label.
- Narrow lesson containers (including mobile/tablet): homework moves below subject/room information; materials and action-menu controls remain in the row.
- Collapsed native `details` shows a two-line preview and assignment count. Keyboard-accessible expansion reveals every full body in a bounded, focusable scrollable list. Plain React text rendering preserves line breaks without executing HTML.
- RU/KZ/EN labels use the existing dictionary; typography/colors use existing tokens. No modal, card per lesson, new dependency or teacher field was added.
- Load failure leaves lessons/actions functional and removes inline data; the existing single homework-preview error/retry handles recovery.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `NIS_READER_TEST_PDF=/path/to/existing/nis-hub-reader-test.pdf npm test`: 175 passed, no failures/skips. Existing SQL/RLS, auth, Telegram and PDF regressions included.
- `npm run build`: passed.
- `node --import tsx --test tests/inline-homework-browser.smoke.ts`: passed with Chromium and WebKit against actual components and built CSS, using isolated safe test boundaries. Covers one shared request, subject/date matching, native expansion/full bodies, real two-line clamp, late-response protection, day navigation, quick add/edit, refresh, class isolation, action controls, graceful errors, keyboard focus, RU/KZ/EN, light/dark and 320/390/768/1440px without horizontal overflow.
- Screenshots are local fixture artifacts under `test-results/inline-homework/`, not committed production/student captures.
- Existing browser fixtures were updated only to recognize the new shared day-read action; no production service was mocked in application code.

## Owner checks

No migration or new configuration is needed. Before deployment, verify in an actual authorized Supabase session that the same visible homework appears in Home/Schedule for the displayed day, editing/deleting refreshes it, and selecting another class does not expose it. Browser integration tests do not prove a live production session or deployment.
