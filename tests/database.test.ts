import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Real Postgres engine, disposable in-memory data. These stubs model only the
// Supabase auth/storage schema surfaces used by our SQL, not GoTrue or Storage HTTP.
const bootstrap = `
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema auth, storage, public to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const alice = id(1), bob = id(2), admin = id(3), classId = id(10), subject = id(20), secondSubject = id(21), bookId = id(30), draftId = id(31);

test("Phase 2 migrations and RLS enforce identity, publication and ownership", async t => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await db.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/202609100001_phase2.sql", import.meta.url), "utf8"));
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, '{\"role\":\"admin\"}'), ($2, '{}'), ($3, '{}')", [alice, bob, admin]);
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    async function asUser(user: string | null) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
      await db.exec(user ? "set role authenticated" : "set role anon");
    }
    async function count(sql: string, parameters: unknown[] = []) {
      return (await db.query(sql, parameters)).rows.length;
    }
    const book = { id: bookId, title: "Self-authored integration fixture", subject_id: subject, class_id: classId, file_path: "tests/own.pdf", page_count: 3, license_status: "approved", publication_status: "published" };

    await t.test("profile creation ignores hostile signup metadata; identity/role cannot be changed", async () => {
      await asUser(alice);
      const profiles = await db.query<{ id: string; role: string }>("select id, role from public.profiles");
      assert.deepEqual(profiles.rows, [{ id: alice, role: "student" }]);
      await assert.rejects(db.query("update public.profiles set role='admin' where id=$1", [alice]), /permission denied/);
      await assert.rejects(db.query("update public.profiles set id=$1 where id=$2", [bob, alice]), /permission denied/);
      await assert.rejects(db.query("insert into public.profiles(id,role) values($1,'admin')", [id(99)]), /permission denied/);
      assert.equal(await count("update public.profiles set display_name='Tampered' where id=$1 returning id", [bob]), 0);
      await asUser(admin);
      assert.equal(await count("select id from public.profiles where id=$1", [alice]), 0);
    });
    await t.test("admin creates catalog, evidence and schedule; publication is transactional", async () => {
      await asUser(admin);
      await db.query("insert into public.classes(id,name) values($1,'TEST CLASS')", [classId]);
      await db.query("insert into public.subjects(id,name) values($1,'TEST SUBJECT'),($2,'SECOND TEST SUBJECT')", [subject, secondSubject]);
      await db.query("select public.save_book($1::jsonb,$2,$3)", [JSON.stringify(book), "Self-authored test fixture", "Permission for isolated automated tests"]);
      await db.query("select public.save_book($1::jsonb,$2,$3)", [JSON.stringify({ ...book, id: draftId, file_path: "tests/draft.pdf", publication_status: "draft", license_status: "pending_review" }), "Self-authored", "Not approved"]);
      await db.query("insert into public.schedule(class_id,date,lesson_number,subject_id) values($1,'2026-09-10',1,$2)", [classId, subject]);
      await db.query("insert into storage.objects(bucket_id,name) values('book-files','tests/own.pdf'),('book-files','tests/draft.pdf')");
      await assert.rejects(db.query("insert into public.books(id,title,subject_id,file_path,license_status,publication_status) values($1,'NO EVIDENCE',$2,'none.pdf','approved','published')", [id(33), subject]), /Rights evidence/);
      assert.equal(await count("select id from public.books where id=$1", [id(33)]), 0);
      await assert.rejects(db.query("update public.books set license_status='restricted' where id=$1", [bookId]), /publication_requires_approval/);
      await assert.rejects(db.query("delete from public.book_rights where book_id=$1", [bookId]), /Unpublish/);
      await assert.rejects(db.query("update public.book_rights set book_id=$1 where book_id=$2", [id(33), bookId]), /permission denied/);
      // Normal edits remain supported by column-level evidence grants.
      await db.query("select public.save_book($1::jsonb,$2,$3)", [JSON.stringify(book), "Self-authored", "Updated permission note"]);
    });
    await t.test("student cannot mutate admin tables, rights or storage", async () => {
      await asUser(alice);
      await assert.rejects(db.query("insert into public.classes(name) values('FORGED')"), /row-level security/);
      await assert.rejects(db.query("insert into public.subjects(name) values('FORGED')"), /row-level security/);
      await assert.rejects(db.query("insert into public.schedule(class_id,date,lesson_number,subject_id) values($1,'2026-09-10',2,$2)", [classId, subject]), /row-level security/);
      await assert.rejects(db.query("select public.save_book($1::jsonb,'source','note')", [JSON.stringify(book)]), /Admin required/);
      assert.equal(await count("update public.books set title='FORGED' where id=$1 returning id", [bookId]), 0);
      assert.equal(await count("select * from public.book_rights"), 0);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('book-files','forged.pdf')"), /row-level security/);
    });
    await t.test("profile and Top 4 save atomically, reject duplicates, overflow and invalid subjects", async () => {
      await asUser(alice);
      await db.query("select public.save_profile($1,$2,$3)", ["Alice", classId, [subject, secondSubject]]);
      for (const subjects of [[subject, subject], Array(5).fill(subject), [id(999)], [null]]) {
        await assert.rejects(db.query("select public.save_profile($1,$2,$3)", ["Must roll back", null, subjects]));
        assert.equal((await db.query<{ display_name: string }>("select display_name from public.profiles")).rows[0].display_name, "Alice");
        assert.equal(await count("select * from public.profile_top_subjects"), 2);
      }
      await db.query("select public.save_profile($1,$2,$3)", ["Alice", classId, [secondSubject, subject]]);
      assert.deepEqual((await db.query<{ subject_id: string }>("select subject_id from public.profile_top_subjects order by position")).rows.map(r => r.subject_id), [secondSubject, subject]);
      await assert.rejects(db.query("insert into public.profile_top_subjects values($1,$2,5)", [alice, subject]));
      await assert.rejects(db.query("insert into public.profile_top_subjects values($1,$2,1)", [bob, subject]), /row-level security/);
      await asUser(bob);
      assert.equal(await count("select * from public.profile_top_subjects"), 0);
    });
    await t.test("only approved published book metadata and files are readable", async () => {
      await asUser(alice);
      assert.deepEqual((await db.query<{ id: string }>("select id from public.books")).rows, [{ id: bookId }]);
      assert.deepEqual((await db.query<{ name: string }>("select name from storage.objects where bucket_id='book-files'")).rows, [{ name: "tests/own.pdf" }]);
      await asUser(null);
      await assert.rejects(db.query("select * from public.books"), /permission denied/);
      assert.equal(await count("select * from storage.objects"), 0);
      await assert.rejects(db.query("select public.save_profile('x',null,'{}')"), /permission denied/);
    });
    await t.test("bookmarks and progress are separate, bounded and owner-only", async () => {
      await asUser(alice);
      await db.query("insert into public.bookmarks(profile_id,book_id,page_number) values($1,$2,2)", [alice, bookId]);
      await db.query("insert into public.reading_progress(profile_id,book_id,page_number) values($1,$2,3)", [alice, bookId]);
      assert.equal((await db.query<{ page_number: number }>("select page_number from public.bookmarks")).rows[0].page_number, 2);
      for (const page of [0, -1, 4, 100001]) {
        await assert.rejects(db.query("insert into public.bookmarks(profile_id,book_id,page_number) values($1,$2,$3)", [alice, bookId, page]));
        await assert.rejects(db.query("update public.reading_progress set page_number=$1", [page]));
      }
      await assert.rejects(db.query("insert into public.bookmarks(profile_id,book_id,page_number) values($1,$2,1)", [alice, draftId]), /row-level security/);
      await assert.rejects(db.query("insert into public.reading_progress(profile_id,book_id,page_number) values($1,$2,1)", [bob, bookId]), /row-level security/);
      await asUser(bob);
      assert.equal(await count("select * from public.bookmarks"), 0);
      assert.equal(await count("select * from public.reading_progress"), 0);
      assert.equal(await count("delete from public.bookmarks where profile_id=$1 returning id", [alice]), 0);
      assert.equal(await count("update public.reading_progress set page_number=1 where profile_id=$1 returning book_id", [alice]), 0);
    });
    await t.test("avatars stay in the owner's folder even on rename", async () => {
      await asUser(alice);
      await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [`${alice}/avatar.png`]);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [`${bob}/avatar.png`]), /row-level security/);
      await assert.rejects(db.query("update storage.objects set name=$1 where bucket_id='avatars'", [`${bob}/avatar.png`]), /row-level security/);
      await asUser(bob);
      assert.equal(await count("select * from storage.objects where bucket_id='avatars'"), 0);
    });
    await t.test("reference deletion is protected, archiving removes fresh read access", async () => {
      await asUser(admin);
      await assert.rejects(db.query("delete from public.classes where id=$1", [classId]), /foreign key/);
      await assert.rejects(db.query("delete from public.subjects where id=$1", [subject]), /foreign key/);
      await db.query("update public.books set publication_status='archived' where id=$1", [bookId]);
      await asUser(alice);
      assert.equal(await count("select * from public.books"), 0);
      assert.equal(await count("select * from storage.objects where bucket_id='book-files'"), 0);
      await assert.rejects(db.query("update public.reading_progress set page_number=1"), /row-level security/);
      assert.equal(await count("delete from public.bookmarks returning id"), 1);
      assert.equal(await count("select * from public.reading_progress"), 1);
    });
  } finally { await db.close(); }
});
