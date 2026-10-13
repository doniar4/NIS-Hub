# Admin control center — implementation report

## Scope and base

Branch: `codex/admin-control-center`, based on current main `0c6d292ef589fef2bbc229e718396b699f36fa82`. Started from a clean worktree after inspecting existing admin tools, homework/actions, migrations, auth/security patterns and the configured Supabase schema using read-only queries. No production data was changed. No push, merge, deployment or production migration was performed.

## Routes and reused functionality

| Area | Routes | Implementation |
| --- | --- | --- |
| Overview | `/admin` | Operational stats, unique-user chart, class activity, recent registrations/actions, compact configuration summary |
| Users | `/admin/users`, `/admin/users/[id]` | Name/class/role/activity filters, 25-row pagination, safe profile details, confirmed class/role changes |
| Activity | `/admin/activity` | Online estimate, today/week unique users, class filters, readable events, coarse device/browser distribution |
| Homework | `/admin/homework` | Existing `class_homework` statistics/filtering, provenance evidence, full text and existing confirmed moderation |
| Schedule | `/admin/schedule`, `/import`, `/versions`, `/calendar`, `/classes` under it | Existing weekly browser, CSV/TSV import, immutable versions/diff/rollback, non-school days, Classes and EduPage |
| Content | `/admin/content`, `/admin/content/subjects` | Existing BookEditor/book actions and multilingual subject/class admin actions, with filters and pagination |
| Support | `/admin/tickets`, `/admin/community` | Existing tickets/conversations and community moderation inside the shared shell |
| System | `/admin/system` | Safe configuration booleans, separate DB reachability, validated build metadata and explicit telemetry limitations |

Legacy entity/calendar/version URLs use guarded internal redirects. Selected book IDs and applicable version IDs remain usable. Root application navigation and current Liquid Glass/theme/typography/mobile design are preserved.

Removed from Overview: giant tool shortcut grid, import/change history and pageviews/popular-page analytics. Version history lives only under Schedule. Existing activity recording is retained; the unused old pageview-count admin query is removed.

## Fast navigation and data boundaries

- Shared `/admin/layout.tsx` keeps the application shell, header and eight-section navigation mounted. Schedule and Content have persistent secondary navigation.
- Next.js Links provide client transitions. Main and nested tabs opt into automatic partial prefetch on **hover/focus intent**, not eager loading of every report. Selected state and a pending indicator respond to navigation. Forms use router navigation rather than native document reloads.
- `loading.tsx` plus independent widget Suspense boundaries prevent one slow chart/report from blocking the shell or unrelated widgets. Overview stats/chart/classes/registrations/feed, Users filters/results/detail/feed, Activity widgets, Homework widgets, Schedule/EduPage, Support list/stats and System DB probe load progressively.
- React request-local `cache` deduplicates identical report calls. Existing request-local auth/database/catalog helpers are reused. No shared public cache of private user data, module-level private store or giant client SPA was introduced.
- Reports use one guarded SQL RPC per widget and return bounded results. User/feed/homework/content pages use 25-row pagination. Latest-user activity is an indexed lateral lookup within **one SQL request**, not one Supabase request per user. Chart output is bounded to 24/7/30 points. Metadata, independent queries and editor reads run in parallel where appropriate.
- Chart range selection updates immediately; only that chart requests a new range. A 30-second cache belongs to that component instance, not other users. Server-formatted labels avoid Node/browser locale-format hydration differences.
- Weekly deletion renders one lazily selected confirmation form, replacing a form per lesson. Heavy existing Reader/PDF/AI libraries are not added to the admin shell. The new small chart uses CSS/native accessible details instead of a chart-library dependency.
- DB reports have a 10-second application timeout; the separate System probe has 5 seconds. Missing migration/query errors produce a localized unavailable state, not a hung application or raw database error.

There is no reliable pre-change production latency dataset. Browser instrumentation measures local fixture-backed transitions and verifies **zero document reloads**, persistent actual shell nodes and streamed loading with a deliberately delayed chart. It is not a claim of production response-time improvement or Supabase uptime.

## Database and security

New additive migration: `supabase/migrations/20261006171912_admin_control_center.sql`.

New objects: `admin_control_read(text,jsonb)`, `admin_update_user(uuid,uuid,text,text,boolean)`, `admin_activity_user_recent`, `admin_telegram_homework_source`. No tables/columns are added and no existing policy, profile grant, homework RPC or Telegram backend is weakened. Migration is tested in isolated PostgreSQL but **not applied to production**.

Every admin route, data boundary and privileged mutation checks current server-side admin authorization. Reporting RPCs also verify `auth.uid()` and the database admin role, use an empty search path, revoke PUBLIC/anonymous execution and expose selected data only. No service-role browser client, auth-email query or OAuth change is introduced.

User changes require explicit confirmation and expected-role validation. A transaction advisory lock serializes role mutations and rechecks authorization before rejecting last-admin removal. Only class/role/update timestamp change; name/preferences/Top4/saved data are preserved.

Homework hide reuses the existing admin-only moderation action/RPC. Telegram origin uses actual successful publication evidence, not the technical author's identity. Raw tracker URLs/query strings and raw user agents are removed before UI/client serialization. Device/browser categories contain no version, fingerprint, IP or new tracking field. Provider configuration is converted to whitelisted status booleans; secrets/raw errors are never rendered.

## Truthful limitations

- Online means a logged activity within 15 minutes. Existing tracker does not prove continuous presence or reliably record signed-in/homework-created/AI-used business events. Unknown routes receive a generic readable label; such actions are not invented.
- No trusted cross-user email search is added. User reports intentionally contain no auth emails.
- Error telemetry and runtime performance monitoring do not exist in this repository; UI explicitly reports that, with no fake counts or new log-retention policy.
- System config health is not a live third-party service probe. Only the separately scoped authenticated database query verifies current reachability.
- Unread-admin-ticket counts are not inferred without a reliable admin read marker. Open/waiting counts and resolution transitions are supported.
- Existing moderation supports hide, not unhide; no alternate direct update path was added. Homework creation keeps the existing profile-derived own-class workflow. Unknown origins are not labelled website, and Telegram source evidence depends on retained successful update records.
- Production-scale query plans and latency require staging/production observations. Exact aggregate work happens on relevant widgets, not every route transition; no blind search/index proliferation was introduced.
- Browser QA uses real Next routes/build against isolated fixture Auth/Data transport and PostgreSQL/RLS. It does not prove real GoTrue/OAuth/SMS/Telegram/EduPage integration or physical-device Safari address-bar behavior.

## Files

Application: shared/nested admin layouts, pages/loading/error boundaries; `src/app/actions/admin-control.ts`; existing activity/admin/book-editor/EduPage wiring; new `admin-*` UI/data helpers and `src/styles/admin.css`; typed RPC declarations. Existing ticket/community workflows are moved into the shared layout, not recreated.

Database: one additive migration listed above.

Tests: `tests/admin-control.test.ts`, `tests/admin-control-db.test.ts`, `tests/admin-browser.smoke.ts`, expanded protected HTTP routes and updated existing fixture assumptions. Browser screenshots use only synthetic Demo Admin/Student and stay in ignored `test-results/admin-control/`.

## Validation

Validation results and browser evidence are recorded below after the final rerun. Setup, optional metadata, manual checks and compatibility rollback are documented in [admin-control-center-setup.md](admin-control-center-setup.md).
