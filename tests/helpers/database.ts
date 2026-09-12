import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function phase3Database() {
  const db = new PGlite();
  try {
    // Models SQL surfaces, NOT GoTrue or the Storage HTTP service.
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
        name text not null, updated_at timestamptz not null default now(), unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$
        select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
      $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage, public to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
    `);
    for (const file of ["schema.sql", "migrations/202609100001_phase2.sql", "migrations/202609110001_phase3_avatar.sql", "migrations/202609120001_phase3_schedule_import.sql"]) {
      await db.exec(readFileSync(new URL("../../supabase/" + file, import.meta.url), "utf8"));
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}
export async function asUser(db: PGlite, user: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
}
