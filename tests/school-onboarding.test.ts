import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import { nisCities, nisSchools, needsSchoolOnboarding, validSchoolSelection, schoolsInCity } from "../src/lib/schools";
import { schoolCopy } from "../src/lib/school-copy";
import { safeNext } from "../src/lib/validation";
import regions from "../src/lib/data/kazakhstan-regions.json";

test("NIS catalogue covers 18 cities, 21 schools, all map regions and valid city-school pairs", () => {
  assert.equal(nisCities.length, 18); assert.equal(nisSchools.length, 21);
  assert.equal(new Set(nisSchools.map(s => s.id)).size, 21);
  assert.equal(new Set(regions.map(r => r.pcode)).size, 20);
  for (const city of nisCities) {
    assert.ok(regions.some(region => region.pcode === city.region));
    assert.ok(schoolsInCity(city.id).length);
    assert.ok(city.x > 0 && city.x < 620 && city.y > 0 && city.y < 340);
  }
  for (const school of nisSchools) {
    assert.ok(validSchoolSelection(school.city_id, school.id));
    assert.equal(new URL(school.website).hostname, "schools.nis.edu.kz");
  }
  assert.equal(validSchoolSelection("astana", "oral"), false);
  for (const locale of ["ru", "kk", "en"] as const) assert.deepEqual(Object.keys(schoolCopy(locale)), Object.keys(schoolCopy("ru")));
  assert.ok(needsSchoolOnboarding({ role: "student" }));
  assert.ok(needsSchoolOnboarding({ role: "student", school_id: "oral" }));
  assert.equal(needsSchoolOnboarding({ role: "student", school_id: "oral", onboarding_completed_at: "2026-10-13" }), false);
  assert.equal(needsSchoolOnboarding({ role: "admin" }), false);
  assert.equal(safeNext("/onboarding"), "/onboarding");
  assert.equal(safeNext("//untrusted.example/onboarding"), "/profile");
});

test("School migration preserves established users and supports first school selection, completion and switching", async () => {
  const db = await v051Database(async db => {
    await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into classes(id,name,grade) values('${id(10)}','9A',9);
      insert into subjects(id,name) values('${id(20)}','Physics');
      update profiles set display_name='Established',class_id='${id(10)}',bio='Existing bio' where id='${id(2)}';
      insert into profile_top_subjects(profile_id,subject_id,position) values('${id(2)}','${id(20)}',1);
      update profiles set role='admin' where id='${id(3)}';`);
  });
  try {
    const initial = await db.query<{id:string;school_id:string|null;onboarding_completed_at:string|null}>("select id,school_id,onboarding_completed_at from profiles order by id");
    assert.equal(initial.rows[0].school_id, null); assert.equal(initial.rows[0].onboarding_completed_at, null);
    assert.equal(initial.rows[1].school_id, "oral"); assert.ok(initial.rows[1].onboarding_completed_at);
    assert.equal((await db.query("select * from nis_schools")).rows.length, 21);
    assert.deepEqual((await db.query<{id:string}>("select id from nis_schools order by id")).rows.map(s => s.id), nisSchools.map(s => s.id).sort());
    await asUser(db, id(1));
    assert.equal((await db.query("select * from nis_cities")).rows.length, 18);
    await assert.rejects(db.query("select complete_profile_onboarding()"), /incomplete_profile/);
    await assert.rejects(db.query("select save_profile_school('astana','oral')"), /invalid_school/);
    await assert.rejects(db.query("select save_profile_school('astana','unknown')"), /invalid_school/);
    await assert.rejects(db.query("update profiles set school_id='oral' where id=$1", [id(1)]), /permission denied/);
    await assert.rejects(db.query("update profiles set onboarding_completed_at=now() where id=$1", [id(1)]), /permission denied/);
    await db.query("select save_profile_school('astana','astana-nura')");
    await assert.rejects(db.query("select complete_profile_onboarding()"), /incomplete_profile/);
    await assert.rejects(db.query("select save_profile_v053('New',$1,'{}','')", [id(10)]), /class_school_mismatch/);
    await db.query("select save_profile_v053('New',null,'{}','')");
    await db.query("select complete_profile_onboarding()");
    const completed = (await db.query<{school_id:string;onboarding_completed_at:string}>("select school_id,onboarding_completed_at from profiles where id=$1", [id(1)])).rows[0];
    assert.equal(completed.school_id, "astana-nura"); assert.ok(completed.onboarding_completed_at);
    await db.query("select complete_profile_onboarding()");
    assert.equal(String((await db.query<{onboarding_completed_at:string}>("select onboarding_completed_at from profiles where id=$1", [id(1)])).rows[0].onboarding_completed_at), String(completed.onboarding_completed_at));
    await asUser(db, id(2));
    await db.query("select save_profile_school('oral','oral')");
    assert.equal((await db.query<{class_id:string}>("select class_id from profiles where id=$1", [id(2)])).rows[0].class_id, id(10));
    await db.query("select save_profile_school('almaty','almaty-medeu')");
    const switched = (await db.query<{class_id:string|null;display_name:string;bio:string;onboarding_completed_at:string}>("select class_id,display_name,bio,onboarding_completed_at from profiles where id=$1", [id(2)])).rows[0];
    assert.equal(switched.class_id, null); assert.equal(switched.display_name, "Established"); assert.equal(switched.bio, "Existing bio"); assert.ok(switched.onboarding_completed_at);
    assert.equal((await db.query("select * from profile_top_subjects where profile_id=$1", [id(2)])).rows.length, 1);
    await asUser(db, id(1));
    assert.equal((await db.query<{school_id:string}>("select school_id from profiles where id=$1", [id(1)])).rows[0].school_id, "astana-nura");
    await asUser(db, null);
    await assert.rejects(db.query("select save_profile_school('oral','oral')"));
    await assert.rejects(db.query("select complete_profile_onboarding()"));
    await assert.rejects(db.query("select * from nis_schools"));
  } finally { await db.close(); }
});

test("Map attribution ships alongside its derived vector paths", () => {
  assert.match(readFileSync("public/data/licenses/kazakhstan-map-MIT.txt", "utf8"), /MIT License/);
});
