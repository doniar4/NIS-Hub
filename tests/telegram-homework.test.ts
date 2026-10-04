import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import type { TelegramHomeworkSession } from "../src/lib/database.types";
import type { TelegramConfig } from "../src/lib/telegram/security";
import type { HomeworkStore, Incoming, Reply } from "../src/lib/telegram/types";

const userId = 123456789;
const environment = {
  TELEGRAM_BOT_TOKEN: "123456789:fixture_token_not_a_real_secret",
  TELEGRAM_WEBHOOK_SECRET: "fixture_webhook_secret_not_real_12345",
  TELEGRAM_ADMIN_IDS: String(userId), TELEGRAM_HOMEWORK_AUTHOR_ID: id(1),
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_not_real_1234567890",
  NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
};
async function bundle<T>(entry: string, fixtures: Record<string, string> = {}, globals: Record<string, unknown> = {}): Promise<T> {
  const sources = { "server-only": "export {};", ...fixtures };
  const built = await build({ entryPoints: [resolve(entry)], write: false, bundle: true, platform: "node", format: "cjs", logLevel: "silent", external: ["zod"],
    plugins: [{ name: "telegram-test-boundary", setup(api) {
      api.onResolve({ filter: /.*/ }, args => Object.prototype.hasOwnProperty.call(sources, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: sources[args.path as keyof typeof sources], loader: "js" }));
    } }],
  });
  const mod = { exports: {} };
  runInNewContext(built.outputFiles[0].text, { module: mod, exports: mod.exports, require, Buffer, URL, Response, Request, ReadableStream,
    AbortSignal, setTimeout, clearTimeout, process: { env: environment }, console: { warn() {} }, ...globals });
  return mod.exports as T;
}
const incoming = (updateId: number, text: string): Incoming => ({ updateId, userId, chatId: userId, privateChat: true, text });

test("Telegram configuration fails closed, never accepts public keys and supports service-role/secret keys", async () => {
  const { readTelegramConfig } = await bundle<typeof import("../src/lib/telegram/security")>("src/lib/telegram/security.ts");
  assert.ok(readTelegramConfig(environment));
  for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_ADMIN_IDS", "TELEGRAM_HOMEWORK_AUTHOR_ID", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"]) {
    assert.equal(readTelegramConfig({ ...environment, [key]: "" }), null, key);
  }
  for (const ids of ["name", "0", "-1", "1,,2", "9007199254740992", "1.5"]) assert.equal(readTelegramConfig({ ...environment, TELEGRAM_ADMIN_IDS: ids }), null);
  for (const key of ["public", "sb_publishable_fixture_not_real", `x.${Buffer.from('{"role":"anon"}').toString("base64url")}.x`]) {
    assert.equal(readTelegramConfig({ ...environment, SUPABASE_SERVICE_ROLE_KEY: key }), null);
  }
  assert.ok(readTelegramConfig({ ...environment, SUPABASE_SERVICE_ROLE_KEY: `x.${Buffer.from('{"role":"service_role"}').toString("base64url")}.x` }));
  assert.equal(readTelegramConfig({ ...environment, NEXT_PUBLIC_SUPABASE_URL: "https://user:password@fixture.supabase.co" }), null);
  assert.equal(readTelegramConfig({ ...environment, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co/path" }), null);
});

test("Telegram webhook secret rejects missing/invalid values and request bodies are bounded and time-limited", async () => {
  const { validWebhookSecret, readBoundedJson } = await bundle<typeof import("../src/lib/telegram/security")>("src/lib/telegram/security.ts");
  assert.equal(validWebhookSecret(environment.TELEGRAM_WEBHOOK_SECRET, environment.TELEGRAM_WEBHOOK_SECRET), true);
  for (const value of [null, "wrong", "", "x".repeat(257)]) assert.equal(validWebhookSecret(value, environment.TELEGRAM_WEBHOOK_SECRET), false);
  await assert.rejects(readBoundedJson(new Response("x".repeat(33)).body, 32));
  await assert.rejects(readBoundedJson(new Response("not json").body, 32));
  const stalled = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{}")); } });
  await assert.rejects(readBoundedJson(stalled, 32, 5), /payload_timeout/);
});

test("Telegram callback parsing rejects forged grades/IDs/dates, extra fields and oversized data", async () => {
  const { parseAction, parseUpdate } = await bundle<typeof import("../src/lib/telegram/types")>("src/lib/telegram/types.ts");
  const token = "123456abcdef";
  const c = (data: string) => parseAction({ ...incoming(1, ""), callbackId: "callback", data });
  for (const data of ["grade:6:" + token, "grade:13:" + token, "grade:9:short", "class:fake:" + token, "subject:fake:" + token,
    "date:2026-10-06:" + token, "confirm:delete:" + token, "grade:9:" + token + ":extra", "x".repeat(65)]) assert.equal(c(data), null, data);
  assert.equal(c("subject:" + id(20) + ":" + token)?.value, id(20));
  assert.equal(parseAction(incoming(1, "/addhomework@NisFixtureBot"))?.action, "add");
  assert.equal(parseAction(incoming(1, "📚 Добавить ДЗ"))?.action, "add");
  assert.equal(parseAction(incoming(1, "/start"))?.action, "start");
  assert.equal(parseAction(incoming(1, "/cancel"))?.action, "cancel");
  const parsed = parseUpdate({ update_id: 1, message: { from: { id: userId, first_name: "Discard me" }, chat: { id: userId, type: "private" }, text: "/start", ignored: "private" } });
  assert.ok(parsed?.privateChat);
  assert.ok(!JSON.stringify(parsed).includes("Discard me"));
  assert.equal(parseUpdate({ update_id: 2, edited_message: {} }), null);
  assert.throws(() => parseUpdate({ update_id: -1 }));
});

test("Oral Today/Tomorrow/Day-after use local date across UTC midnight, month and year boundaries", async () => {
  const { oralDate } = await bundle<typeof import("../src/lib/telegram/homework")>("src/lib/telegram/homework.ts");
  const now = new Date("2026-10-05T19:01:00Z"); // Already 6 October in Oral (UTC+5).
  assert.equal(oralDate(0, now), "2026-10-06");
  assert.equal(oralDate(1, now), "2026-10-07");
  assert.equal(oralDate(2, now), "2026-10-08");
  assert.equal(oralDate(2, new Date("2026-12-30T20:00:00Z")), "2027-01-02");
});

test("Actual webhook rejects invalid secret/config/payload, accepts /start, and checks admin on every command/callback", async () => {
  const replies: Reply[] = [], calls: string[] = [], events: string[] = [], logs: unknown[] = [];
  const store = { apply: async (_input: Incoming, action: { action: string }) => { calls.push(action.action); events.push("database"); return "welcome"; } };
  const api = { send: async (_id: number, reply: Reply) => { replies.push(reply); return true; }, answer: async () => { events.push("answer"); return true; } };
  async function load(env: Record<string, string> = environment) {
    return bundle<typeof import("../src/app/api/telegram/webhook/route")>("src/app/api/telegram/webhook/route.ts", {
      "@/lib/telegram/database": "export function homeworkStore(){return globalThis.fixtureStore}",
      "@/lib/telegram/api": "export function telegramApi(){return globalThis.fixtureApi}",
    }, { fixtureStore: store, fixtureApi: api, process: { env }, console: { warn: (...args: unknown[]) => logs.push(args) } });
  }
  const route = await load();
  const request = (body: unknown, secret = environment.TELEGRAM_WEBHOOK_SECRET) => new Request("https://nis-hub-ura.vercel.app/api/telegram/webhook", {
    method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": secret }, body: JSON.stringify(body),
  });
  assert.equal((await route.POST(request({}, "wrong"))).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await route.POST(request({ update_id: -1 }))).status, 400);
  const message = (text: string, from = userId) => ({ update_id: 1, message: { from: { id: from }, chat: { id: from, type: "private" }, text } });
  assert.equal((await route.POST(request(message("/start")))).status, 200);
  assert.deepEqual(calls, ["start"]);
  assert.match(JSON.stringify(replies.at(-1)), /📚 Добавить ДЗ/);
  for (const text of ["/start", "/addhomework", "/cancel", "new text"]) {
    assert.equal((await route.POST(request(message(text, userId + 1)))).status, 200);
    assert.equal(replies.at(-1)?.text, "⛔ У вас нет доступа.");
  }
  for (const data of ["grade:9", "class:" + id(10), "subject:" + id(20), "date:today", "confirm:publish", "confirm:edit", "confirm:cancel"]) {
    const payload = { update_id: 2, callback_query: { id: "cb", from: { id: userId + 1 }, message: { chat: { id: userId + 1, type: "private" } }, data: data + ":123456abcdef" } };
    events.length = 0;
    assert.equal((await route.POST(request(payload))).status, 200);
    assert.equal(events[0], "answer");
    assert.equal(replies.at(-1)?.text, "⛔ У вас нет доступа.");
  }
  assert.deepEqual(calls, ["start"], "non-admin cannot continue a pre-existing session");
  const group = message("/addhomework"); group.message.chat = { id: -1, type: "group" };
  await route.POST(request(group)); assert.deepEqual(calls, ["start"]);
  assert.equal((await (await load({ ...environment, SUPABASE_SERVICE_ROLE_KEY: "" })).POST(request(message("/start")))).status, 503);
  assert.match(JSON.stringify(logs), /missing_or_invalid/);
  for (const secret of [environment.TELEGRAM_BOT_TOKEN, environment.TELEGRAM_WEBHOOK_SECRET, environment.SUPABASE_SERVICE_ROLE_KEY]) assert.ok(!JSON.stringify(logs).includes(secret));
});

test("Actual migration + bot flow publish into existing homework exactly once, preserve RLS, and validate every selection", async () => {
  const db = await v051Database();
  try {
    await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into classes(id,name,grade,section) values('${id(10)}','9H',9,'H'),('${id(11)}','8A',8,'A'),('${id(12)}','9A',9,'A');
      insert into subjects(id,name,name_ru) values('${id(20)}','Math','Математика'),('${id(21)}','Physics',null),('${id(22)}','Wrong class','Другой класс');
      insert into weekly_schedule(class_id,subject_id,weekday,lesson_start,lesson_end) values
        ('${id(10)}','${id(20)}',1,1,1),('${id(10)}','${id(20)}',2,1,1),('${id(10)}','${id(21)}',1,2,2),('${id(11)}','${id(22)}',1,1,1);
      update profiles set class_id='${id(10)}' where id='${id(2)}';
      update profiles set class_id='${id(11)}' where id='${id(3)}';
      grant usage on schema public to service_role;
      grant all on public.classes,public.subjects,public.weekly_schedule,public.profiles,public.class_homework to service_role;`);
    const homework = await bundle<typeof import("../src/lib/telegram/homework")>("src/lib/telegram/homework.ts");
    const config: TelegramConfig = { token: "fixture", secret: "fixture", admins: new Set([userId]), authorId: id(1), supabaseUrl: "https://fixture.supabase.co", serviceKey: "fixture" };
    await db.exec("set role service_role");
    const store: HomeworkStore = {
      apply: async (input, action) => (await db.query<{ outcome: string }>("select telegram_homework_apply_update($1,$2,$3,$4,$5,$6) outcome", [input.updateId, input.userId, action.action, action.value, action.token, config.authorId])).rows[0].outcome,
      session: async (uid) => (await db.query<TelegramHomeworkSession>(`select telegram_user_id::float8 telegram_user_id,step,grade,class_id,subject_id,due_date::text due_date,body,token,last_update_id::float8 last_update_id,updated_at::text updated_at,expires_at::text expires_at from telegram_homework_sessions where telegram_user_id=$1`, [uid])).rows[0] ?? null,
      classes: async grade => (await db.query<{ id: string; name: string; grade: number; section: string | null }>("select id,name,grade,section from classes where grade=$1 order by grade,section,name", [grade])).rows,
      subjects: async cid => (await db.query<{ id: string; name: string; name_ru: string | null }>("select distinct s.id,s.name,s.name_ru from weekly_schedule w join subjects s on s.id=w.subject_id where w.class_id=$1 order by s.name_ru,s.name", [cid])).rows,
    };
    const replies: Reply[] = [], events: string[] = [];
    const api = { answer: async () => { events.push("answer"); return true; }, send: async (_cid: number, reply: Reply) => { replies.push(reply); return true; } };
    let n = 10;
    const send = (text: string) => homework.handleHomework(incoming(n++, text), config, store, api);
    const callback = async (action: string, value: string, token?: string, updateId?: number) => {
      const s = await store.session(userId);
      return homework.handleHomework({ ...incoming(updateId ?? n++, ""), callbackId: "cb", data: `${action}:${value}:${token ?? s?.token}` }, config, store, api);
    };
    await send("/start"); assert.match(JSON.stringify(replies.at(-1)), /📚 Добавить ДЗ/);
    await send("/addhomework"); assert.equal((await store.session(userId))?.step, "grade");
    for (const grade of [7, 8, 9, 10, 11, 12]) assert.match(JSON.stringify(replies.at(-1)), new RegExp(`grade:${grade}:`));
    await callback("grade", "6"); assert.equal((await store.session(userId))?.step, "grade");
    await callback("grade", "9"); assert.equal((await store.session(userId))?.grade, 9);
    const classesReply = JSON.stringify(replies.at(-1)); assert.match(classesReply, /9H/); assert.match(classesReply, /9A/); assert.ok(!classesReply.includes("8A"));
    await callback("class", id(11)); assert.equal((await store.session(userId))?.step, "class");
    await callback("class", id(10)); assert.equal((await store.session(userId))?.class_id, id(10));
    const subjectsReply = JSON.stringify(replies.at(-1)); assert.match(subjectsReply, /Математика/); assert.match(subjectsReply, /Physics/); assert.ok(!subjectsReply.includes("Другой класс"));
    assert.equal(subjectsReply.split("subject:" + id(20)).length - 1, 1, "distinct schedule subjects only");
    await callback("subject", id(22)); assert.equal((await store.session(userId))?.step, "subject");
    await callback("subject", id(20)); assert.equal((await store.session(userId))?.subject_id, id(20));
    assert.equal((await store.session(userId))?.step, "date");
    await callback("date", "today"); assert.equal((await store.session(userId))?.due_date, homework.oralDate(0));
    await send("   "); assert.equal((await store.session(userId))?.step, "body"); assert.match(replies.at(-1)?.text ?? "", /1 до 1000/);
    await send("x".repeat(1001)); assert.equal((await store.session(userId))?.step, "body");
    await send("  2.31; 2.32; 2.37-2.39  ");
    assert.equal((await store.session(userId))?.body, "2.31; 2.32; 2.37-2.39");
    assert.match(replies.at(-1)?.text ?? "", /Класс: 9H\nПредмет: Математика\nДата:/);
    assert.match(replies.at(-1)?.text ?? "", /ДЗ:\n2.31/);
    assert.equal((await db.query("select * from class_homework")).rows.length, 0, "no insert before publish");
    const oldToken = (await store.session(userId))!.token;
    await callback("confirm", "edit");
    const edited = (await store.session(userId))!; assert.equal(edited.step, "body"); assert.equal(edited.body, null);
    assert.equal(edited.class_id, id(10)); assert.equal(edited.subject_id, id(20)); assert.equal(edited.due_date, homework.oralDate(0));
    await send("<b>Literal plain text</b>");
    await callback("confirm", "publish", oldToken); assert.equal((await db.query("select * from class_homework")).rows.length, 0, "old confirm buttons invalidated");
    const publishToken = (await store.session(userId))!.token, publishId = n++;
    // A failed DB insertion must roll back its update claim, not poison retries.
    await db.exec("reset role; revoke insert on class_homework from service_role; set role service_role");
    assert.equal(await callback("confirm", "publish", publishToken, publishId), "retry");
    assert.equal((await db.query("select * from telegram_homework_updates where update_id=$1", [publishId])).rows.length, 0);
    assert.equal((await store.session(userId))?.step, "confirm");
    await db.exec("reset role; grant insert on class_homework to service_role; set role service_role");
    await callback("confirm", "publish", publishToken, publishId);
    const rows = (await db.query<{ class_id: string; subject_id: string; body: string; created_by: string; moderation_status: string; created_at: unknown; updated_at: unknown }>("select * from class_homework")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].class_id, id(10)); assert.equal(rows[0].subject_id, id(20)); assert.equal(rows[0].created_by, id(1));
    assert.equal(rows[0].moderation_status, "visible"); assert.ok(rows[0].created_at); assert.ok(rows[0].updated_at);
    assert.equal(rows[0].body, "<b>Literal plain text</b>"); assert.equal(await store.session(userId), null);
    assert.equal(replies.at(-1)?.text, "✅ Домашнее задание добавлено в NIS Hub.");
    await callback("confirm", "publish", publishToken, publishId); // Telegram retry.
    await callback("confirm", "publish", publishToken); // Double click with another update ID.
    assert.equal((await db.query("select * from class_homework")).rows.length, 1);
    for (const [choice, offset] of [["tomorrow", 1], ["dayafter", 2]] as const) {
      await send("📚 Добавить ДЗ"); await callback("grade", "9"); await callback("class", id(10)); await callback("subject", id(20)); await callback("date", choice);
      assert.equal((await store.session(userId))?.due_date, homework.oralDate(offset));
      await callback("confirm", "cancel"); assert.equal(await store.session(userId), null); assert.equal(replies.at(-1)?.text, "❌ Добавление ДЗ отменено.");
    }
    await send("/addhomework"); await send("/cancel"); assert.equal(await store.session(userId), null);
    await send("/addhomework");
    const untouched = (await store.session(userId))!.token;
    config.admins = new Set();
    await send("/cancel"); await callback("grade", "9"); await send("non-admin body");
    assert.equal((await store.session(userId))?.token, untouched, "removed admin cannot mutate even their existing session");
    config.admins = new Set([userId]);
    await send("/addhomework"); await callback("grade", "9"); await callback("class", id(10)); await callback("subject", id(20)); await callback("date", "today"); await send("Future check");
    config.authorId = id(999); await callback("confirm", "publish"); assert.equal((await db.query("select * from class_homework")).rows.length, 1, "author must exist");
    config.authorId = id(1);
    await db.query("delete from weekly_schedule where class_id=$1 and subject_id=$2", [id(10), id(20)]);
    await callback("confirm", "publish"); assert.equal((await db.query("select * from class_homework")).rows.length, 1, "membership rechecked at publication");
    await db.query("update telegram_homework_sessions set expires_at=now()-interval '1 second' where telegram_user_id=$1", [userId]);
    await send("new body"); assert.equal(await store.session(userId), null); assert.equal(replies.at(-1)?.text, homework.expiredMessage);
    assert.ok(events.includes("answer"));
    await asUser(db, id(2)); assert.equal((await db.query("select * from class_homework")).rows.length, 1, "website own-class query sees Telegram row");
    for (const table of ["telegram_homework_sessions", "telegram_homework_updates"]) {
      for (const command of [`select * from ${table}`, `delete from ${table}`, `update ${table} set telegram_user_id=1`]) await assert.rejects(db.query(command), /permission denied/);
    }
    await assert.rejects(db.query("select telegram_homework_apply_update(999,123,'start',null,null,$1)", [id(1)]), /permission denied/);
    await assert.rejects(db.query("insert into class_homework(class_id,subject_id,due_date,body,created_by) values($1,$2,current_date,'Bypass',$3)", [id(10), id(20), id(2)]));
    await asUser(db, id(3)); assert.equal((await db.query("select * from class_homework")).rows.length, 0, "other class remains private");
    await asUser(db, null); await assert.rejects(db.query("select * from telegram_homework_sessions"));
    await assert.rejects(db.query("select telegram_homework_apply_update(998,123,'start',null,null,$1)", [id(1)]));
    await db.exec("reset role");
    const currentRpc = (await db.query<{ definition: string }>("select pg_get_functiondef(oid) definition from pg_proc where proname='save_class_homework'")).rows[0].definition;
    assert.match(currentRpc, /auth.uid\(\)/); assert.match(currentRpc, /authentication_required/);
    assert.ok(!currentRpc.includes("telegram"), "existing website RPC unchanged");
  } finally { await db.close(); }
});

test("Telegram failures never expose raw Supabase exceptions; delivery retry is explicit", async () => {
  const logs: unknown[] = [], replies: Reply[] = [];
  const { handleHomework } = await bundle<typeof import("../src/lib/telegram/homework")>("src/lib/telegram/homework.ts", {}, { console: { warn: (...args: unknown[]) => logs.push(args) } });
  const config = { ...environment, admins: new Set([userId]) } as unknown as TelegramConfig;
  const store = { apply: async () => { throw new Error("private_token DATABASE_PASSWORD raw Telegram payload"); } } as unknown as HomeworkStore;
  const api = { answer: async () => true, send: async (_id: number, reply: Reply) => { replies.push(reply); return true; } };
  assert.equal(await handleHomework(incoming(1, "/start"), config, store, api), "retry");
  assert.equal(replies[0].text, "⚠️ Не удалось добавить ДЗ. Попробуйте ещё раз.");
  assert.ok(!JSON.stringify([logs, replies]).includes("private_token"));
  assert.equal(await handleHomework(incoming(1, "/start"), config, { apply: async () => "welcome" } as unknown as HomeworkStore, { ...api, send: async () => false }), "retry");
});

test("Bot API uses bounded no-store direct fetch, answers callbacks and never enables formatting for homework", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const { telegramApi } = await bundle<typeof import("../src/lib/telegram/api")>("src/lib/telegram/api.ts", {}, {
    fetch: async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({ ok: true }); },
  });
  const api = telegramApi(environment.TELEGRAM_BOT_TOKEN);
  assert.equal(await api.answer("callback"), true);
  assert.equal(await api.send(userId, { text: "<script>Literal & _body_</script>" }), true);
  assert.ok(calls[0].url.endsWith("/answerCallbackQuery")); assert.ok(calls[1].url.endsWith("/sendMessage"));
  assert.equal(calls[1].init.cache, "no-store"); assert.equal(calls[1].init.redirect, "error");
  const payload = JSON.parse(String(calls[1].init.body)); assert.equal(payload.parse_mode, undefined); assert.match(payload.text, /<script>/);
});

test("Actual Supabase adapter restricts queries by selected grade/class, deduplicates pages and disables browser sessions", async () => {
  const queries: { table: string; select?: string; filters: [string, unknown][]; orders: string[]; range?: number[]; limit?: number }[] = [];
  const calls: { url: string; init: RequestInit }[] = [];
  let clientOptions: Record<string, unknown> = {};
  let seenUrl = "", seenKey = "";
  const client = { from(table: string) {
    const query = { table, filters: [] as [string, unknown][], orders: [] as string[], select: undefined as string | undefined, range: undefined as number[] | undefined, limit: undefined as number | undefined };
    queries.push(query);
    const chain = {
      select(value: string) { query.select = value; return chain; },
      eq(key: string, value: unknown) { query.filters.push([key, value]); return chain; },
      order(value: string) { query.orders.push(value); return chain; },
      range(a: number, b: number) { query.range = [a, b]; return chain; },
      limit(value: number) { query.limit = value; return chain; },
      then(resolveResult: (result: object) => void) {
        if (table === "classes") resolveResult({ data: [{ id: id(10), name: "9H", grade: 9, section: "H" }], error: null });
        else resolveResult({ data: query.range?.[0] === 0 ? Array.from({ length: 200 }, () => ({ subject: { id: id(20), name: "Math", name_ru: "Математика" } })) : [{ subject: { id: id(21), name: "Physics", name_ru: null } }], error: null });
      },
    };
    return chain;
  } };
  const { homeworkStore } = await bundle<typeof import("../src/lib/telegram/database")>("src/lib/telegram/database.ts", {
    "@supabase/supabase-js": "export function createClient(url,key,options){return globalThis.fixtureClient(url,key,options)}",
  }, {
    fixtureClient: (url: string, key: string, options: Record<string, unknown>) => { seenUrl = url; seenKey = key; clientOptions = options; return client; },
    fetch: async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({}); },
  });
  const config = { ...environment, supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL, serviceKey: environment.SUPABASE_SERVICE_ROLE_KEY } as unknown as TelegramConfig;
  const store = homeworkStore(config);
  assert.equal(seenUrl, environment.NEXT_PUBLIC_SUPABASE_URL); assert.equal(seenKey, environment.SUPABASE_SERVICE_ROLE_KEY);
  assert.deepEqual(JSON.parse(JSON.stringify(clientOptions.auth)), { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  assert.equal((await store.classes(9))[0].id, id(10));
  assert.deepEqual(queries[0].filters, [["grade", 9]]); assert.deepEqual(queries[0].orders, ["grade", "section", "name"]);
  const subjects = await store.subjects(id(10)); assert.equal(subjects.length, 2);
  for (const query of queries.slice(1)) { assert.equal(query.table, "weekly_schedule"); assert.deepEqual(query.filters, [["class_id", id(10)]]); assert.match(query.select ?? "", /subjects!inner/); }
  assert.deepEqual(queries[1].range, [0, 199]); assert.deepEqual(queries[2].range, [200, 399]);
  assert.ok(!queries.some(query => query.table === "subjects"), "never load the global subject catalog");
  const customFetch = (clientOptions.global as { fetch(url: string, init: RequestInit): Promise<Response> }).fetch;
  await customFetch("https://fixture.supabase.co/rest/v1/classes", {});
  assert.equal(calls[0].init.cache, "no-store"); assert.equal(calls[0].init.redirect, "error"); assert.ok(calls[0].init.signal);
});

test("Proxy bypasses browser auth only for the secret-protected bot route, not for ordinary app routes", async () => {
  let authCalls = 0;
  const { proxy } = await bundle<typeof import("../src/proxy")>("src/proxy.ts", {
    "@supabase/ssr": "export function createServerClient(){return {auth:{getUser:async()=>globalThis.fixtureAuth()}}}",
    "@/lib/env": "export function getSupabaseConfig(){return {url:'https://fixture.supabase.co',key:'fixture'}}",
    "next/server": "export const NextResponse={next(){return {headers:new Headers()}}}",
  }, { Headers, fixtureAuth: () => { authCalls++; } });
  await proxy({ nextUrl: { pathname: "/api/telegram/webhook" } } as Parameters<typeof proxy>[0]); assert.equal(authCalls, 0);
  await proxy({ nextUrl: { pathname: "/profile" } } as Parameters<typeof proxy>[0]); assert.equal(authCalls, 1);
  await proxy({ nextUrl: { pathname: "/api/telegram/webhook-other" } } as Parameters<typeof proxy>[0]); assert.equal(authCalls, 2);
});

test("Integration leaves auth/homework policy boundaries intact and uses no process-memory session state", () => {
  const migration = readFileSync("supabase/migrations/20261004105537_telegram_homework_publishing.sql", "utf8");
  assert.match(migration, /security invoker/i); assert.match(migration, /enable row level security/); assert.match(migration, /from public, anon, authenticated/);
  assert.ok(!/alter table public\.class_homework/i.test(migration)); assert.ok(!/create (?:or replace )?function public\.save_class_homework/.test(migration));
  assert.match(readFileSync("src/lib/telegram/database.ts", "utf8"), /import "server-only"/);
  assert.match(readFileSync("src/proxy.ts", "utf8"), /pathname === "\/api\/telegram\/webhook"/);
});
