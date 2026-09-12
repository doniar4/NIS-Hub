# Supabase setup and Phase 3 migration checklist

The application is connected to real Supabase Auth, database and private Storage when configured. Missing configuration fails safely; it is not an offline profile prototype.

## Fresh project only

1. Review and apply `supabase/schema.sql` once.
2. Apply `supabase/migrations/202609100001_phase2.sql` once.
3. Apply the Phase 3 migrations below in filename order.
4. Configure email/password Auth, confirmation and redirect URLs. Set the project URL and publishable/anon key in `.env.local` from `.env.example`.
5. Promote the intended administrator through the owner's controlled Supabase Dashboard. Public registration cannot choose an admin role.
6. Test two separate student accounts plus one administrator. Use only authorised materials.

**Existing connected project:** do not replay the initial schema or Phase 2 migration. Phase 2 intentionally moves historical books back to drafts during its first application; it is not a routine update script. Review migration history and take a backup first.

## Phase 3 migrations

### `202609110001_phase3_avatar.sql`

The owner confirmed this migration was already applied on 12 September 2026. Do not reapply it.

- Retains a private `avatars` bucket. Allows only WebP objects ≤262144 bytes.
- Replaces old folder-wide avatar policies with exact owner-only `<uid>/avatar.webp` SELECT/INSERT/UPDATE.
- Replacement UPDATE requires the object's existing `updated_at` to be at least 60 seconds old. No avatar DELETE policy is provided.
- Enforces canonical `profiles.avatar_path`; the object must exist before setting the path.
- Does not change book-file RLS, book metadata, access approval or authentication.

For an unapplied installation, a legacy-avatar preflight aborts rather than silently deleting or orphaning images. Review noncanonical paths with the owner. Any necessary moves/removals must use the supported Storage API after preserving files and resolving profile references; never edit/delete `storage.objects` rows directly. Then apply the migration. The app intentionally has no avatar-removal UI.

### `202609120001_phase3_schedule_import.sql`

New in this continuation; **not applied to the owner's cloud database by this agent**.

Adds only `public.import_schedule(jsonb)`, an admin-checked SECURITY INVOKER function with a fixed search path and explicit execute grants. Existing table RLS and foreign keys remain authoritative. Inputs are bounded and revalidated in PostgreSQL. Atomic upsert matches class/date/lesson number; duplicate slots and invalid references fail without partial writes. Omitted lessons are retained. Review and apply once before using the new admin JSON import.

There is no source scraper, new external key, scheduled job or automatic cloud migration.

## Avatar behavior and verification

The server authenticates the caller, accepts JPEG/PNG/WebP ≤2 MiB and 16 million pixels, rejects animation/corruption/spoofed MIME, normalizes to 256×256 WebP and strips metadata. Storage overwrites the same canonical object with `upsert:true`; only a successful upload is followed by a profile-path update.

The action reads only the caller's exact avatar timestamp for a clearer localized cooldown message. This check is UX guidance; Storage RLS remains authoritative. Its 60-second sequential guard is **not a strict concurrent distributed rate limiter**: Storage upload preflight and completion are separate. Canonical naming and bucket size/MIME constraints bound stored-object growth. A direct Storage client still relies on provider MIME metadata; server decoding is the app upload pipeline's byte-validation boundary.

If upload succeeds but the profile update fails, the app reports partial success and does not delete the canonical object. Network ambiguity cannot guarantee whether a remote operation committed; refresh before retrying.

The profile issues a fresh owner-authorized signed avatar URL, valid for 60 seconds, on server rendering/reload. The 96px image loads eagerly. Expiry does not remove already-decoded pixels; a later failed image request offers explicit Retry, which retries the image and refreshes the authenticated profile for a newly signed URL. There is no polling, public bucket or token logging. URL expiry is checked by Storage at request time; it does not revoke an already obtained copy.

Owner-confirmed manual result on 12 September 2026: first upload succeeds; immediate replacement shows waiting; replacement after 60 seconds succeeds; after waiting over a minute and reloading, the avatar is visible. Automated SQL tests independently cover canonical paths, other-user/anonymous denial, immediate UPSERT rejection, successful replacement after aged fixture time and a single remaining object.

## Release checks

- Keep `book-files` private; publish only approved books with rights evidence.
- Confirm fresh signed PDF access, Reader navigation/zoom/text, bookmarks and persisted progress.
- Check avatar behavior using a real account; do not paste signed URLs or session tokens into reports.
- Apply the new schedule RPC migration before attempting an authorised import. No live timetable is imported by this task.
- Verify admin import denial for students; review class/subject mapping and dates before confirming a file.
- Account deletion is operator-managed: deleting Auth user cascades profile/reading records, but avatar cleanup is a separate Storage API operation. No automatic retention job or self-service account deletion is claimed.
- Fill legal operator/contact, actual hosting/region, retention and minors-related release requirements. Do not infer the hosting provider from ignored local deployment folders.
