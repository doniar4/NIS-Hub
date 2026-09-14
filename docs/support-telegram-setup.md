# Support notifications — Telegram (v0.5)

## Configuration
1. Create a bot with Telegram's official BotFather and a restricted administrator chat. Add the bot and grant only the ability to send messages. Do not use a public student group.
2. Obtain the destination chat ID through authorized Telegram tooling. Do not paste tokens, chat IDs, update payloads or student information in commits, screenshots or support tickets.
3. Set server-only deployment secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, and the canonical HTTPS origin `APP_BASE_URL`. No `NEXT_PUBLIC_` prefix. Local development may use a localhost HTTP origin.
4. Apply the v0.5 support migration and deploy the app. Use an existing admin account for moderation; no moderator role is introduced.
5. In a real signed-in student session submit a harmless test ticket. Confirm it appears under Support even if Telegram is unavailable. In the configured admin chat confirm one notification and that its link requires login/admin or owner authorization. Reply/change status in NIS Hub, then verify the author can see it and a different student cannot.
6. Test missing/invalid Telegram configuration: the ticket must still save. Server logs contain only `[support-notification] disabled|failed`, not request URLs, secrets or response bodies. Restore valid configuration afterwards.

## Data and failure behavior
Supabase is the canonical record. The server awaits one notification attempt **after** the ticket RPC commits, with a five-second timeout; redirects are refused and link previews disabled. It sends only the ticket UUID, category, timestamp and a canonical application link. Title, description, replies, name, email, attachments, signed URLs and authentication tokens are NOT sent.

No Telegram webhook, incoming bot commands, attachments, automatic retry queue or guaranteed delivery are implemented. An interrupted app request can therefore leave a saved ticket without a notification; admins must check the dashboard. Notification retries are deliberately not coupled to ticket creation. Telegram is not the support database.

Database limits: one new ticket/minute and twenty/day per account; one reply/five seconds and sixty/hour per account. Concurrent requests are serialized per author. Admin status changes are audited. Users can reply only to open/in-progress tickets.

Review chat membership and retention with the operator. Deleting a ticket/account in Supabase does not delete a previously sent Telegram message or third-party logs/backups. Revoke/rotate a leaked bot token through BotFather and deployment secrets.

## Official sources checked 2026-09-14
- [Telegram Bot API: sendMessage](https://core.telegram.org/bots/api#sendmessage): HTTPS Bot API, destination/text parameters, link preview options and response status.
- [Telegram's bot tutorial](https://core.telegram.org/bots/tutorial): BotFather creation and protecting the bot token.
