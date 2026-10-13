# Admin control center — setup and production verification

## Compatibility and deployment

Implementation branch: `codex/admin-control-center`. Base: `0c6d292ef589fef2bbc229e718396b699f36fa82` (current main inspected before implementation).

No production deployment, migration application, push or merge is performed by this task. Existing authentication, roles, private Storage, student homework, Telegram publication, SMS and EduPage connectors are reused.

After reviewing and approving the code, apply this **new migration after all existing migrations**:

```
supabase/migrations/20261006171912_admin_control_center.sql
```

It creates two authenticated, database-admin-guarded RPCs (`admin_control_read`, `admin_update_user`) and two justified indexes (`admin_activity_user_recent`, `admin_telegram_homework_source`). It creates no tables, broadens no table grants, and changes no existing RLS policy. Profile reports intentionally omit emails, bios, avatar locations and preferences. The role mutation RPC requires confirmation, rechecks the caller under a transaction advisory lock, checks the expected current role and prevents removal of the last admin.

Deploy the reviewed build only after the migration. Without it the navigation and existing tools remain available, but new reporting widgets show a localized unavailable state and new user mutations fail safely. Do not grant broad profile access or substitute a browser/service-role client to make reporting work.

## Environment

No new required secret or provider credential. Keep existing working Supabase, Telegram homework/support, Gemini and EduPage configuration unchanged.

Optional version metadata:

- `VERCEL_GIT_COMMIT_SHA`: automatically supplied by Vercel where available; alternatively set `NIS_BUILD_COMMIT` to the reviewed hexadecimal commit SHA.
- `NIS_BUILD_TIMESTAMP`: an approved build's UTC ISO timestamp, e.g. supplied by the build pipeline. No timestamp is invented when absent.

The System page exposes only validated version metadata and configuration booleans, never environment values or raw provider errors. Configuration completeness is **not** a successful Telegram delivery, OAuth login, Gemini generation or EduPage sync. Supabase reachability is a separately timed, authenticated read; it is not uptime monitoring.

## Real-session production checklist

Use separate authorized admin and student sessions; do not share credentials in chat.

1. Verify every `/admin/*` URL redirects logged-out visitors to authentication and students to Forbidden, including direct nested URLs. Confirm private robots directives remain in place.
2. As admin, click/focus all eight main links rapidly, Back/Forward, and reload a nested route. The shared header/navigation must persist on client transitions; slower widgets may show their own skeleton. Verify no full-document requests for section navigation in Network. There must be no blank entire application or repeated request loop.
3. Check Overview counts against authorized SQL for the same `Asia/Oral` day. Online means **activity in the last 15 minutes**, not proven presence. Switch chart 24h/7d/30d: counts are unique tracked users per bucket, not pageviews. Confirm no popular-page ranking or shortcut/import grid.
4. Search Users, filter class/role/today/week, paginate and open details. Verify no email exposure. With two authorized test admins, confirm class/role changes preserve existing profile settings and saved data. Reject unconfirmed and stale changes. Test the last-admin rejection in staging, not by risking the only production admin.
5. Check Activity class filtering, readable known-route labels, coarse device/browser distributions and refresh. Unknown paths must display a generic action, not URLs or query strings. Route tracking cannot prove an AI generation, login or homework submission; those events are not fabricated.
6. Check Homework class/subject/due/status/source filters, deleted exclusion, expanded full text and confirmed hide. The Telegram badge requires a successful matching `telegram_homework_updates.homework_id`; other sources remain **unknown**, never assumed website. Existing published bot rows may age out of that evidence. Add homework via the existing own-class Schedule workflow; verify the bot and student UI are unchanged.
7. Test Schedule Current, import preview/confirmation, Versions/diff/rollback, Calendar and Classes. Verify EduPage's existing preview/sync/subgroups and CSV/TSV validation. Legacy `/admin?entity=...`, `/admin/versions` and `/admin/calendar` links must redirect to the matching new area while preserving applicable selection IDs.
8. Test Content book search/subject/grade/publication filters, pagination, selected record outside the current list page, create/edit/archive, variants/private PDF upload and multilingual Subjects editing. Verify Library/Reader private access still works.
9. Open Support and Community moderation. Test owner/admin ticket isolation, replies, status history and existing Telegram notification delivery. `Resolved today` counts actual resolution transitions, not an estimate from `updated_at`. There is no fabricated unread metric where no admin read marker exists.
10. Check System configuration status with real integrations; missing optional services must not appear as verified outages. Confirm error telemetry/performance metrics say not configured and no tokens, cookies, provider URLs or raw exceptions appear.
11. Test Chromium and iOS Safari at desktop/tablet/390px/320px, light/dark, RU/KK/EN, 200% zoom, keyboard and reduced motion. Tabs may scroll inside their own strip; the document must not scroll horizontally. Check dropdowns, confirmation controls, native details and mobile bottom navigation.

## Rollback / compatibility

Prefer reverting the reviewed **application release** through the normal deployment workflow, not resetting user data. The previous application safely ignores the two additional RPCs/indexes. Leaving the additive migration installed is the preferred rollback because no existing data format or permissions changed.

If separately approved, the migration's objects can be removed in a later reviewed migration: drop exactly `public.admin_control_read(text,jsonb)`, `public.admin_update_user(uuid,uuid,text,text,boolean)`, `public.admin_activity_user_recent`, and `public.admin_telegram_homework_source`. Do not remove activity/homework tables or alter existing policies. No automatic down migration is executed.

## External security follow-up

Read-only inspection found existing Supabase advisor warnings outside this patch, including disabled leaked-password protection. Review [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) with the owner. Generic SECURITY DEFINER advisor notices do not alone prove a vulnerability; all newly added functions authenticate and check the database admin role internally and revoke anonymous execution.
