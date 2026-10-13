# Supabase migration to Germany — 2026-10-06

Production now uses Frankfurt Supabase `msdvboxbszyogasptkwr` (NISHUB2.0)
and Vercel functions in `fra1`. Seoul source `kafahjtiyrfpruqvnryh`
(NIS Hub) was read only during migration; nothing was deleted there.

## Verified

- Application schema, Auth data, migration history, grants, RLS, indexes,
  functions and custom Auth/Storage triggers copied. 46 public tables.
- Initial 73-table comparison matched exactly. Final reconciliation includes
  41 users and 43 identities; all compared tables matched except temporary `auth.flow_state` at cutover.
  A later comparison sees new German sessions, messages, reading progress,
  AI usage and activity records as users use the live site; these must not
  be overwritten by the older Seoul snapshot. No source records were deleted. Final profile reconciliation
  preserves newer destination updates; missing subject selections/activity
  logs were inserted without overwriting destination records.
- All 24 Storage files, 164,079,775 bytes, match SHA-256 checksums.
  Three private buckets retain paths, MIME types, privacy and limits.
  Destination Storage object IDs/timestamps are new; original metadata is
  saved. Files copied before database extraction records were restored.
- Student RLS checks passed. REST reads of profiles/books/schedule return 200;
  anonymous profile reads and public PDF downloads are denied.
- Planner statistics refreshed on five destination tables.
- Production deployment `dpl_4C6LCSsDLPZimXz9cJTEHPZPfTSY` is READY,
  region fra1, using the previous stable production commit
  `0c6d292ef589fef2bbc229e718396b699f36fa82`.
- Active Vercel public Supabase URL/publishable/anon variables changed.
  Local .env.local URL/publishable key and vercel.json region updated.
  Unused integration-owned server/Postgres variables retain source values.
- https://nis-hub-ura.vercel.app/login returns 200, with fra1 response headers.
  Downloaded initial login scripts did not contain either project reference;
  this is not an end-to-end authentication verification.

## Google OAuth configured

The supplied real OAuth secret was applied and the destination provider enabled.
Supabase authorize returns 302 to Google; the Google page returns 200 without
redirect_uri_mismatch or invalid_client. The authorized German callback is:
https://msdvboxbszyogasptkwr.supabase.co/auth/v1/callback

Management API returns a redacted 64-character value which did not equal a
plain SHA-256 of the supplied secret; that comparison is not treated as proof
of an invalid credential. PATCH succeeded. A real interactive user login and
Google code exchange remain to be confirmed by the user; no account credentials
were requested or used by the agent. OAuth changes require no Vercel rebuild.

## Preservation and operational limits

Private backups and reports are in the Git-ignored .migration-backups/
nis-hub-migration-20261006 directory with restricted permissions. These
include password hashes/session data and must not be committed or published.
The full source dump and copied file bytes provide a recovery snapshot.

Source remains writable. Old open tabs or independent integrations can still
write to Seoul after the final comparison; those writes are not automatically
replicated. Refresh clients and inspect any other source consumers. Further
reconciliation must preserve newer German writes. A simple rollback can strand
new destination data and requires reconciliation first.

A temporary promotion of the old deployment was rejected by automatic approval
review because it would restore the previous database configuration rather
than advance the authorized German migration. It was not bypassed.

Existing performance/security advisor findings were recorded, including RLS
initplan/index opportunities. No speculative schema or query changes applied.

Final primary-key preservation audit: all source IDs are present in Germany
across 48 application/history/users/identities tables with primary keys.
Destination-only activity is preserved. No background migration remains running.
