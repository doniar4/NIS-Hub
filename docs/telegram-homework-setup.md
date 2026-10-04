# Telegram homework publishing

This is an admin entry point into **the existing `public.class_homework`**. It does not replace website homework actions, change `save_class_homework`, add a homework sync service, or relax RLS. Only explicitly authorized numeric Telegram users, in private chats with the bot, can publish for any existing school class.

## 1. Owner deployment order

1. Review the feature branch and tests. Do not enable the webhook on an old deployment.
2. Apply **`supabase/migrations/20261004105537_telegram_homework_publishing.sql`**, after all existing migrations. Use your normal reviewed migration workflow or the Supabase SQL editor. This implementation did **not** apply it to production.
3. Choose an existing `profiles.id` as the author. Prefer a dedicated, clearly named school publishing account rather than an unsuspecting student's profile. It needs no new browser/admin privileges; this UUID supplies attribution only.
4. Configure the server-only variables below in Vercel Production (and only in test deployments if intentionally testing). Deploy the reviewed feature code yourself.
5. Inspect the bot's existing webhook with `getWebhookInfo` before changing it. Telegram allows one webhook per bot: do not unknowingly replace another application's incoming bot integration. Existing NIS Hub support notifications use the same bot's **outgoing** messages and remain unchanged.
6. Register this webhook, then perform the real checks below. No migration application, deployment, or webhook registration was performed automatically.

## 2. Required environment variables

| Variable | Meaning |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Existing bot token from official `@BotFather`. Reused by support; never public. |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32–256 character secret, only `A-Z`, `a-z`, `0-9`, `_`, `-`. |
| `TELEGRAM_ADMIN_IDS` | Comma-separated **numeric user IDs**, e.g. `123456789,234567890` (illustrative, not real administrators). Not usernames/chat/group IDs. |
| `TELEGRAM_HOMEWORK_AUTHOR_ID` | UUID of an existing `public.profiles` row; not a Telegram ID. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase legacy `service_role` key, or a current `sb_secret_…` key in this same variable. Never an anon/publishable key. |

The existing `NEXT_PUBLIC_SUPABASE_URL` must point to the same project as the privileged key. **No `TELEGRAM_HOMEWORK_CLASS_ID` is used.** Classes and schedule subjects are loaded dynamically. `TELEGRAM_ADMIN_CHAT_ID` remains support-notification configuration, not homework authorization.

Never add `NEXT_PUBLIC_` to these five variables. Never commit `.env.local`, bot tokens, webhook secrets or service keys. Never paste them into chat, screenshots or diagnostic logs. Missing/invalid configuration makes the webhook return HTTP 503 with only a fixed non-secret diagnostic.

### Finding the Telegram numeric ID

Use the official Bot API before registering a webhook: send `/start` privately to your bot, then inspect `message.from.id` in `getUpdates` locally. Do not share the raw response, which contains personal data.

```sh
# Only when this bot has NO active webhook; getUpdates conflicts with active webhooks.
curl --fail --silent --show-error \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

If the bot already has a webhook, obtain the ID through its existing trusted administrative tooling or arrange a maintenance window; do not disable another integration blindly. Usernames, display names and membership in a Telegram group do not confer authorization.

### Finding the author profile

In the Supabase Dashboard's Table Editor, inspect `public.profiles`, identify the intended publishing account, and copy its **id UUID** into `TELEGRAM_HOMEWORK_AUTHOR_ID`. Owner-only SQL can also verify a known UUID:

```sql
select id, display_name from public.profiles where id = '<chosen-profile-uuid>'::uuid;
```

There is no automatic profile creation or role promotion. Publication rechecks that the author exists. All Telegram homework is attributed to that configured profile, not to individual Telegram admins; individual admin IDs remain in the restricted retry ledger.

### Finding the privileged Supabase key

Supabase Dashboard → Project Settings → API Keys: use a server **secret** key (preferred), or the legacy API keys tab's **service_role**, not an anon or publishable key. Configure it only in deployment secrets. It bypasses RLS and must be protected accordingly. The homework client disables persisted sessions/refresh/browser URL detection and does not read browser cookies. The installed Supabase SDK handles current secret keys in the `apikey` header, not as user JWTs. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

### Generating the webhook secret

```sh
openssl rand -hex 32
```

Store the output privately in Vercel and in your temporary local shell environment for webhook registration. Do not commit it. Header comparison uses a timing-safe digest comparison; Telegram must send `X-Telegram-Bot-Api-Secret-Token` on every request.

## 3. Webhook registration and status

Exact production URL:

```text
https://nis-hub-ura.vercel.app/api/telegram/webhook
```

After configuring the variables and deploying, run these commands in a trusted local shell with the real token/secret already loaded securely as environment variables. Disable shell tracing (`set +x`); avoid recording the terminal. Examples contain variable references only, not credentials. The token is necessarily part of official Bot API request URLs: do not copy URLs from diagnostics or expose command arguments to untrusted users.

```sh
curl --fail --silent --show-error --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://nis-hub-ura.vercel.app/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query"]' \
  --data-urlencode 'max_connections=1'
```

`max_connections=1` reduces out-of-order delivery; correctness still uses transaction-level per-admin locking and persistent idempotency, not function memory. We intentionally do **not** set `drop_pending_updates=true`.

```sh
curl --fail --silent --show-error \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Verify `result.url`, `pending_update_count`, and any `last_error_message`. If Vercel protects the deployment with a login wall, Telegram cannot use it: register the accessible Production URL, not a protected Preview. Do not add an undocumented auth bypass. See official [setWebhook](https://core.telegram.org/bots/api#setwebhook) and [getWebhookInfo](https://core.telegram.org/bots/api#getwebhookinfo).

## 4. Real end-to-end checks

1. An allowlisted admin sends `/start` in a **private bot chat**: see `📚 Добавить ДЗ`.
2. Send `/addhomework` or press that keyboard button.
3. Choose 7–12 → an actual class. Only classes in that grade should appear, ordered by grade/section/name.
4. Confirm only subjects present in **that class's `weekly_schedule`** appear, without repeated subjects from multiple lessons/subgroups; Russian name falls back to `name`.
5. Choose Сегодня/Завтра/Послезавтра. Dates use **Asia/Oral**, including after UTC midnight. These are calendar-day choices; this flow does not skip weekends or non-school days.
6. Empty/whitespace and over-1000-character bodies must be rejected. Valid trimmed text produces a confirmation with class, subject, date and body, but **no homework row yet**.
7. `✏️ Изменить` returns to text entry while retaining class/subject/date; confirm again.
8. `✅ Опубликовать` creates one `class_homework` row with the selected class/subject, configured author and existing `visible`/timestamp defaults. It deletes the draft session.
9. Double-tap publish or retry the same update: no second row. Old buttons from edited/reset drafts must not publish.
10. Sign into NIS Hub as a student of that class, open Schedule for the due date and reload/reselect the date if needed. The **existing** homework query displays the row; students of another class must not see it. Existing UI is not realtime/subscribed, so a panel already open before publication does not automatically push-refresh.
11. Test `/cancel` and inline `❌ Отмена`; test a 30-minute expired session.
12. A non-allowlisted user must get `⛔ У вас нет доступа.` even when attempting callbacks/body/publish from another draft. Group chats are rejected even for allowlisted admins.
13. Verify existing website homework create/edit/delete, existing auth providers, and support Telegram notifications still work. Bot publishing does not use/change the website's per-student RPC or its 20/day limit.

## 5. Storage, retry and security semantics

- `telegram_homework_sessions`: one private draft per admin; validated step, grade, foreign keys, body and random 12-hex-character button token. A new token on each accepted transition invalidates old buttons. Drafts expire after 30 idle minutes. Expiry blocks use immediately; expired rows are removed on that admin's next request, not by an automatic scheduler.
- `telegram_homework_updates`: update ID primary key plus user ID, outcome, optional published homework ID and timestamp. No raw messages, names, credentials or bodies. Keep the ledger for replay protection; arbitrarily deleting it weakens retry history.
- Both new tables have RLS, no browser policies, and revoked `PUBLIC`/`anon`/`authenticated` privileges. Only service-role code can use them. The new `telegram_homework_apply_update` function is **SECURITY INVOKER**, with pinned search path and browser EXECUTE revoked.
- Grants to `service_role` are explicit, so the integration does not rely on Supabase's changing defaults for newly exposed tables. Existing-table privileges were checked read-only in the owner's project. Never fix a missing grant by enabling anonymous/browser access. See [Supabase's explicit-grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- Update claim, draft change, homework insert and draft reset commit atomically; failed transactions can retry. Different publish clicks also serialize and require a still-valid confirmation token/session. Duplicate notification messages are possible after a delivery timeout, but publication remains idempotent.
- Before publish: live class/grade, subject, schedule relationship, configured author, date bound, body and confirmation state are revalidated. Request-level admin authorization happens on **every** message/callback. The SQL function trusts only its restricted server caller, not provider metadata or a normal browser JWT.
- Request body ≤32 KiB; body ≤1000 JS characters after trim, matching website validation; callbacks ≤64 UTF-8 bytes. Database calls have 10-second timeouts within a 45-second request budget; Bot API has 5-second send / 2-second callback-answer limits. No raw exceptions/payloads are logged; only fixed diagnostic fields. Text is sent without Telegram HTML/Markdown parsing.
- Messages/drafts are visible to Telegram under its service policies. Use this for school homework only, not sensitive student data. No new tracking, Google/Apple token handling, or browser service key exposure was added.
- Optional owner-run cleanup of **expired drafts only**, after reviewing retention needs:

```sql
delete from public.telegram_homework_sessions where expires_at <= now();
```

No scheduled cleanup or unrelated index/schema modification is required. The expiry index supports this bounded maintenance query.

## 6. Disable and rollback safely

1. Stop incoming delivery without discarding pending updates:

```sh
curl --fail --silent --show-error --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" \
  --data-urlencode 'drop_pending_updates=false'
```

2. Remove the homework-specific configuration and redeploy the previous reviewed application commit if needed. **Keep `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID` if support still uses them.** Removing homework configuration fails closed if old delivery continues.
3. Leave additive DB objects dormant; existing `class_homework` records and website functions remain intact. Do not delete published homework or reset the database. Full removal of the two new tables/function requires a separately reviewed rollback migration and backup, not an automatic destructive command.
4. Rotate privileged keys/webhook secrets if compromised; update the webhook secret and redeploy consistently. Removing an admin ID plus redeploy immediately prevents further privileged requests by that account; any old draft is unusable to that removed user.

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| HTTP 503 / fixed `configuration: missing_or_invalid` | All required variables, secret length/charset, numeric IDs, valid author UUID, same-project URL and a privileged rather than public key. |
| HTTP 401 | `setWebhook.secret_token` matches the deployment's `TELEGRAM_WEBHOOK_SECRET`. |
| No classes/subjects | Existing grade values in `classes`; lessons in `weekly_schedule` for the chosen class. No hardcoded fallback catalog is used. |
| Stale-session message | Idle expiry, old button token, wrong step, removed class/subject/schedule membership, or author profile no longer exists. Start again with `/addhomework`. |
| Generic DB failure / retry | Migration applied; service role has normal Supabase privileges on existing tables; correct URL/key project pair; upstream/network timeouts. Inspect fixed diagnostics, never dump a raw update/session. |
| Homework not visible yet | Actual class membership, due date, visible/non-deleted record and refresh of the existing website panel. Telegram does not change a student's profile class. |
| Callback spinner / delivery error | Bot token and Telegram API connectivity; callback answers are attempted before any database IO. `getWebhookInfo` exposes Telegram's delivery error. |
| Pending updates grow | Deployment protection, incorrect webhook URL/configuration, unavailable DB or Bot API. Recover rather than dropping updates blindly. |

## 8. Validation record

Verified on 2026-10-04, based on current main `e426bbe2ed2d9f9193e49d16387630dd3dfa9750`, branch `codex/telegram-homework-publishing`:

| Check | Result |
| --- | --- |
| `node --import tsx --test tests/telegram-homework.test.ts` | 11 passed; real migration/state transitions in isolated PGlite plus mocked application integration boundaries. |
| `npm run typecheck` | Passed (rerun after build completed; running concurrently with Next's deletion of `.next/types` caused a generated-file race, not a source type error). |
| `npm run lint` | Passed; no warnings/errors. |
| `npm test` | 158 passed, 1 existing Reader test skipped when its local PDF variable is unset. |
| `NIS_READER_TEST_PDF=/path/to/nis-hub-reader-test.pdf npm test` | 167 passed, 0 failures/skips using the owner's existing safe local PDF; actual PDF.js page render/text/zoom/cancel tests included. |
| `npm run build` | Passed; new dynamic `/api/telegram/webhook` route present. No database credentials needed at build time. |
| Built-server HTTP checks | Wrong/missing secret 401 with valid fixture config; malformed body 400; unsupported update 200; GET 405; missing config 503; no cookies; `no-store`. No real external requests/mutations. |
| Diff / secret / merge-marker review | Only scoped integration files, typed DB declarations, example variables, exact proxy exception and test fixture role changed. Existing website homework actions/component, auth, support transport, SMS, Reader and RLS files untouched. No real secrets or `.env.local` included. |

The 28 requested acceptance cases are covered within the focused tests: secret/admin gating; start/add; grade/class filters and invalid grade; class persistence; distinct scheduled-subject filtering, relationship rejection and subject persistence; all three dates; empty/oversized/valid body; confirmation; edit/cancel; exactly-one publication and chosen class/subject/author; retry deduplication; configuration; malformed callbacks; and removed/non-admin continuation denial. Extra tests cover old button tokens, session expiry, live membership/author revalidation, transaction rollback/retry, query pagination, fixed diagnostics, plain-text Bot API output, and the exact proxy bypass boundary.

Limitations: PGlite models SQL/RLS, not the Supabase gateway or separate concurrent PostgreSQL connections. Bot API calls in tests are fixtures. No real Telegram conversation, production migration, deployment, webhook registration, or live website account was used; the owner must perform Section 4 after deployment. No new dependency was added.
