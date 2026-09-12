import test from "node:test";
import assert from "node:assert/strict";
import { phase3Database, fixtureId as id, asUser } from "./helpers/database";

test("all Phase 3 migrations retain private books, publication gates, Top4 and reading ownership", async () => {
  const db = await phase3Database();
  const admin = id(1), alice = id(2), bob = id(3), subject = id(20), bookId = id(30), draftId = id(31);
  try {
    await db.query("insert into auth.users(id) values($1),($2),($3)", [admin, alice, bob]);
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    await asUser(db, admin);
    await db.query("insert into public.subjects(id,name) values($1,'Regression fixture')", [subject]);
    const book = { id: bookId, title: "Authorised fixture", subject_id: subject, file_path: "tests/own.pdf",
      page_count: 3, license_status: "approved", publication_status: "published" };
    await db.query("select public.save_book($1::jsonb,'Self-authored test','Fixture permission')", [JSON.stringify(book)]);
    await db.query("select public.save_book($1::jsonb,'Self-authored test','Not approved')",
      [JSON.stringify({ ...book, id: draftId, publication_status: "draft", license_status: "pending_review", file_path: "tests/draft.pdf" })]);
    await db.exec("insert into storage.objects(bucket_id,name) values('book-files','tests/own.pdf'),('book-files','tests/draft.pdf')");
    await asUser(db, alice);
    assert.deepEqual((await db.query<{ id: string }>("select id from public.books")).rows, [{ id: bookId }]);
    assert.deepEqual((await db.query<{ name: string }>("select name from storage.objects where bucket_id='book-files'")).rows, [{ name: "tests/own.pdf" }]);
    await db.query("select public.save_profile('Alice',null,$1)", [[subject]]);
    await assert.rejects(db.query("select public.save_profile('Invalid',null,$1)", [[subject, subject]]), /unique subjects/);
    assert.equal((await db.query<{ display_name: string }>("select display_name from public.profiles")).rows[0].display_name, "Alice");
    await assert.rejects(db.query("update public.profiles set role='admin'"), /permission denied/);
    await db.query("insert into public.bookmarks(profile_id,book_id,page_number) values($1,$2,2)", [alice, bookId]);
    await db.query("insert into public.reading_progress(profile_id,book_id,page_number) values($1,$2,3)", [alice, bookId]);
    await assert.rejects(db.query("update public.reading_progress set page_number=4"));
    await asUser(db, bob);
    assert.equal((await db.query("select * from public.bookmarks")).rows.length, 0);
    assert.equal((await db.query("select * from public.reading_progress")).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('book-files','tampered.pdf')"), /row-level security/);
    await asUser(db, null);
    await assert.rejects(db.query("select * from public.books"), /permission denied/);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    await asUser(db, admin); await db.query("update public.books set publication_status='archived' where id=$1", [bookId]);
    await asUser(db, alice);
    assert.equal((await db.query("select * from public.books")).rows.length, 0);
    assert.equal((await db.query("select * from storage.objects where bucket_id='book-files'")).rows.length, 0);
    assert.equal((await db.query("select * from public.bookmarks")).rows.length, 1);
    assert.equal((await db.query<{ page_number: number }>("select page_number from public.reading_progress")).rows[0].page_number, 3);
  } finally { await db.close(); }
});
