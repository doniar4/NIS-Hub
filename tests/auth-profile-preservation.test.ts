import test from "node:test";
import assert from "node:assert/strict";
import { phase3Database, fixtureId } from "./helpers/database";

test("the existing auth trigger creates one student profile and never overwrites it from provider metadata", async () => {
  const db = await phase3Database();
  const existing = fixtureId(401);
  const fresh = fixtureId(402);
  const subject = fixtureId(403);
  try {
    await db.query("insert into public.subjects(id,name) values($1,'Fixture subject')", [subject]);
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)", [existing, JSON.stringify({ role: "admin", full_name: "Forged name", avatar_url: "https://untrusted.example/avatar" })]);
    let profile = await db.query<{ id: string; role: string; display_name: string | null }>("select id,role,display_name from public.profiles where id=$1", [existing]);
    assert.deepEqual(profile.rows, [{ id: existing, role: "student", display_name: null }]);

    await db.query("update public.profiles set display_name='Existing Student' where id=$1", [existing]);
    await db.query("insert into public.profile_top_subjects(profile_id,subject_id,position) values($1,$2,1)", [existing, subject]);
    // GoTrue links an identity to an existing verified-email auth user. Updating
    // that user's metadata must not run NIS Hub's auth-user INSERT trigger again.
    await db.query("update auth.users set raw_user_meta_data=$2::jsonb where id=$1", [existing, JSON.stringify({ role: "admin", full_name: "Google name" })]);
    profile = await db.query("select id,role,display_name from public.profiles where id=$1", [existing]);
    assert.deepEqual(profile.rows, [{ id: existing, role: "student", display_name: "Existing Student" }]);
    assert.equal((await db.query("select subject_id from public.profile_top_subjects where profile_id=$1", [existing])).rows.length, 1);
    // Apple may provide no name and may use a relay email. Neither changes the
    // existing row or role when GoTrue links the verified identity to this user.
    await db.query("update auth.users set raw_user_meta_data=$2::jsonb where id=$1", [existing, JSON.stringify({ provider: "apple", email: "relay@privaterelay.appleid.com" })]);
    assert.deepEqual((await db.query("select id,role,display_name from public.profiles where id=$1", [existing])).rows,
      [{ id: existing, role: "student", display_name: "Existing Student" }]);

    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)", [fresh, JSON.stringify({ full_name: "New Google user" })]);
    assert.deepEqual((await db.query<{ id: string; role: string; display_name: string | null }>("select id,role,display_name from public.profiles where id=$1", [fresh])).rows,
      [{ id: fresh, role: "student", display_name: null }]);
    assert.equal((await db.query("select id from public.profiles where id in ($1,$2)", [existing, fresh])).rows.length, 2);
  } finally {
    await db.close();
  }
});
