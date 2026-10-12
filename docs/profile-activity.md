# Profile activity and visits

Apply `supabase/migrations/202610120003_profile_activity.sql` after the existing activity-log migrations, only if it is absent from the target project's migration history. The app deploy does not apply SQL migrations. The migration adds an index and the authenticated `profile_activity_year()` RPC; it does not rewrite existing history or expose the raw log table to users.

The profile passes real daily page-view totals to the supplied Contribution Skyline component. Every visible navigation or a return to the tab after at least a minute records a visit through the existing `log_user_activity` action. A visible tab crossing midnight records the new local day; the timer only checks the date and does not log idle pings every minute. Existing best-effort transport error handling remains intact.

Daily boundaries use `Asia/Oral` in SQL and the client. The current streak is consecutive active days ending today, or yesterday while today is still open. Page views affect the cell intensity; multiple views on the same day never add multiple streak days. The longest streak covers the displayed year. Old stored visits appear automatically; absent historical records remain empty.

The authenticated RPC accepts no user ID and returns at most 371 date/count pairs for `auth.uid()` only. Paths, device strings, identifiers and other users' records never reach the chart. A missing migration or failed fetch displays an unavailable state with a retry button instead of sample statistics.

The supplied Dock component is now the fixed mobile navigation bar, replacing the previous mobile tabs. It links to home, library, schedule, community and profile, preserves the active route and the incomplete-profile indicator, and stays hidden on desktop and in the PDF reader. Each circular link has one native keyboard target and a 44-pixel touch area. Theme controls remain in the header.

## Font fallback

Local Fontsource variable files use `font-display: optional` and a full system-font stack. Text remains readable if the files are delayed or blocked. The pre-paint script selects system fonts immediately when the browser reports data saving or a 2G connection. Browsers without the connection API use native CSS fallback. Root error pages use the same rules; no external font CDN is needed.

## Verification

- `node --import tsx tests/profile-activity.test.ts`: daily boundary, streaks, missing days, owner-only SQL aggregation and preserved raw-log privacy.
- `node --import tsx tests/profile-activity-browser.smoke.ts`: requires a production build for CSS. Tests flat/3D views, keyboard/tooltips, orbit, visit refresh, mobile dock links/active route/touch targets, header theme, RU/KK/EN, 320/390-pixel mobile widths, blocked fonts, slow connection and unavailable/retry states. Screenshot data is an isolated test fixture, never a production fallback.
