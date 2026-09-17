import test from "node:test";
import assert from "node:assert/strict";
import {v05Database} from "./helpers/v05-database";
import {asUser,fixtureId as id} from "./helpers/database";
test("v0.5 calendar and immutable timetable history: admin-only writes, atomic rollback, stale-version guard",async()=>{
 const db=await v05Database();
 try {
  await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'); update public.profiles set role='admin' where id='"+id(1)+"';");
  await db.query("insert into public.classes(id,name) values ($1,'9H')",[id(10)]);
  await db.query("insert into public.subjects(id,name) values ($1,'Math')",[id(20)]);
  const payload=[{class_id:id(10),subject_id:id(20),weekday:1,lesson_start:1,lesson_end:1,room:"305"}];
  const run=(rows:unknown)=>db.query("select public.import_weekly_schedule($1::jsonb)",[JSON.stringify(rows)]);
  const active=async()=>(await db.query<{id:string}>("select id from public.schedule_import_batches where status='active'")).rows[0].id;
  await asUser(db,id(2));
  await assert.rejects(run(payload),/Admin required/);
  assert.equal((await db.query("select * from public.schedule_import_batches")).rows.length,0);
  await assert.rejects(db.query("insert into public.non_school_days(start_date,end_date,type,label) values ('2026-09-21','2026-09-25','vacation','Break')"));
  await asUser(db,id(1));
  await db.query("insert into public.non_school_days(start_date,end_date,type,label) values ('2026-09-21','2026-09-25','vacation','Break')");
  await assert.rejects(db.query("insert into public.non_school_days(start_date,end_date,type,label) values ('2026-09-25','2026-09-21','vacation','Bad')"));
  await run(payload);const first=await active();
  const before=(await db.query("select * from public.weekly_schedule")).rows;
  await assert.rejects(run([...payload,{...payload[0],weekday:6}]));
  assert.equal(await active(),first);assert.deepEqual((await db.query("select * from public.weekly_schedule")).rows,before);
  await run([{...payload[0],room:"307"}]);const second=await active();
  await assert.rejects(db.query("delete from public.schedule_import_batches"));
  await assert.rejects(db.query("update public.weekly_schedule set room='999'"));
  await assert.rejects(db.query("select public.restore_schedule_version($1,$2)",[first,first]),/changed/);
  await asUser(db,id(2));await assert.rejects(db.query("select public.restore_schedule_version($1,$2)",[first,second]),/Admin required/);
  assert.equal((await db.query("select * from public.non_school_days")).rows.length,1);
  await asUser(db,id(1));await db.query("select public.restore_schedule_version($1,$2)",[first,second]);
  assert.equal((await db.query<{room:string}>("select room from public.weekly_schedule")).rows[0].room,"305");
  assert.equal((await db.query("select * from public.schedule_import_batches")).rows.length,4);
  const lesson=(await db.query<{id:string}>("select id from public.weekly_schedule")).rows[0].id;
  await db.query("select public.delete_weekly_lesson($1)",[lesson]);assert.equal((await db.query("select * from public.weekly_schedule")).rows.length,0);
  assert.equal((await db.query("select * from public.schedule_import_batches")).rows.length,5);
  await asUser(db,null);await assert.rejects(db.query("select * from public.non_school_days"));
 } finally {await db.close();}
});
