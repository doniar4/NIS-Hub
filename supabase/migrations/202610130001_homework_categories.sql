begin;
alter table public.class_homework add column kind text not null default 'homework' check(kind in ('homework','sor'));
-- Preserve existing assignments and recognize the old manually written category.
update public.class_homework set kind='sor' where btrim(body) ~* '^(сор|sor|бжб)([^[:alnum:]_]|$)';
-- Telegram writes directly to the table. Infer a category only when none was supplied.
alter table public.class_homework alter column kind drop default;
create function public.default_class_homework_kind() returns trigger
language plpgsql set search_path='' as $$
begin
 new.kind:=coalesce(new.kind,case when btrim(new.body) ~* '^(сор|sor|бжб)([^[:alnum:]_]|$)' then 'sor' else 'homework' end);
 return new;
end $$;
create trigger class_homework_default_kind before insert on public.class_homework
 for each row execute function public.default_class_homework_kind();
revoke all on function public.default_class_homework_kind() from public,anon,authenticated;
-- A single signature avoids ambiguous PostgREST calls; old 3/4-argument callers still work.
drop function public.save_class_homework(uuid,date,text,uuid);
create function public.save_class_homework(p_subject uuid,p_due date,p_body text,p_id uuid default null,p_kind text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; result uuid;
begin
 if p_kind is not null and p_kind not in ('homework','sor') then raise exception 'invalid_input'; end if;
 if uid is null then raise exception 'authentication_required'; end if;
 -- Class never comes from a client argument. Lock profile through the entire mutation.
 select class_id into cid from public.profiles where id=uid for share;
 if cid is null then raise exception 'unavailable'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 1000 or p_due is null or p_due<current_date-interval '366 days' or p_due>current_date+interval '366 days' or not exists(select 1 from public.subjects where id=p_subject) then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,756));
 if p_id is null then
  if (select count(*) from public.class_homework where created_by=uid and created_at>now()-interval '1 day')>=20 then raise exception 'rate_limit'; end if;
  insert into public.class_homework(class_id,subject_id,due_date,body,created_by,kind) values(cid,p_subject,p_due,btrim(p_body),uid,p_kind) returning id into result;
 else
  update public.class_homework set subject_id=p_subject,due_date=p_due,body=btrim(p_body),kind=coalesce(p_kind,kind),updated_at=now()
   where id=p_id and created_by=uid and class_id=cid and deleted_at is null and moderation_status='visible' returning id into result;
  if result is null then raise exception 'unavailable'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_class_homework(uuid,date,text,uuid,text) from public,anon;
grant execute on function public.save_class_homework(uuid,date,text,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
