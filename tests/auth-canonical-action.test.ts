import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import type { ActionState } from "../src/lib/action-state";

type AuthModule = {
  authenticate: (mode: "login" | "signup", state: ActionState, form: FormData) => Promise<ActionState>;
  startSocialSignIn: (provider: string, state: ActionState, form: FormData) => Promise<ActionState>;
};

async function isolatedAuth() {
  const fixtures: Record<string, string> = {
    "@/lib/i18n-server": 'export async function getI18n(){return {t:{invalidInput:"invalid",termsRequired:"terms",authNotConfigured:"not configured",tooManyAttempts:"rate limit",confirmEmail:"confirm email",loginError:"login failed",signupError:"signup failed",saveError:"save failed",checkEmail:"check email before sign-in",oauthError:"oauth failed",logoutError:"logout failed"}}}',
    "@/lib/supabase/server": "export async function createClient(){return globalThis.fixtureClient}",
    "@/lib/env": 'export function getSupabaseConfig(){return {url:"https://project.supabase.co",key:"fixture-publishable"}}',
    "@/lib/validation": 'export const credentialsSchema={safeParse(value){return {success:true,data:value}}};export const safeNext=()=>"/profile";',
    "@/lib/sms/session": "export async function clearSmsSession(){}",
    "@/lib/welcome-server": "export async function markWelcomeComplete(){globalThis.marked++}",
    "next/cache": "export function revalidatePath(){}",
    "next/navigation": 'export function redirect(path){throw new Error("REDIRECT:"+path)}',
    "next/headers": 'export async function headers(){return {get(){return globalThis.fixtureHost}}}',
    "server-only": "export {};",
  };
  const bundle = await build({
    entryPoints: [resolve("src/app/actions/auth.ts")],
    write: false,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
    plugins: [{ name: "isolated-auth-boundary", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => Object.prototype.hasOwnProperty.call(fixtures, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtures[args.path], loader: "js" }));
    } }],
  });
  return bundle.outputFiles[0].text;
}

function loadAuth(source: string, client: unknown, environment: Record<string, string>, host = "nis-hub-ura.vercel.app") {
  const mod = { exports: {} as AuthModule };
  const logs: unknown[][] = [];
  const context = {
    module: mod, exports: mod.exports, fixtureClient: client, fixtureHost: host, marked: 0,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://nis-hub-ura.vercel.app", GOOGLE_AUTH_ENABLED: "true", ...environment } },
    URL, FormData, console: { warn: (...args: unknown[]) => logs.push(args) },
  };
  runInNewContext(source, context);
  return { actions: mod.exports, context, logs };
}

function credentials() {
  const form = new FormData();
  form.set("email", "test@example.org");
  form.set("password", "safe-test-password");
  form.set("terms", "on");
  form.set("next", "https://untrusted.example");
  return form;
}

test("password signup asks Supabase to confirm on the stable callback and does not claim activation", async () => {
  const source = await isolatedAuth();
  let signupCount = 0;
  const client = { auth: { signUp: async (input: { options: { emailRedirectTo: string } }) => {
    signupCount++;
    assert.equal(input.options.emailRedirectTo, "https://nis-hub-ura.vercel.app/auth/callback");
    return { data: { user: { id: "fixture-user" }, session: null }, error: null };
  } } };
  const { actions, context } = loadAuth(source, client, {});
  const result = await actions.authenticate("signup", {}, credentials());
  assert.equal(result.success, "check email before sign-in");
  assert.equal(signupCount, 1);
  assert.equal(context.marked, 1);

  const preview = loadAuth(source, client, {}, "preview-123.vercel.app");
  await assert.rejects(preview.actions.authenticate("signup", {}, credentials()), /REDIRECT:https:\/\/nis-hub-ura\.vercel\.app\/\?auth=signup#welcome-auth/);
  assert.equal(signupCount, 1, "preview must not create a verifier cookie on the wrong origin");
});

test("Google OAuth is allowlisted, gated, and requests canonical PKCE callback", async () => {
  const source = await isolatedAuth();
  let called = 0;
  const client = { auth: { signInWithOAuth: async (input: { provider: string; options: { redirectTo: string } }) => {
    called++;
    assert.equal(input.provider, "google");
    assert.equal(input.options.redirectTo, "https://nis-hub-ura.vercel.app/auth/callback");
    return { data: { url: "https://project.supabase.co/auth/v1/authorize?provider=google" }, error: null };
  } } };
  const enabled = loadAuth(source, client, {});
  await assert.rejects(enabled.actions.startSocialSignIn("google", {}, new FormData()), /REDIRECT:https:\/\/project\.supabase\.co\/auth\/v1\/authorize/);
  assert.equal(called, 1);
  const disabled = loadAuth(source, client, { GOOGLE_AUTH_ENABLED: "false" });
  assert.equal((await disabled.actions.startSocialSignIn("google", {}, new FormData())).error, "not configured");
  assert.equal((await enabled.actions.startSocialSignIn("github", {}, new FormData())).error, "not configured");
  assert.equal(called, 1);
  const preview = loadAuth(source, client, {}, "preview-123.vercel.app");
  await assert.rejects(preview.actions.startSocialSignIn("google", {}, new FormData()), /REDIRECT:https:\/\/nis-hub-ura\.vercel\.app\/\?auth=login#welcome-auth/);
  assert.equal(called, 1);
  const unsafe = loadAuth(source, { auth: { signInWithOAuth: async () => ({ data: { url: "https://untrusted.example/callback" }, error: null }) } }, {});
  assert.equal((await unsafe.actions.startSocialSignIn("google", {}, new FormData())).error, "oauth failed");
});

test("existing password login still verifies user and ignores unsafe next redirects", async () => {
  const source = await isolatedAuth();
  const user = { id: "fixture-user" };
  const client = { auth: {
    signInWithPassword: async () => ({ data: { user, session: { access_token: "fixture-only" } }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
  } };
  const { actions, context } = loadAuth(source, client, {});
  await assert.rejects(actions.authenticate("login", {}, credentials()), /REDIRECT:\/profile/);
  assert.equal(context.marked, 1);
  const unconfirmed = loadAuth(source, { auth: { signInWithPassword: async () => ({ error: { code: "email_not_confirmed", status: 400 } }) } }, {});
  assert.equal((await unconfirmed.actions.authenticate("login", {}, credentials())).error, "confirm email");
  assert.ok(!JSON.stringify(unconfirmed.logs).includes("test@example.org"));
  assert.ok(!JSON.stringify(unconfirmed.logs).includes("safe-test-password"));
});

test("auth diagnostics allowlist provider codes and HTTP status", async () => {
  const source = await isolatedAuth();
  const secret = "fixture-secret-should-not-be-logged";
  const failure = loadAuth(source, { auth: { signInWithPassword: async () => ({
    error: { code: secret, status: secret, message: secret },
  }) } }, {});
  assert.equal((await failure.actions.authenticate("login", {}, credentials())).error, "login failed");
  const serialized = JSON.stringify(failure.logs);
  assert.ok(!serialized.includes(secret));
  assert.ok(serialized.includes("unknown"));
  assert.ok(serialized.includes("status"));
});
