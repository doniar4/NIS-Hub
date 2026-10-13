# Canonical auth and public SEO setup

The application origin is `https://nis-hub-ura.vercel.app`. Production and Preview builds should set `NEXT_PUBLIC_SITE_URL=https://nis-hub-ura.vercel.app`; do not use a deployment-specific `VERCEL_URL`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in an ignored local `.env.local` when exercising local email confirmation or OAuth. A missing production value falls back to the same stable production origin; a malformed origin fails validation. `APP_BASE_URL` is no longer used for Telegram links.

## Supabase Dashboard

1. In Authentication → URL Configuration, set **Site URL** to `https://nis-hub-ura.vercel.app`. Allow the exact redirect `https://nis-hub-ura.vercel.app/auth/callback`. Add `http://localhost:3000/auth/callback` only for authorized local testing. Avoid wildcard preview URLs for production auth.
2. Keep **email confirmations enabled** for password accounts. The app now passes the canonical `/auth/callback` as `emailRedirectTo`. Review any customized confirmation template: it must honor the configured redirect (for example via Supabase's confirmation URL), not hardcode a preview domain. The older `/auth/confirm` token-hash handler remains for any existing custom template that uses it.
3. Enable the Google provider only after completing the Google Cloud setup below. Supabase owns the provider Client Secret. Do not put it in Vercel or any `NEXT_PUBLIC_*` variable.
4. Check that automatic identity linking is enabled for compatible verified-email identities. Supabase, not NIS Hub, decides whether an OAuth identity joins an existing Auth user. The app's existing `auth.users` trigger creates one student profile per user ID with `ON CONFLICT DO NOTHING`; it does not read Google metadata for roles or overwrite profile settings.

## Google Cloud Console

1. Configure the OAuth consent screen/audience and the minimal `openid`, email and profile scopes. Publish/verify the consent screen as required for the intended audience.
2. Create a **Web application** OAuth client. Add `https://nis-hub-ura.vercel.app` as an authorized JavaScript origin. Add a local origin only if needed for testing.
3. Set the **Authorized redirect URI** to the *Supabase Google provider callback URL shown in your Supabase Dashboard*, normally `https://<project-ref>.supabase.co/auth/v1/callback`. This is **not** the NIS Hub `/auth/callback` URL.
4. Enter the Client ID and Client Secret in Supabase Authentication → Providers → Google, then test with a dedicated account. Never send or commit the secret.

## Vercel environment

- `NEXT_PUBLIC_SITE_URL=https://nis-hub-ura.vercel.app` (public; Production and Preview).
- Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must point to the same intended Supabase project.
- `GOOGLE_AUTH_ENABLED=true` (server-only) **after** the provider is ready. Until then the Google button is absent; email/password remains available.
- No Google Client Secret is required by NIS Hub. `AZURE_AUTH_ENABLED` is reserved for a future configured Azure provider and should remain unset.

Redeploy after environment changes. Test password signup → confirmation → `/auth/callback` → Profile, existing password login, new Google user, verified same-email password+Google user, returning Google user, expired callback, reload and logout. Confirm the same-email user's existing profile, class, Top 4, role and saved data remain unchanged. A new Google account with missing provider metadata should still be able to set its own profile.

Only `/`, `/privacy` and `/terms` are listed in the sitemap. Signed-in Home and other private routes inherit `noindex`; robots directives are a crawl hint, not access control. RLS and session checks remain the security boundary. Check the built `/robots.txt`, `/sitemap.xml`, anonymous landing canonical/OG metadata and authenticated Home `noindex` in the deployed Preview before releasing.
