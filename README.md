# NIS Hub v0.1

Minimal, student-focused digital-library prototype for the NIS Library concept.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## Current state

- The routing, responsive interface, local reader test, local profile draft, schedule test UI, legal drafts, and admin safety boundary are implemented.
- There are no published textbooks, real user accounts, uploaded avatars, real schedules, EduPage access, analytics, or payments.
- Forms do not send credentials before Supabase is intentionally configured.

## Before real users

1. Create Supabase schema, Row Level Security policies, private book storage, and separate avatar storage.
2. Add verified environment variables; never expose a service-role key in the browser.
3. Replace test schedule data only with a verified and permitted source.
4. Add only content with confirmed distribution rights.
5. Complete legal, accessibility, security, and content-rights review.

The initial SQL and connection checklist are provided in [supabase/schema.sql](supabase/schema.sql) and [docs/supabase-setup.md](docs/supabase-setup.md).
