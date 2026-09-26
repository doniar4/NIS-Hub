import test from "node:test";
import assert from "node:assert/strict";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {tasksCopy} from "../src/lib/tasks-copy";

test("task copy is complete in RU, KK and EN",()=>{
 const english=Object.keys(tasksCopy("en"));
 for(const locale of ["ru","kk","en"] as const){
  assert.deepEqual(Object.keys(tasksCopy(locale)),english);
  assert.ok(Object.values(tasksCopy(locale)).every(value=>value.length>0));
 }
});

test("personal tasks are private, validated, completable and produce adjustable reminders",async()=>{
 const db=await v051Database();
 try{
  await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}');
   insert into subjects(id,name) values('${id(20)}','Physics');`);
  await asUser(db,id(1));
  const due=new Date(Date.now()+60*60*1000).toISOString(),remind=new Date(Date.now()-60*1000).toISOString();
  const task=(await db.query<{id:string}>("select save_personal_task(null,' Review mechanics ','Chapter 4','high',$1,$2,$3) id",[id(20),due,remind])).rows[0].id;
  const own=await db.query<{title:string;priority:string}>("select title,priority from personal_tasks");
  assert.deepEqual(own.rows,[{title:"Review mechanics",priority:"high"}]);
  assert.equal((await db.query("select * from task_notification_feed()")).rows.length,1);
  assert.equal((await db.query<{count:number}>("select task_notification_unread()::int count")).rows[0].count,1);
  await assert.rejects(db.query("update personal_tasks set title='Bypass' where id=$1",[task]));
  await assert.rejects(db.query("select save_personal_task(null,'Bad reminder','','medium',null,$1,$2)",[due,new Date(Date.parse(due)+1000).toISOString()]));

  await asUser(db,id(2));
  assert.equal((await db.query("select * from personal_tasks")).rows.length,0);
  await assert.rejects(db.query("select set_personal_task_status($1,'completed')",[task]));

  await asUser(db,id(1));
  await db.query("select dismiss_task_notification($1)",[task]);
  assert.equal((await db.query<{count:number}>("select task_notification_unread()::int count")).rows[0].count,0);
  await db.query("select snooze_personal_task($1,10)",[task]);
  assert.equal((await db.query<{count:number}>("select task_notification_unread()::int count")).rows[0].count,0,"snoozed reminder is not due yet");
  await db.query("select set_personal_task_status($1,'completed')",[task]);
  const completed=await db.query<{status:string;completed_at:string|null}>("select status,completed_at from personal_tasks where id=$1",[task]);
  assert.equal(completed.rows[0].status,"completed");assert.ok(completed.rows[0].completed_at);
  await db.query("select set_personal_task_status($1,'active')",[task]);
  assert.equal((await db.query<{status:string}>("select status from personal_tasks where id=$1",[task])).rows[0].status,"active");
  await db.query("select set_personal_task_status($1,'archived')",[task]);
  assert.equal((await db.query("select * from task_notification_feed()")).rows.length,0);
  await asUser(db,null);
  await assert.rejects(db.query("select * from personal_tasks"));
  await assert.rejects(db.query("select * from task_notification_feed()"));
 }finally{await db.close();}
});
