begin;

-- The private bucket must stay private even if an earlier project configuration changed it.
update storage.buckets set public = false where id = 'book-covers';

-- The v1.8 policy allowed every authenticated user to sign/read every cover,
-- including unpublished drafts. Keep access only for currently published books
-- with a published edition; the admin management policy remains separate.
drop policy if exists "Authenticated read book covers" on storage.objects;
drop policy if exists "Signed in readers see published book covers" on storage.objects;
create policy "Signed in readers see published book covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'book-covers'
  and exists (
    select 1 from public.book_variants v
    join public.books b on b.id = v.book_id
    where b.publication_status = 'published'
      and v.publication_status = 'published'
      and (v.cover_path = name or b.cover_path = name)
  )
);

-- Direct table inserts could spoof another user's activity in projects where
-- public-table default privileges include INSERT. The SECURITY DEFINER RPC
-- still records the real auth.uid(); only admins may SELECT through RLS.
revoke all on public.user_activity_logs from public, anon, authenticated;
grant select on public.user_activity_logs to authenticated;
drop policy if exists "Users record activity logs" on public.user_activity_logs;

-- These SECURITY DEFINER RPCs must not be callable without an account. Their
-- bodies already check auth.uid(), but explicit privileges remove the public
-- execution surface and avoid relying on that check forever.
revoke execute on function public.log_user_activity(text, text),
  public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz,jsonb),
  public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz),
  public.toggle_task_subtask(uuid,text,boolean)
from public, anon;

-- The server action bounds subtasks, but the RPC is also callable directly.
-- Enforce the same count and a compact byte ceiling at the data boundary.
alter table public.personal_tasks
  add constraint personal_tasks_subtasks_bound
  check (
    case when jsonb_typeof(subtasks) = 'array'
      then jsonb_array_length(subtasks) <= 30 and octet_length(subtasks::text) <= 8192
      else false
    end
  ) not valid;

commit;
