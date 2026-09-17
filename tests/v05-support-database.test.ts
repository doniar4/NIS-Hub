import test from "node:test";
import assert from "node:assert/strict";
import {v05Database} from "./helpers/v05-database";
import {asUser,fixtureId as id} from "./helpers/database";
test("ticket RLS and RPCs isolate owners, prevent role/status spoofing, persist replies and audit admin moderation",async()=>{
 const db=await v05Database();
 try{
 await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'),('"+id(3)+"');update public.profiles set role='admin' where id='"+id(1)+"';");
 await asUser(db,null);await assert.rejects(db.query("select public.create_support_ticket('platform','Title','Body')"));await assert.rejects(db.query("select * from public.support_tickets"));
 await asUser(db,id(2));
 const ticket=(await db.query<{id:string}>("select public.create_support_ticket('platform','Title','Private description') as id")).rows[0].id;
 assert.equal((await db.query("select * from public.support_tickets")).rows.length,1);
 await assert.rejects(db.query("select public.create_support_ticket('platform','Spam','Body')"),/rate limit/);
 await assert.rejects(db.query("update public.support_tickets set status='closed'"));
 await assert.rejects(db.query("insert into public.support_messages(ticket_id,author_role,body) values ($1,'admin','spoof')",[ticket]));
 await db.query("select public.reply_support_ticket($1,'Follow-up')",[ticket]);
 await assert.rejects(db.query("select public.reply_support_ticket($1,'Spam')",[ticket]),/rate limit/);
 await assert.rejects(db.query("select public.set_support_status($1,'closed')",[ticket]),/Admin required/);
 await asUser(db,id(3));
 assert.equal((await db.query("select * from public.support_tickets")).rows.length,0);
 assert.equal((await db.query("select * from public.support_messages")).rows.length,0);
 await assert.rejects(db.query("select public.reply_support_ticket($1,'Intrusion')",[ticket]),/unavailable/);
 await asUser(db,id(1));assert.equal((await db.query("select * from public.support_tickets")).rows.length,1);
 await db.query("select public.reply_support_ticket($1,'Admin answer')",[ticket]);
 assert.equal((await db.query<{needs_admin_reply:boolean}>("select needs_admin_reply from public.support_tickets")).rows[0].needs_admin_reply,false);
 await db.query("select public.set_support_status($1,'resolved')",[ticket]);
 await assert.rejects(db.query("select public.set_support_status($1,'invalid')",[ticket]));
 await asUser(db,id(2));await assert.rejects(db.query("select public.reply_support_ticket($1,'Closed response')",[ticket]),/unavailable/);
 assert.equal((await db.query("select * from public.support_messages")).rows.length,2);
 assert.equal((await db.query("select * from public.support_status_events")).rows.length,1);
 await asUser(db,id(3));assert.equal((await db.query("select * from public.support_status_events")).rows.length,0);
 // Deployment-owner deletion cascades canonical tickets/replies/events; not exposed in student UI.
 await db.exec("reset role");await db.query("delete from auth.users where id=$1",[id(2)]);
 assert.equal((await db.query("select * from public.support_tickets")).rows.length,0);
 assert.equal((await db.query("select * from public.support_messages")).rows.length,0);
 assert.equal((await db.query("select * from public.support_status_events")).rows.length,0);
 }finally{await db.close();}
});
