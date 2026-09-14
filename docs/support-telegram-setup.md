# Support notifications — Telegram (v0.5)

## Configuration
1. Create a bot with Telegram's official BotFather and a restricted administrator chat. Add the bot and grant only the ability to send messages. Do not use a public student group.
2. Obtain the destination chat ID through authorized Telegram tooling. Do not paste tokens, chat IDs, update payloads or student information in commits, screenshots or support tickets.
3. Set server-only deployment secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, and the canonical HTTPS origin `APP_BASE_URL`. No `NEXT_PUBLIC_` prefix. Local development may use a localhost HTTP origin.
4. Apply the v0.5 support migration and deploy the app. Use an existing admin account for moderation; no moderator role is introduced.
5. In a real signed-in student session submit a harmless test ticket. Confirm it appears under Support even if Telegram is unavailable. In the configured admin chat confirm one notification and that its link requires login/admin or owner authorization. Reply/change status in NIS Hub, then verify the author can see it and a different student cannot.
6. Check a harmless >400-character ticket: localized category, title, preview ending in … (without its tail), profile name, Asia/Oral timestamp and admin controls at the link. Test <, >, &, quotes and emoji without injecting Telegram markup. Confirm the short-message and missing-name cases too.
7. Test missing/invalid Telegram configuration: the ticket must still save. Server logs contain only `[support-notification] disabled|failed`, not request URLs, secrets or response bodies. Restore valid configuration afterwards.

## Data and failure behavior
Supabase is the canonical record. The server awaits one notification attempt **after** the ticket RPC commits, with a five-second timeout; redirects are refused and link previews disabled. Messages use the Russian admin heading “NIS Hub · Новый тикет”, a human-readable Russian category, ticket title, bounded message preview, safe profile display name when available, readable Asia/Oral time and the canonical ticket link. The admin audience is Russian regardless of the student's UI locale.

The preview is normalized/redacted text, capped at **400 Unicode code points including the final …** when truncated. Truncation precedes HTML escaping and never splits a surrogate pair. Short messages can fit entirely in the preview; there is no full-long-body mode, separate body field, reply forwarding or attachment forwarding. Titles are bounded to 120 characters; names to 60. Name enrichment reads only display_name from the authenticated user's profile after persistence, with a 1.5-second timeout; missing/failed lookups omit the name rather than failing ticket creation or substituting an email/auth metadata value.

Telegram uses HTML parse mode. All dynamic text/URL values are escaped; user markup cannot create tags or links. Control/bidi characters are removed and whitespace is collapsed. Obvious URLs, emails and credential patterns in free text are replaced before truncation. This is best-effort minimization, **not** a guarantee of personal-data removal: admins still receive user-entered title/preview/name, so keep the destination restricted and never submit unnecessary sensitive information. Account email, auth metadata and application secrets are not part of the payload.

There is no separate `/admin/tickets/[id]` route in this app. The `/admin/tickets` page is only the admin list. Notifications link to `/support/<id>`, the existing shared detail route that renders admin reply/status controls for an authenticated admin and enforces owner/admin access. No nonexistent admin URL or authorization bypass is introduced.

No Telegram webhook, incoming bot commands, attachments, automatic retry queue or guaranteed delivery are implemented. An interrupted app request can therefore leave a saved ticket without a notification; admins must check the dashboard. Notification retries are deliberately not coupled to ticket creation. Telegram is not the support database.

Database limits: one new ticket/minute and twenty/day per account; one reply/five seconds and sixty/hour per account. Concurrent requests are serialized per author. Admin status changes are audited. Users can reply only to open/in-progress tickets.

Review chat membership and retention with the operator. Deleting a ticket/account in Supabase does not delete a previously sent Telegram message or third-party logs/backups. Revoke/rotate a leaked bot token through BotFather and deployment secrets.

## Official sources checked 2026-09-14
- [Telegram Bot API: sendMessage](https://core.telegram.org/bots/api#sendmessage): HTTPS Bot API, destination/text parameters, HTML formatting/escaping, link preview options and response status.
- [Telegram's bot tutorial](https://core.telegram.org/bots/tutorial): BotFather creation and protecting the bot token.
