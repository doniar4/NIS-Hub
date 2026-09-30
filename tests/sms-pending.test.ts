import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createCipheriv, randomBytes } from "node:crypto";
import type { PendingSmsLogin } from "../src/lib/sms/pending";

const require = createRequire(import.meta.url);
const compiled = build({ entryPoints: ["src/lib/sms/pending.ts"], bundle: true, write: false, format: "cjs", platform: "node", plugins: [{ name: "pending-fixtures", setup(builder) {
  builder.onResolve({ filter: /^(server-only|next\/headers)$/ }, args => ({ path: args.path, namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "server-only" ? "export {};" : "export async function cookies(){return globalThis.cookieStore;}" }));
} }] });
const cookieName = "__Host-nis-sms-pending";
const uuid = "00000000-0000-4000-8000-000000000001";

async function fixture() {
  let now = Date.now();
  const key = randomBytes(32);
  const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
  let row: { id: string; user_id: string; ciphertext: string; expires_at: string } | undefined;
  const client = {
    from(table: string) {
      assert.equal(table, "sms_sessions");
      function query(remove: boolean) {
        const conditions: ((value: NonNullable<typeof row>) => boolean)[] = [];
        const chain = {
          eq(name: keyof NonNullable<typeof row>, value: string) { conditions.push(r => r[name] === value); return chain; },
          like(name: "ciphertext", pattern: string) { conditions.push(r => r[name].startsWith(pattern.slice(0, -1))); return chain; },
          gt(name: "expires_at", value: string) { conditions.push(r => r[name] > value); return chain; },
          async maybeSingle() { return { data: row && conditions.every(check => check(row!)) ? row : null, error: null }; },
          then(resolve: (value: unknown) => void) { assert.ok(remove); if (row && conditions.every(check => check(row!))) row = undefined; resolve({ error: null }); },
        };
        return chain;
      }
      return { delete: () => query(true), select: () => query(false) };
    },
    async rpc(_name: string, args: { p_ciphertext: string; p_expires: string }) { assert.match(args.p_ciphertext, /^v1\./); row = { id: uuid, user_id: "owner", ciphertext: args.p_ciphertext, expires_at: args.p_expires }; return { data: uuid, error: null }; },
  };
  const mod = { exports: {} as typeof import("../src/lib/sms/pending") };
  class Clock extends Date { static now() { return now; } }
  runInNewContext((await compiled).outputFiles[0].text, { module: mod, exports: mod.exports, require, Buffer, Date: Clock, URL,
    process: { env: { NODE_ENV: "production", SMS_DIARY_ENABLED: "true", SMS_SESSION_SECRET: key.toString("base64") } },
    cookieStore: { get: (name: string) => jar.get(name), set: (name: string, value: string, options: Record<string, unknown>) => jar.set(name, { value, options }), delete: (name: string) => jar.delete(name) },
  });
  const state: PendingSmsLogin = { version: 1, expires: now + 300000, cookies: [{ name: "session", value: "private-cookie", path: "/" }], fields: [["__RequestVerificationToken", "csrf-token"]], challenge: { captcha: true, twoFactor: false, application2FA: false }, attempts: 0, iinHash: "a".repeat(64) };
  return { api: mod.exports, client: client as unknown as Parameters<typeof mod.exports.savePendingSmsLogin>[0], state, jar, key, advance: (ms: number) => { now += ms; }, row: () => row, replaceRow: (value: NonNullable<typeof row>) => { row = value; } };
}

test("Pending SMS login is encrypted, owner-bound, isolated and hard-expiring", async () => {
  const f = await fixture();
  await f.api.savePendingSmsLogin(f.client, "owner", f.state);
  const cookie = f.jar.get(cookieName)!;
  assert.match(cookie.value, /^v1\.pending\./);
  assert.ok(!cookie.value.includes("private-cookie"));
  assert.equal(cookie.options?.httpOnly, true);
  assert.equal(cookie.options?.secure, true);
  assert.equal(cookie.options?.sameSite, "lax");
  assert.equal(cookie.options?.maxAge, 300);
  assert.equal(JSON.stringify(await f.api.readPendingSmsLogin(f.client, "owner")), JSON.stringify(f.state));
  await assert.rejects(f.api.readPendingSmsLogin(f.client, "other"), { code: "session_expired" });
  f.jar.set(cookieName, { value: cookie.value.slice(0, 35) + (cookie.value[35] === "A" ? "B" : "A") + cookie.value.slice(36) });
  await assert.rejects(f.api.readPendingSmsLogin(f.client, "owner"), { code: "session_expired" });
  f.jar.set(cookieName, cookie);
  f.advance(120000);
  await f.api.savePendingSmsLogin(f.client, "owner", { ...f.state, attempts: 1 });
  assert.equal(f.jar.get(cookieName)?.options?.maxAge, 180);
  f.advance(180000);
  await assert.rejects(f.api.readPendingSmsLogin(f.client, "owner"), { code: "session_expired" });
});

test("Pending SMS storage refuses credentials, codes and malformed encrypted state", async () => {
  const f = await fixture();
  for (const name of ["password", "login", "iin", "captchaInput", "twoFactorAuthCode", "application2FACode", "PASSWORD", "verification_code"]) {
    await assert.rejects(f.api.savePendingSmsLogin(f.client, "owner", { ...f.state, fields: [[name, "private-entered-value"]] }), { code: "session_expired" });
  }
  for (const invalid of [{ ...f.state, password: "private" }, { ...f.state, expires: f.state.expires + 1 }, { ...f.state, attempts: 6 }, { ...f.state, cookies: [null] }, { ...f.state, challenge: { captcha: "yes" } }, { ...f.state, fields: [["csrf", {}]] }, { ...f.state, iinHash: "000000000001" }, { ...f.state, codeSentAt: f.state.expires }, { ...f.state, codeSentAt: f.state.expires - 300001 }]) {
    await assert.rejects(f.api.savePendingSmsLogin(f.client, "owner", invalid as PendingSmsLogin), { code: "session_expired" });
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", f.key, iv);
    cipher.setAAD(Buffer.from("nis-sms-pending-v1:owner"));
    const data = Buffer.concat([cipher.update(JSON.stringify(invalid)), cipher.final()]);
    f.jar.set(cookieName, { value: "v1.pending." + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url") });
    await assert.rejects(f.api.readPendingSmsLogin(f.client, "owner"), { code: "session_expired" });
  }
});

test("Pending overflow cleanup is restricted to its own row and never deletes authenticated storage", async () => {
  const f = await fixture();
  const large = { ...f.state, cookies: [{ name: "session", value: "x".repeat(4000), path: "/" }] };
  await f.api.savePendingSmsLogin(f.client, "owner", large);
  assert.equal(f.jar.get(cookieName)?.value, "id." + uuid);
  assert.ok(f.row()?.ciphertext.startsWith("v1.pending."));
  assert.equal((await f.api.readPendingSmsLogin(f.client, "owner")).cookies[0].value.length, 4000);
  await assert.rejects(f.api.readPendingSmsLogin(f.client, "other"), { code: "session_expired" });
  await f.api.clearPendingSmsLogin(f.client, "other");
  assert.ok(f.row());
  f.jar.set(cookieName, { value: "id." + uuid });
  await f.api.savePendingSmsLogin(f.client, "owner", f.state);
  assert.equal(f.row(), undefined);
  await f.api.savePendingSmsLogin(f.client, "owner", large);
  f.replaceRow({ ...f.row()!, ciphertext: "v1.authenticated-session" });
  f.jar.set("__Host-nis-sms", { value: "id." + uuid });
  await f.api.clearPendingSmsLogin(f.client, "owner");
  assert.equal(f.row()?.ciphertext, "v1.authenticated-session");
  assert.ok(f.jar.has("__Host-nis-sms"));
  assert.ok(!f.jar.has(cookieName));
});
