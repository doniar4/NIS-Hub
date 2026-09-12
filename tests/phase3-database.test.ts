import test from "node:test";
import assert from "node:assert/strict";
import { phase3Database, fixtureId as id, asUser } from "./helpers/database";

test("Phase 3 avatars: canonical ownership, actual UPSERT cooldown, single object, profile ordering", async () => {
  const db = await phase3Database(); const alice = id(1), bob = id(2);
  try {
    await db.query("insert into auth.users(id) values($1),($2)", [alice, bob]);
    await asUser(db, alice);
    await assert.rejects(db.query("update public.profiles set avatar_path=$1 where id=$2", [alice + "/avatar.webp", alice]), /upload must succeed/);
    for (const path of [bob + "/avatar.webp", alice + "/random.webp", alice + "/avatar.png", alice + "/sub/avatar.webp", alice + "/../avatar.webp"]) {
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [path]), /row-level security/);
    }
    const upsert = () => db.query("insert into storage.objects(bucket_id,name) values('avatars',$1) on conflict(bucket_id,name) do update set updated_at=now() returning id", [alice + "/avatar.webp"]);
    await upsert();
    await db.query("update public.profiles set avatar_path=$1 where id=$2", [alice + "/avatar.webp", alice]);
    await assert.rejects(upsert(), /row-level security/);
    assert.equal((await db.query("delete from storage.objects where bucket_id='avatars' returning id")).rows.length, 0);
    // Privileged fixture clock only; production code never manipulates Storage rows.
    await db.exec("reset role");
    await db.exec("update storage.objects set updated_at=now()-interval '61 seconds' where bucket_id='avatars'");
    await asUser(db, alice);
    for (const path of [bob + "/avatar.webp", alice + "/renamed.webp"]) {
      await assert.rejects(db.query("update storage.objects set name=$1 where bucket_id='avatars'", [path]), /row-level security/);
    }
    await upsert(); await assert.rejects(upsert(), /row-level security/);
    assert.equal((await db.query("select * from storage.objects where bucket_id='avatars'")).rows.length, 1);
    await assert.rejects(db.query("update public.profiles set avatar_path=$1 where id=$2", [bob + "/avatar.webp", alice]));
    await asUser(db, bob);
    assert.equal((await db.query("select * from storage.objects where bucket_id='avatars'")).rows.length, 0);
    assert.equal((await db.query("update public.profiles set avatar_path=null where id=$1 returning id", [alice])).rows.length, 0);
    await asUser(db, null);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    await assert.rejects(upsert());
    await db.exec("reset role");
    const bucket = (await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>("select public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars'")).rows[0];
    assert.equal(bucket.public, false); assert.equal(Number(bucket.file_size_limit), 262144);
    assert.deepEqual(bucket.allowed_mime_types, ["image/webp"]);
  } finally { await db.close(); }
});

test("Phase 3 manual schedule import: admin-only, bounded, atomic, idempotent, no implicit deletion", async () => {
  const db = await phase3Database(); const admin = id(1), student = id(2), classId = id(10), subject = id(20);
  const row = { class_id: classId, subject_id: subject, date: "2026-09-14", lesson_number: 1, teacher: null, room: null };
  const run = (rows: unknown) => db.query("select public.import_schedule($1::jsonb)", [JSON.stringify(rows)]);
  try {
    await db.query("insert into auth.users(id) values($1),($2)", [admin, student]);
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    await asUser(db, admin);
    await db.query("insert into public.classes(id,name) values($1,'TEST CLASS')", [classId]);
    await db.query("insert into public.subjects(id,name) values($1,'TEST SUBJECT')", [subject]);
    await run([row, { ...row, lesson_number: 2, room: "2" }]);
    const original = (await db.query("select * from public.schedule order by lesson_number")).rows;
    await run([row]);
    assert.deepEqual((await db.query("select * from public.schedule order by lesson_number")).rows, original);
    for (const invalid of [
      null, {}, [], [row, row], Array(501).fill(row),
      ...[{ date: "2026-02-30" }, { lesson_number: 1.5 }, { lesson_number: "1" }, { lesson_number: 21 },
        { teacher: "a".repeat(101) }, { room: 12 }, { student: "private" }, { class_id: id(99) }].map(change => [{ ...row, room: "would change" }, { ...row, lesson_number: 3, ...change }]),
    ]) {
      await assert.rejects(run(invalid));
      assert.deepEqual((await db.query("select * from public.schedule order by lesson_number")).rows, original);
    }
    await run([{ ...row, room: "42" }]);
    assert.equal((await db.query<{ room: string }>("select room from public.schedule where lesson_number=1")).rows[0].room, "42");
    assert.equal((await db.query("select * from public.schedule")).rows.length, 2);
    await asUser(db, student); await assert.rejects(run([row]), /Admin required/);
    await asUser(db, null); await assert.rejects(run([row]), /permission denied/);
  } finally { await db.close(); }
});
