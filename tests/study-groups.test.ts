import test from "node:test";
import assert from "node:assert/strict";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";

test("study groups are private to members and persist messages",async()=>{
  const db=await v051Database();
  try {
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
    assert.equal((await db.query("select * from study_group_inbox()")).rows.length,1);
    assert.equal((await db.query<{body:string}>("select * from study_group_history($1)",[group])).rows[0].body,"First message");
    await asUser(db,id(3));
    assert.equal((await db.query("select * from study_groups")).rows.length,0);
    await assert.rejects(db.query("select study_group_history($1)",[group]),/group_unavailable/);
    await assert.rejects(db.query("select send_study_group_message($1,'No access',$2)",[group,id(21)]),/group_unavailable/);
  } finally { await db.close(); }
});
