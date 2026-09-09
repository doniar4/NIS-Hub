# Supabase setup for the next stage

The current interface deliberately does not create accounts or upload files before a real Supabase project is configured.

1. Create a new Supabase project.
2. In its SQL Editor, review and apply [`../supabase/schema.sql`](../supabase/schema.sql).
3. Add the project URL and publishable/anon key to `.env.local` using `.env.example` as the template. Do not add a service-role key to a browser-visible variable.
4. Configure email/password authentication and the intended redirect URLs.
5. Promote an administrator through a controlled server-side action or the Supabase dashboard. Do not add a role selector to a public form.
6. Connect the UI to Supabase using server-side checks for admin actions and signed file URLs. Keep the `book-files` bucket private.
7. Test Row Level Security with two normal accounts and one administrator before adding real content.

## Important limitations

- There are no seeded books or schedules: adding real-looking data without confirming it would be misleading.
- The schema does not grant browser users direct read access to private book files. A production reader should request a short-lived URL only after confirming the user can see the corresponding approved book record.
- Legal review is required before collecting real student data or publishing material.
