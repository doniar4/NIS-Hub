import test from "node:test";
import assert from "node:assert/strict";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";
import type {AdminDataMap} from "../src/lib/admin-types";

test("Admin control RPCs preserve RLS, bound reports and protect confirmed class/role changes",{timeout:60000},async t=>{
 const db=await v051Database();
 const read=async<K extends keyof AdminDataMap>(key:K,filters:Record<string,unknown>={})=>(await db.query<{result:AdminDataMap[K]}>("select admin_control_read($1,$2::jsonb) result",[key,JSON.stringify(filters)])).rows[0].result;
 try{
  await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
   update profiles set display_name='Fixture '||right(id::text,1),bio='Preserved bio';
   update profiles set role='admin' where id in('${id(1)}','${id(4)}');
   insert into classes(id,name,grade,section) values('${id(10)}','9H',9,'H'),('${id(11)}','9G',9,'G');
   insert into subjects(id,name,name_ru,name_kz,name_en) values('${id(20)}','Math','Математика','Математика','Math'),('${id(21)}','Physics','Физика','Физика','Physics');
   update profiles set class_id='${id(10)}' where id='${id(2)}';update profiles set class_id='${id(11)}',created_at=now()-interval '9 days' where id='${id(3)}';
   insert into profile_top_subjects(profile_id,subject_id,position) values('${id(2)}','${id(20)}',1);
   insert into user_activity_logs(user_id,path,user_agent,created_at) select '${id(2)}','/schedule','Chrome/120 Windows',now()-interval '2 minutes' from generate_series(1,1200);
   insert into user_activity_logs(user_id,path,user_agent,created_at) values('${id(2)}','/library','iPhone Safari/605',now()-interval '1 minute'),('${id(3)}','/profile','Android Chrome/120',now()-interval '2 days');
   insert into class_homework(id,class_id,subject_id,due_date,body,created_by,moderation_status,deleted_at) values
    ('${id(30)}','${id(10)}','${id(20)}',current_date,'Website fixture','${id(1)}','visible',null),
    ('${id(31)}','${id(11)}','${id(21)}',current_date+1,'Telegram fixture','${id(1)}','visible',null),
    ('${id(32)}','${id(10)}','${id(20)}',current_date,'Deleted','${id(2)}','visible',now()),
    ('${id(33)}','${id(10)}','${id(21)}',current_date,'Moderated','${id(2)}','hidden',null);
   insert into telegram_homework_updates(update_id,telegram_user_id,outcome,homework_id) values(101,123,'published','${id(31)}');`);
  await t.test("anonymous/student cannot read reports, mutate roles or access bot state",async()=>{
   await asUser(db,null);await assert.rejects(read("stats"),/permission denied/);
   await asUser(db,id(2));for(const key of ["stats","users","feed","homework","activity","chart"] as const)await assert.rejects(read(key),/admin_required/);
   await assert.rejects(db.query("select admin_update_user($1,$2,'admin','student',true)",[id(2),id(10)]),/admin_required/);
   assert.equal((await db.query("select * from profiles")).rows.length,1);
   assert.equal((await db.query("select * from class_homework")).rows.length,1);
   await assert.rejects(db.query("select * from telegram_homework_updates"),/permission denied/);
  });
  await asUser(db,id(1));
  await t.test("aggregates count distinct users beyond the Data API 1000-row cap",async()=>{
   const stats=await read("stats");assert.equal(stats.totalUsers,4);assert.equal(stats.newUsers,3);assert.equal(stats.online,1);assert.equal(stats.today,1);assert.equal(stats.homeworkToday,3);
   const activity=await read("activity");assert.equal(activity.week,2);assert.equal(activity.online,1);assert.equal(activity.today,1);
   assert.equal(activity.agents.reduce((sum,a)=>sum+a.count,0),2);assert.ok(activity.agents.some(a=>a.device==="iPhone/iOS"&&a.browser==="Safari"));
   assert.ok(!JSON.stringify(activity).includes("605"));assert.equal((await read("activity",{class:id(11)})).today,0);
  });
  await t.test("users search/class/role/activity pagination and last-seen reports",async()=>{
   assert.equal((await read("users",{q:"Fixture 2",class:id(10),role:"student",active:"today"})).rows[0].id,id(2));
   assert.equal((await read("users",{q:"%_"})).total,0);
   assert.equal((await read("users",{class:id(11),active:"today"})).total,0);
   assert.equal((await read("users",{class:id(11),active:"week"})).total,1);
   const users=await read("users",{user:id(2)});assert.equal(users.total,1);assert.ok(users.rows[0].last_activity);
   assert.equal((await read("users",{offset:25})).rows.length,0);
   assert.ok(!Object.keys(users.rows[0]).includes("email"));assert.ok(!Object.keys(users.rows[0]).includes("bio"));
   assert.equal((await read("feed",{class:id(11)})).length,1);assert.equal((await read("feed")).length,25);
   assert.equal((await read("classes")).find(c=>c.id===id(10))?.active,1);
   assert.equal((await read("registrations")).length,4);
  });
  await t.test("chart has bounded 24/7/30 buckets of unique users, no page popularity",async()=>{
   for(const [range,size] of [["24h",24],["7d",7],["30d",30]] as const){const points=await read("chart",{range});assert.equal(points.length,size);assert.ok(points.every(p=>p.count<=2));}
   await assert.rejects(read("chart",{range:"9999d"}),/invalid_input/);
  });
  await t.test("homework filters omit deleted, retain moderated, and use actual bot publication evidence",async()=>{
   const stats=await read("homeworkStats");assert.equal(stats.visible,2);assert.equal(stats.hidden,1);assert.equal(stats.telegram,1);assert.equal(stats.authors,2);
   const all=await read("homework");assert.equal(all.total,3);assert.ok(!all.rows.some(h=>h.id===id(32)));
   assert.equal((await read("homework",{source:"telegram"})).rows[0].id,id(31));
   const unknown=await read("homework",{source:"unknown"});assert.equal(unknown.total,2);assert.equal(unknown.rows.find(h=>h.id===id(30))?.telegram,false,"technical author is not a source heuristic");
   assert.equal((await read("homework",{class:id(10),subject:id(21),status:"hidden"})).rows[0].id,id(33));
   assert.equal((await read("homework",{due:"1999-01-01"})).total,0);
   await db.query("select moderate_class_homework($1)",[id(30)]);assert.equal((await read("homework",{status:"hidden"})).total,2);
  });
  await t.test("support stats use real status transitions rather than updated_at estimates",async()=>{
   await asUser(db,id(2));const ticket=(await db.query<{id:string}>("select create_support_ticket('other','Safe fixture','Description') id")).rows[0].id;
   await asUser(db,id(1));await db.query("select set_support_status($1,'resolved')",[ticket]);
   const stats=await read("tickets");assert.equal(stats.resolved,1);assert.equal(stats.open,0);
  });
  await t.test("invalid reports and mutations fail closed",async()=>{
   for(const f of [{offset:-1},{offset:10001},{class:"not-uuid"},{role:"owner"},{active:"forever"}])await assert.rejects(read("users",f));
   await assert.rejects(read("homework",{source:"website"}),/invalid_input/);
   await assert.rejects(read("stats",{junk:"x".repeat(2050)}),/invalid_input/);
   await assert.rejects(db.query("select admin_control_read('secrets','{}')"),/invalid_input/);
   await assert.rejects(db.query("select admin_update_user($1,$2,'admin','student',false)",[id(2),id(10)]),/invalid_input/);
   await assert.rejects(db.query("select admin_update_user($1,$2,'admin','student',true)",[id(2),id(999)]),/invalid_input/);
   await assert.rejects(db.query("select admin_update_user($1,$2,'admin','admin',true)",[id(2),id(10)]),/stale/);
  });
  await t.test("confirmed user update preserves Bio/Top4 and rejects last-admin removal",async()=>{
   await db.query("select admin_update_user($1,$2,'admin','student',true)",[id(2),id(11)]);
   const user=(await read("users",{user:id(2)})).rows[0];assert.equal(user.role,"admin");assert.equal(user.class_id,id(11));
   await db.exec("reset role");assert.equal((await db.query<{bio:string}>("select bio from profiles where id=$1",[id(2)])).rows[0].bio,"Preserved bio");assert.equal((await db.query("select * from profile_top_subjects where profile_id=$1",[id(2)])).rows.length,1);
   await asUser(db,id(1));await db.query("select admin_update_user($1,$2,'student','admin',true)",[id(2),id(11)]);
   await db.query("select admin_update_user($1,null,'student','admin',true)",[id(4)]);
   await assert.rejects(db.query("select admin_update_user($1,null,'student','admin',true)",[id(1)]),/last_admin/);
   await asUser(db,id(4));await assert.rejects(read("users"),/admin_required/);
  });
  await t.test("indexes support actual last-seen and Telegram-source predicates; RLS is unchanged",async()=>{
   await db.exec("reset role");const indexes=await db.query<{indexname:string}>("select indexname from pg_indexes where schemaname='public' and indexname like 'admin_%'");assert.deepEqual(indexes.rows.map(r=>r.indexname).sort(),["admin_activity_user_recent","admin_telegram_homework_source"]);
   const policies=(await db.query<{tablename:string;policyname:string}>("select tablename,policyname from pg_policies where schemaname='public' and tablename='profiles'")).rows;
   assert.ok(!policies.some(p=>p.policyname.includes("Admin")));
   const funcs=(await db.query<{proconfig:string[]}>("select proconfig from pg_proc where proname in('admin_control_read','admin_update_user')")).rows;assert.ok(funcs.every(f=>f.proconfig.includes('search_path=""')));
  });
 }finally{await db.close();}
});
