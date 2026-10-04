# Telegram homework publishing

This is a public Telegram entry point into **the existing `public.class_homework`**. It does not replace website homework actions, change `save_class_homework`, add a homework sync service, or relax RLS. **Anyone who opens the bot in a private chat can publish homework for any existing school class, without a NIS Hub account.** Group chats are rejected. Publications are limited to 10 successful items per Telegram user in a rolling 24-hour window.

Warning: access to the bot is sufficient to publish immediately visible homework. It does not verify school membership, class membership, or who wrote the assignment. Per-user rate limiting reduces spam but is not identity verification and does not prevent abuse through multiple Telegram accounts. Existing website moderation remains unchanged; the owner should review published content.

## 1. Owner deployment order

1. Review the feature branch and tests. Do not enable the webhook on an old deployment.
2. Apply migrations in order after existing project migrations:

   - `supabase/migrations/20261004105537_telegram_homework_publishing.sql` — original private state/retry ledger; skip if already applied.
   - **`supabase/migrations/20261004115044_telegram_homework_public_rate_limit.sql`** — public-use quota outcome, published-per-user index and replacement of the existing Telegram RPC.

   Use your normal reviewed migration workflow or the Supabase SQL editor. Neither migration was applied to production by this implementation. Apply the quota migration **before** deploying public access. It changes no website homework table, RLS policy or website RPC and creates no new table.
3. Choose an existing `profiles.id` as the author. Prefer a dedicated, clearly named school publishing account rather than an unsuspecting student's profile. It needs no new browser/admin privileges; this UUID supplies attribution only.
4. Configure the server-only variables below in Vercel Production (and only in test deployments if intentionally testing). Deploy the reviewed feature code yourself.
5. Inspect the bot's existing webhook with `getWebhookInfo` before changing it. Telegram allows one webhook per bot: do not unknowingly replace another application's incoming bot integration. Existing NIS Hub support notifications use the same bot's **outgoing** messages and remain unchanged.
6. Register this webhook, then perform the real checks below. No migration application, deployment, or webhook registration was performed automatically.

## 2. Required environment variables

| Variable | Meaning |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Existing bot token from official `@BotFather`. Reused by support; never public. |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32–256 character secret, only `A-Z`, `a-z`, `0-9`, `_`, `-`. |
| `TELEGRAM_HOMEWORK_AUTHOR_ID` | UUID of an existing `public.profiles` row; not a Telegram ID. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase legacy `service_role` key, or a current `sb_secret_…` key in this same variable. Never an anon/publishable key. |

The existing `NEXT_PUBLIC_SUPABASE_URL` must point to the same project as the privileged key. **No `TELEGRAM_HOMEWORK_CLASS_ID` is used.** Classes and schedule subjects are loaded dynamically. `TELEGRAM_ADMIN_CHAT_ID` remains support-notification configuration, not homework authorization.

Never add `NEXT_PUBLIC_` to these four variables. Never commit `.env.local`, bot tokens, webhook secrets or service keys. Never paste them into chat, screenshots or diagnostic logs. Missing/invalid configuration makes the webhook return HTTP 503 with only a fixed non-secret diagnostic.

### Public access and sender identity

No allowlist or Telegram user ID setup is needed. The secret-verified Telegram update supplies a validated numeric `from.id`; private chat ID must equal that sender ID. Sessions and publication quotas are isolated by that ID, not a username or display name. The webhook secret authenticates delivery from the bot integration; it does not restrict which people can use the bot.

### Finding the author profile

In the Supabase Dashboard's Table Editor, inspect `public.profiles`, identify the intended publishing account, and copy its **id UUID** into `TELEGRAM_HOMEWORK_AUTHOR_ID`. Owner-only SQL can also verify a known UUID:

```sql
select id, display_name from public.profiles where id = '<chosen-profile-uuid>'::uuid;
```

There is no automatic profile creation or role promotion, and bot users do not need website accounts. Publication rechecks that the technical author exists. All Telegram homework is attributed to that configured profile, not to individual Telegram users; sender IDs remain in the restricted retry/quota ledger.

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

`max_connections=1` reduces out-of-order delivery; correctness still uses transaction-level per-user locking and persistent idempotency, not function memory. We intentionally do **not** set `drop_pending_updates=true`.

```sh
curl --fail --silent --show-error \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Verify `result.url`, `pending_update_count`, and any `last_error_message`. If Vercel protects the deployment with a login wall, Telegram cannot use it: register the accessible Production URL, not a protected Preview. Do not add an undocumented auth bypass. See official [setWebhook](https://core.telegram.org/bots/api#setwebhook) and [getWebhookInfo](https://core.telegram.org/bots/api#getwebhookinfo).

## 4. Real end-to-end checks

1. Any Telegram user sends `/start` in a **private bot chat**: see `📚 Добавить ДЗ`. Repeat with a second user who has no NIS Hub account; there is no approval/allowlist step.
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
12. A second user's flow must not change the first user's draft; buttons carrying the first user's token must not apply to the second user's session. Group/supergroup requests must return `Используйте бота в личном чате.` and make no DB mutation.
13. Using safe test content/classes, verify the first 10 successful publications within 24 hours work, the 11th returns `⏳ Слишком много добавлений за сегодня. Попробуйте позже.`, and another Telegram user has their own quota. Cancels, invalid attempts and webhook retries must not consume slots. Do not flood a real class just to test this; use the automated isolated SQL quota tests or an explicitly designated test class.
14. Verify existing website homework create/edit/delete, existing auth providers, and support Telegram notifications still work. Bot publishing does not use/change the website's per-student RPC or its 20/day limit.

## 5. Storage, retry and security semantics

- `telegram_homework_sessions`: one private draft per Telegram user; validated step, grade, foreign keys, body and random 12-hex-character button token. A new token on each accepted transition invalidates old buttons. Drafts expire after 30 idle minutes. Expiry blocks use immediately; expired rows are removed on that user's next request, not by an automatic scheduler.
- `telegram_homework_updates`: update ID primary key plus user ID, outcome, optional published homework ID and timestamp. No raw messages, names, credentials or bodies. Keep the ledger for replay protection; arbitrarily deleting it weakens retry history.
- Both new tables have RLS, no browser policies, and revoked `PUBLIC`/`anon`/`authenticated` privileges. Only service-role code can use them. The new `telegram_homework_apply_update` function is **SECURITY INVOKER**, with pinned search path and browser EXECUTE revoked.
- Grants to `service_role` are explicit, so the integration does not rely on Supabase's changing defaults for newly exposed tables. Existing-table privileges were checked read-only in the owner's project. Never fix a missing grant by enabling anonymous/browser access. See [Supabase's explicit-grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- Update claim, draft change, homework insert and draft reset commit atomically; failed transactions can retry. Different publish clicks also serialize and require a still-valid confirmation token/session. Duplicate notification messages are possible after a delivery timeout, but publication remains idempotent.
- Before publish: live class/grade, subject, schedule relationship, configured author, date bound, body and confirmation state are revalidated. Private sender context is checked on **every** message/callback. The SQL function trusts only its restricted server caller, not a public HTTP request or a normal browser JWT. Webhook secret verification is unchanged.
- Quota: **10 successfully published homework items per `telegram_user_id` in rolling 24 hours**, enforced inside the existing RPC under the same transaction lock as insertion. It counts only ledger outcomes `published`, not cancelled/invalid/body-invalid/rate-limited attempts. Retries return the recorded outcome without another insert or quota slot. Deleting/hiding homework does not refund a publication. The technical author UUID is shared attribution, not the quota key.
- A blocked publish returns `rate_limited` and the dedicated message; it does not delete or publish the confirmation draft. A later **new** button click can succeed when a slot ages out. Retrying the same blocked update ID still returns its recorded result. If the draft has expired, restart `/addhomework`. Do not purge the update ledger: it protects both retries and quotas.
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
4. Rotate privileged keys/webhook secrets if compromised; update the webhook secret and redeploy consistently. There is no per-person access list in this version. To stop public publishing, disable the webhook/integration rather than assuming a Telegram username or NIS Hub role will block use.

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| HTTP 503 / fixed `configuration: missing_or_invalid` | All four required variables, secret length/charset, valid author UUID, same-project URL and a privileged rather than public key. |
| HTTP 401 | `setWebhook.secret_token` matches the deployment's `TELEGRAM_WEBHOOK_SECRET`. |
| No classes/subjects | Existing grade values in `classes`; lessons in `weekly_schedule` for the chosen class. No hardcoded fallback catalog is used. |
| Stale-session message | Idle expiry, old button token, wrong step, removed class/subject/schedule membership, or author profile no longer exists. Start again with `/addhomework`. |
| Generic DB failure / retry | Migration applied; service role has normal Supabase privileges on existing tables; correct URL/key project pair; upstream/network timeouts. Inspect fixed diagnostics, never dump a raw update/session. |
| Homework not visible yet | Actual class membership, due date, visible/non-deleted record and refresh of the existing website panel. Telegram does not change a student's profile class. |
| Callback spinner / delivery error | Bot token and Telegram API connectivity; callback answers are attempted before any database IO. `getWebhookInfo` exposes Telegram's delivery error. |
| Pending updates grow | Deployment protection, incorrect webhook URL/configuration, unavailable DB or Bot API. Recover rather than dropping updates blindly. |
| Public user cannot start | Private chat, valid numeric sender and matching chat ID; no website account or allowlist is required. |
| Publication quota reached | Last 24 hours of successful publications for that Telegram sender; wait for a slot and click again/start a fresh flow after expiry. |

## 8. Validation record

Public-use revision verified on 2026-10-04, continuing commit `9195661` on `codex/telegram-homework-publishing`. The original migration remains unchanged; the new forward migration replaces the existing Telegram function and its stored comment. It does not change the website homework RPC or any RLS policy.

| Check | Result |
| --- | --- |
| `node --import tsx --test tests/telegram-homework.test.ts` | 12 passed; both migrations/state transitions/quota in isolated PGlite plus mocked application integration boundaries. |
| `npm run typecheck` | Passed; run separately from build to avoid generated-type file races. |
| `npm run lint` | Passed; no warnings/errors. |
| `NIS_READER_TEST_PDF=/path/to/nis-hub-reader-test.pdf npm test` | 168 passed, 0 failures/skips using the owner's existing safe local PDF; actual PDF.js page render/text/zoom/cancel tests included. Without the PDF variable the existing fixture-dependent test skips itself. |
| `npm run build` | Passed; new dynamic `/api/telegram/webhook` route present. No database credentials needed at build time. |
| Webhook boundary tests | Invalid secret 401; malformed payload 400; missing config 503; arbitrary private users accepted; groups/callbacks rejected without database IO. No real external requests/mutations. The secret verification itself is unchanged. |
| Diff / secret / merge-marker review | Only `.env.example`, Telegram config/handler/webhook call signature, tests, setup docs and the forward quota migration changed. Existing website homework actions/component, auth, support transport, SMS, Reader, proxy and RLS files untouched. No real secrets or `.env.local` included. |

Focused tests retain secret gating, start/add, grade/class filters and invalid grade, class persistence, distinct scheduled-subject filtering, relationship rejection and subject persistence, all three dates, empty/oversized/valid body, confirmation, edit/cancel, exactly-one publication and chosen class/subject/author, retry deduplication, configuration and malformed callbacks. Public-use tests exercise multiple arbitrary users without website identities, private-chat-only handling, per-user session isolation, database quota enforcement, rolling-window expiry and non-consuming retries/cancels/invalid attempts. Extra tests cover old button tokens, session expiry, live membership/author revalidation, transaction rollback/retry, query pagination, fixed diagnostics, plain-text Bot API output, and the exact proxy bypass boundary.

Limitations: PGlite models SQL/RLS, not the Supabase gateway or separate concurrent PostgreSQL connections. Bot API calls in tests are fixtures. No real Telegram conversation, production migration, deployment, webhook registration, or live website account was used; the owner must perform Section 4 after deployment. No new dependency was added.
