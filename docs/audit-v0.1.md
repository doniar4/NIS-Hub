# v0.1 audit — 2026-09-10

Baseline: Next.js 16.3.4, React 19.2.8, TypeScript strict, npm. Lint, typecheck and Webpack production build pass before changes. GitHub main was fetched and used as the base for `codex/phase-2-backend` without overwriting local files. Existing local differences in README, lockfile, .env.example and .gitignore were retained for reconciliation.

## Critical

No demonstrated critical exploit in the offline prototype. Authentication, privileged mutations and book delivery do not yet exist; compilation is not evidence of their security.

## High

1. **Auth is a placeholder.** `src/components/local-demo.tsx` only changes `submitted` in AuthForm; profile/admin have no session guard. Impact: the foundation cannot be used for actual accounts. Fix: SSR cookie clients, verified identity at every data/mutation boundary, DB roles, signup/confirmation/login/logout. Verify: no-env requests fail closed, direct action tests, two users plus admin in Supabase before deployment.
2. **Profile provisioning missing.** `supabase/schema.sql` has neither an auth trigger nor a profile INSERT policy. Impact: new users cannot save a profile or Top 4. Fix: migration with trusted auth trigger, explicit `student` default, old-user backfill; do not trust user metadata roles. Verify: SQL inserts with hostile auth metadata remain student.
3. **No book delivery authorization implementation.** Private bucket exists but no approved-file read policy or signed URL endpoint. Impact: no working protected reader. Fix: authenticated endpoint plus storage RLS tied to approved/published book, private bucket, short expiry, no-store responses. Verify: anon/unpublished/restricted requests denied in SQL and HTTP tests; cloud signed URL verification remains a setup gate.
4. **Bookmark validation checks only ownership.** Existing all-policy permits referencing unreadable books; nullable page permits duplicate book-only bookmarks. Progress has no table. Fix: positive page numbers, separate owner-only progress table and book visibility checks on writes. Verify: SQL negative tests for another owner, hidden book, duplicate page, nonpositive page.
5. **Mobile navigation disappears.** `site-shell.tsx` uses `hidden md:flex` without an alternative. Fix: persistent small-screen navigation. Verify at 390px plus keyboard route navigation.

## Medium

1. Unsafe localStorage casts in `local-demo.tsx` can crash on valid JSON of the wrong shape; write failures are not handled. Replace production local state with server data; remove obsolete demo profile/auth rather than migrate untrusted browser data.
2. `EmptyState` wraps arbitrary children in a paragraph; `/library` nests a div inside it. Fix semantic container; verify hydration/browser errors.
3. No loading/error/not-found conventions, no favicon; unknown book IDs return success pages. Add these as Phase 2 routing support; verify status and retry controls.
4. Top 4 reorder is not transactional in the proposed direct-write approach. Add owner-scoped atomic RPC with lock and unique/max-four checks. Verify rollback on invalid input.
5. `.env.example` is ignored locally and contains no working connection instructions. Track the template; validate URL/key types and reject privileged keys.
6. Rights evidence and private file paths need consistent publication invariants. Add admin-only rights records and reject publication without approval/evidence.
7. Legal text says no server storage. Update to accurately describe optional Supabase-backed operation and retain draft status.

## Low

1. Giant hero and development instructions in student-facing pages. Use concise functional page introductions within existing style.
2. `prose-doc` has no styles. Add readable headings and spacing for existing draft documents.
3. No test command or security regression coverage. Add meaningful validation, PostgreSQL policy, and HTTP boundary tests; do not present simulated cloud services as a real deployment test.

## Scope and sources

Continue existing routes, palette and architecture. Historical schema remains unchanged; apply a new migration. No live database is selected or modified. Owner confirmed this turn: prepare code and setup instructions, Supabase project does not exist yet.

Version-matched Next.js guides: mutating-data, route-handlers, proxy, cookies, authentication/authorization sections. Supabase references: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control).
