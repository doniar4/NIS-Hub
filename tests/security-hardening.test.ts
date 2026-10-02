import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { asUser, fixtureId } from "./helpers/database";

test("security migration hides draft covers, blocks activity spoofing, and bounds subtasks", async () => {
  const db = new PGlite();
  const owner = fixtureId(710);
  const published = fixtureId(711);
  const draft = fixtureId(712);
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function public.is_admin() returns boolean language sql stable as $$ select false $$;
      grant usage on schema auth, storage, public to authenticated;
      alter default privileges in schema public grant all on tables to authenticated;
      create table storage.buckets(id text primary key, public boolean not null);
      create table public.books(id uuid primary key, publication_status text not null, cover_path text);
      create table public.book_variants(id uuid primary key, book_id uuid references public.books(id), publication_status text not null, cover_path text);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
      alter table storage.objects enable row level security;
      grant select on storage.objects to authenticated;
      create policy "Authenticated read book covers" on storage.objects for select to authenticated using(bucket_id='book-covers');
      create policy "Signed in readers see published book covers" on storage.objects for select to authenticated using(false);
      create table public.user_activity_logs(id uuid primary key default gen_random_uuid(), user_id uuid, path text, user_agent text);
      alter table public.user_activity_logs enable row level security;
      create policy "Admins view activity logs" on public.user_activity_logs for select to authenticated using(public.is_admin());
      create policy "Users record activity logs" on public.user_activity_logs for insert to authenticated with check(auth.uid() is not null);
      create function public.log_user_activity(p_path text, p_user_agent text default null) returns void
        language plpgsql security definer set search_path='' as $$
        begin insert into public.user_activity_logs(user_id,path,user_agent) values(auth.uid(),left(p_path,255),left(p_user_agent,255)); end $$;
      grant execute on function public.log_user_activity(text,text) to authenticated;
      create table public.personal_tasks(id uuid primary key default gen_random_uuid(), subtasks jsonb not null default '[]'::jsonb);
      create function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz,jsonb)
        returns uuid language sql as $$ select gen_random_uuid() $$;
      create function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz)
        returns uuid language sql as $$ select gen_random_uuid() $$;
      create function public.toggle_task_subtask(uuid,text,boolean) returns jsonb language sql as $$ select '[]'::jsonb $$;
    `);
    await db.query("insert into storage.buckets(id,public) values('book-covers',true)");
    await db.query("insert into public.books(id,publication_status,cover_path) values($1,'published','books/published.jpg'),($2,'draft','books/draft.jpg')", [published, draft]);
    await db.query("insert into public.book_variants(id,book_id,publication_status) values($1,$1,'published'),($2,$2,'draft')", [published, draft]);
    await db.query("insert into storage.objects(bucket_id,name) values('book-covers','books/published.jpg'),('book-covers','books/draft.jpg')");

    await db.exec(readFileSync(new URL("../supabase/migrations/202610020002_security_hardening.sql", import.meta.url), "utf8"));
    assert.equal((await db.query<{ public: boolean }>("select public from storage.buckets where id='book-covers'")).rows[0].public, false);

    await asUser(db, owner);
    const visible = await db.query<{ name: string }>("select name from storage.objects order by name");
    assert.deepEqual(visible.rows.map(row => row.name), ["books/published.jpg"]);
    await assert.rejects(db.query("insert into public.user_activity_logs(user_id,path) values($1,'/fake')", [fixtureId(799)]), /permission denied/);
    await db.query("select public.log_user_activity('/library','fixture-browser')");
    await asUser(db, null);
    await assert.rejects(db.query("select public.log_user_activity('/fake','anon')"), /permission denied/);
    await db.exec("reset role");
    assert.deepEqual((await db.query<{ user_id: string }>("select user_id from public.user_activity_logs")).rows.map(row => row.user_id), [owner]);
    await assert.rejects(db.query("insert into public.personal_tasks(subtasks) values($1::jsonb)", [JSON.stringify(Array.from({ length: 31 }, (_, id) => ({ id })))]), /personal_tasks_subtasks_bound/);
    await db.query("insert into public.personal_tasks(subtasks) values('[{\"id\":\"one\",\"title\":\"Read\"}]')");
  } finally {
    await db.close();
  }
});

test("Next.js serves anti-framing, MIME and referrer protections", async () => {
  const config = (await import("../next.config")).default;
  const routes = await config.headers?.();
  assert.ok(routes);
  const headers = Object.fromEntries(routes[0].headers.map(header => [header.key, header.value]));
  assert.equal(headers["Content-Security-Policy"], "frame-ancestors 'none'");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
});
