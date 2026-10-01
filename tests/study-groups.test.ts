import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";

test("study groups are private to members and persist messages",async()=>{
  const db=await v051Database();
  try {
    await db.exec(readFileSync(new URL("../supabase/migrations/202610010004_study_group_features.sql",import.meta.url),"utf8"));
    await db.exec(`
      insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
      update profiles set display_name='Owner' where id='${id(1)}';
      update profiles set display_name='Member' where id='${id(2)}';
      update profiles set display_name='Outsider' where id='${id(3)}';
    `);
    await asUser(db,id(1));
    const group=(await db.query<{id:string}>("select create_study_group('Physics club','Physics','Weekly preparation',array['Member']) id")).rows[0].id;
    assert.equal((await db.query("select * from study_group_inbox()")).rows.length,1);
    await db.query("select send_study_group_message($1,'First message',$2)",[group,id(20)]);
    await asUser(db,id(2));
    const invite=(await db.query<{id:string}>("select id from study_group_invitation_inbox()" )).rows[0];
    assert.ok(invite?.id);
    await db.query("select respond_study_group_invite($1,true)",[invite.id]);
    assert.equal((await db.query("select * from study_group_inbox()")).rows.length,1);
    assert.equal((await db.query<{body:string}>("select * from study_group_history($1)",[group])).rows[0].body,"First message");
    await assert.rejects(db.query("select delete_study_group($1)",[group]),/group_unavailable/);
    await asUser(db,id(1));
    await db.query("select set_study_group_member_role($1,$2,'admin')",[group,id(2)]);
    await asUser(db,id(2));
    await db.query("select update_study_group($1,'Physics club','Physics','Compact group',1,2,true,true)",[group]);
    const code=(await db.query<{code:string}>("select create_study_group_code($1,24,2) code",[group])).rows[0].code;
    assert.match(code,/^[A-Z2-9]{8}$/);
    await asUser(db,id(3));
    assert.equal((await db.query("select * from study_groups")).rows.length,0);
    await db.query("select join_study_group_code($1)",[code]);
    await assert.rejects(db.query("select send_study_group_message($1,'No access',$2)",[group,id(21)]),/group_unavailable/);
    await asUser(db,id(2));
    const adminMessage=(await db.query<{id:string}>("select send_study_group_message($1,'Admin note',$2) id",[group,id(22)])).rows[0].id;
    await asUser(db,id(3));
    assert.ok(Number((await db.query<{unread:number}>("select unread from study_group_inbox() where id=$1",[group])).rows[0].unread)>0);
    assert.equal((await db.query<{toggle_study_group_reaction:boolean}>("select toggle_study_group_reaction($1,0)",[adminMessage])).rows[0].toggle_study_group_reaction,true);
    assert.equal((await db.query<{body:string}>("select * from study_group_history($1,null,null,'Admin')",[group])).rows[0].body,"Admin note");
    await db.query("select read_study_group($1)",[group]);
    assert.equal(Number((await db.query<{unread:number}>("select unread from study_group_inbox() where id=$1",[group])).rows[0].unread),0);
    await asUser(db,id(2));
    await db.query("select delete_study_group_message($1)",[adminMessage]);
    assert.notEqual((await db.query<{deleted_at:string|null}>("select deleted_at from study_group_history($1) where id=$2",[group,adminMessage])).rows[0].deleted_at,null);
    await db.query("select remove_study_group_member($1,$2)",[group,id(3)]);
    await asUser(db,id(3));
    await assert.rejects(db.query("select study_group_history($1)",[group]),/group_unavailable/);
  } finally { await db.close(); }
});
