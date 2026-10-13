# Mobile Liquid Glass UX report

Base: `380c7ec3a5d44c8b5844e3c99038aba12ba152b5` (`main`). Branch: `codex/mobile-liquid-glass-ux`.

## Changes

- Preserved the current Liquid Glass shell and desktop layout. Added a floating, safe-area-aware mobile header and five-tab bottom navigation (Home, Library, Schedule, Community, Profile); the existing drawer keeps the remaining routes available.
- Made Library filters collapsible on phones while retaining the existing in-memory filtering and URL state. Library cards use two columns on standard phones and one column below 360 px.
- Kept Schedule day-first on phones and refined narrow-screen task, profile, and auth layouts.
- Made direct messages a mobile list → conversation → back flow with focus restoration. The desktop split view remains unchanged.
- Refined Reader controls and viewport spacing for small screens. The mobile bottom navigation is hidden while reading to avoid obscuring PDF controls.
- Added reduced-motion and reduced-transparency fallbacks. No backend, RLS, Storage, or database migration changes.

## Validation

- `npm test`: 126 passed, 1 existing environment-dependent Reader test skipped, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 7 pre-existing warnings, 0 errors.
- `npm run build`: passed.
- Playwright: public routes, fixture-backed Home/Library/Schedule/Profile, 320/360/375/390/393/430/768/1440 px, light/dark, RU/KK/EN, mobile navigation, Library filters without data requests, and no horizontal overflow passed.
- Playwright: mobile messages list/conversation/back passed at 320 and 390 px.
- Playwright: Reader with the existing three-page `nis-hub-reader-test.pdf` passed in Chromium and WebKit at 320 and 390 px, including page navigation, zoom, fit page, text, bookmark, and progress behavior.
- Browser screenshots were captured in `/private/tmp/nis-mobile-artifacts/`; they are intentionally not committed.

## Limits and manual checks

- This worktree has no real Supabase environment or authenticated production session. Protected-route browser checks used existing safe fixture data, not user data. A signed-in owner should verify the real mobile Library, Schedule, Diary, Community, Reader, profile, and support flows on a phone before release.
- Real SMS, EduPage, and AI integrations were not changed and were not exercised against live accounts.
- No secrets or `.env.local` files are part of this change.
