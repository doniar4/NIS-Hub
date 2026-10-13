import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { homeworkKind, homeworkKindCopy, homeworkBody } from "../src/lib/homework-kind";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";

test("Explicit categories take precedence; legacy labels are recognized without substring false positives", () => {
  for (const body of ["сор", "СОР №2", "sor: revision", "БЖБ · тақырып"]) assert.equal(homeworkKind({ body }), "sor");
  for (const body of ["сортировка", "sorrow", "Упражнение 12"]) assert.equal(homeworkKind({ body }), "homework");
  assert.equal(homeworkKind({ body: "СОР", kind: "homework" }), "homework");
  assert.equal(homeworkBody({ body: "СОР", kind: "sor" }, "kk"), homeworkKindCopy("kk").sorDescription);
  assert.equal(homeworkBody({ body: "Chapter 4", kind: "sor" }, "en"), "Chapter 4");
  assert.equal(homeworkKind({ body: "Chapter 4", kind: "sor" }), "sor");
  for (const locale of ["ru", "kk", "en"] as const) assert.deepEqual(Object.keys(homeworkKindCopy(locale)), Object.keys(homeworkKindCopy("ru")));
});

test("Homework action saves typed SOR without manual text and rejects invalid categories/empty homework", async () => {
  const calls: Record<string, unknown>[] = [];
  const result = await build({ entryPoints: ["src/app/actions/homework.ts"], write: false, bundle: true,
    platform: "node", format: "cjs", external: ["zod"],
    plugins: [{ name: "action-boundary", setup(api) {
      api.onResolve({ filter: /^@\/lib\/(auth|people)$|^next\/cache$/ }, args => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path.endsWith("auth")
        ? 'export const actionContext=()=>globalThis.context();' : path.endsWith("people")
        ? 'export const communityError=()=>({error:"failed"});' : 'export const revalidatePath=()=>{};' }));
    } }],
  });
  const mod = { exports: {} as typeof import("../src/app/actions/homework") };
  runInNewContext(result.outputFiles[0].text, { module: mod, exports: mod.exports, require,
    context: async () => ({ supabase: { rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "save_class_homework"); calls.push(args); return { error: null };
    } } }),
  });
  const base = { id: null, subject: id(20), date: "2026-10-13", body: "" };
  assert.ok("ok" in await mod.exports.saveHomework({ ...base, kind: "sor" }));
  assert.equal(calls[0].p_kind, "sor"); assert.equal(calls[0].p_body, "СОР");
  for (const kind of ["homework", "invalid", null]) assert.ok("error" in await mod.exports.saveHomework({ ...base, kind }));
  assert.ok("error" in await mod.exports.saveHomework(base));
  assert.ok("ok" in await mod.exports.saveHomework({ ...base, body: " §4 ", kind: "homework" }));
  assert.equal(calls[1].p_kind, "homework"); assert.equal(calls[1].p_body, "§4");
  assert.ok("ok" in await mod.exports.saveHomework({ ...base, body: "Legacy client" }));
  assert.equal("p_kind" in calls[2], false, "legacy edits preserve the stored category");
  assert.equal(calls.length, 3);
});

test("SQL persists category through edits, retains legacy RPC and enforces ownership/validation", async () => {
  const db = await v051Database();
  try {
    await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}');
      insert into classes(id,name,grade) values('${id(10)}','9A',9);
      insert into subjects(id,name) values('${id(20)}','Physics');
      update profiles set class_id='${id(10)}';`);
    // Models the Telegram publisher's direct insert, which omits category.
    await db.query("insert into class_homework(class_id,subject_id,due_date,body,created_by) values($1,$2,current_date,'сор из Telegram',$3)", [id(10),id(20),id(1)]);
    assert.equal((await db.query<{kind:string}>("select kind from class_homework where body='сор из Telegram'")).rows[0].kind, "sor");
    await asUser(db, id(1));
    const work = (await db.query<{id:string}>("select save_class_homework($1,current_date,'Chapter 4',null,'sor') id", [id(20)])).rows[0].id;
    const category = async () => (await db.query<{kind:string}>("select kind from class_homework where id=$1", [work])).rows[0].kind;
    assert.equal(await category(), "sor");
    await db.query("select save_class_homework($1,current_date,'Chapter 5',$2)", [id(20), work]);
    assert.equal(await category(), "sor", "old client edit retains category");
    await db.query("select save_class_homework($1,current_date,'Exercises',$2,'homework')", [id(20), work]);
    assert.equal(await category(), "homework");
    const legacy = (await db.query<{id:string}>("select save_class_homework($1,current_date,'сор №2') id", [id(20)])).rows[0].id;
    assert.equal((await db.query<{kind:string}>("select kind from class_homework where id=$1", [legacy])).rows[0].kind, "sor");
    await assert.rejects(db.query("select save_class_homework($1,current_date,'Text',null,'soch')", [id(20)]), /invalid_input/);
    await assert.rejects(db.query("select save_class_homework($1,current_date,'',null,'sor')", [id(20)]), /invalid_input/);
    await asUser(db, id(2));
    await assert.rejects(db.query("select save_class_homework($1,current_date,'Hijack',$2,'sor')", [id(20), work]), /unavailable/);
    await asUser(db, null);
    await assert.rejects(db.query("select save_class_homework($1,current_date,'Anonymous',null,'sor')", [id(20)]));
  } finally { await db.close(); }
});
