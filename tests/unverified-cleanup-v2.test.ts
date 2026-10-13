import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";

test("cleanup v2: service-role-only RPC removes stale unverified accounts and migration reruns safely", async () => {
  const db = await v051Database();
  try {
    await db.query("insert into auth.users(id,email,created_at) values($1,'stale@example.invalid',now()-interval '4 days'),($2,'fresh@example.invalid',now()-interval '1 day')", [id(1), id(2)]);
    await asUser(db, id(2));
    await assert.rejects(db.query("select public.cleanup_unverified_accounts_job()"), /permission denied/);
    await asUser(db, null);
    await assert.rejects(db.query("select public.cleanup_unverified_accounts_job()"), /permission denied/);
    await db.exec("reset role; set role service_role");
    const removed = await db.query<{ count: number }>("select public.cleanup_unverified_accounts_job() count");
    assert.equal(removed.rows[0].count, 1);
    await db.exec("reset role");
    assert.deepEqual((await db.query<{ id: string }>("select id from auth.users order by id")).rows.map(r => r.id), [id(2)]);
    // Rerunning the migration must not fail and purges any new backlog.
    await db.exec("update auth.users set created_at=now()-interval '5 days'");
    await db.exec(readFileSync(new URL("../supabase/migrations/202610090001_unverified_cleanup_v2.sql", import.meta.url), "utf8"));
    assert.equal((await db.query("select id from auth.users")).rows.length, 0);
  } finally {
    await db.close();
  }
});
