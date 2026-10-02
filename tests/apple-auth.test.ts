import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Apple OAuth is gated and uses the canonical Supabase PKCE callback", async () => {
  const fixtures: Record<string, string> = {
    "@/lib/i18n-server": 'export async function getI18n(){return {t:{authNotConfigured:"not configured",oauthError:"oauth failed"}}}',
    "@/lib/supabase/server": "export async function createClient(){return globalThis.fixtureClient}",
    "@/lib/env": 'export function getSupabaseConfig(){return {url:"https://project.supabase.co",key:"fixture-publishable"}}',
    "@/lib/validation": 'export const safeNext=()=>"/profile";export const credentialsSchema={safeParse(value){return {success:true,data:value}}};',
    "@/lib/sms/session": "export async function clearSmsSession(){}",
    "@/lib/welcome-server": "export async function markWelcomeComplete(){}",
    "next/cache": "export function revalidatePath(){}",
    "next/navigation": 'export function redirect(path){throw new Error("REDIRECT:"+path)}',
    "next/headers": 'export async function headers(){return {get(){return globalThis.fixtureHost}}}',
    "server-only": "export {};",
  };
  const built = await build({
    entryPoints: [resolve("src/app/actions/auth.ts")], write: false, bundle: true,
    platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "apple-auth-boundary", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => Object.prototype.hasOwnProperty.call(fixtures, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtures[args.path], loader: "js" }));
    } }],
  });
  const source = built.outputFiles[0].text;
  const calls: Array<{ provider: string; options: { redirectTo: string } }> = [];
  const client = { auth: { signInWithOAuth: async (input: { provider: string; options: { redirectTo: string } }) => {
    calls.push(input);
    return { data: { url: "https://project.supabase.co/auth/v1/authorize?provider=apple" }, error: null };
  } } };
  function load(flag: string, host = "nis-hub-ura.vercel.app") {
    const mod = { exports: {} as { startSocialSignIn: (provider: string, state: object, form: FormData) => Promise<{ error?: string }> } };
    runInNewContext(source, {
      module: mod, exports: mod.exports, fixtureClient: client, fixtureHost: host,
      process: { env: { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://nis-hub-ura.vercel.app", APPLE_AUTH_ENABLED: flag } },
      URL, FormData, console: { warn() {} },
    });
    return mod.exports.startSocialSignIn;
  }
  assert.equal((await load("false")("apple", {}, new FormData())).error, "not configured");
  assert.equal(calls.length, 0);
  await assert.rejects(load("true")("apple", {}, new FormData()), /REDIRECT:https:\/\/project\.supabase\.co\/auth\/v1\/authorize/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "apple");
  assert.equal(calls[0].options.redirectTo, "https://nis-hub-ura.vercel.app/auth/callback");
  await assert.rejects(load("true", "preview-123.vercel.app")("apple", {}, new FormData()), /REDIRECT:https:\/\/nis-hub-ura\.vercel\.app\/\?auth=login#welcome-auth/);
  assert.equal(calls.length, 1, "preview must not initiate OAuth with an unusable PKCE verifier cookie");
});

test("Apple control renders only when enabled, beside the email fallback", async () => {
  const result = await build({
    entryPoints: [resolve("src/components/welcome-auth.tsx")], write: false, bundle: true,
    platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
    external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "apple-button-boundary", setup(api) {
      api.onResolve({ filter: /^@\/app\/actions\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
      api.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
        contents: args.path === "auth"
          ? "export async function startSocialSignIn(){return {error:'disabled'}}"
          : 'import React from "react";export default function Link({href,children}){return React.createElement("a",{href},children)}',
        loader: "js",
      }));
    } }],
  });
  const mod = { exports: {} as { WelcomeAuth: React.ComponentType<Record<string, unknown>> } };
  runInNewContext(result.outputFiles[0].text, { module: mod, exports: mod.exports, require });
  const props = { configured: true, signupForm: React.createElement("span", null, "Email form"), loginForm: React.createElement("span", null, "Password form") };
  const hidden = renderToStaticMarkup(React.createElement(mod.exports.WelcomeAuth, props));
  assert.ok(!hidden.includes("apple-sign-in-button"));
  const shown = renderToStaticMarkup(React.createElement(mod.exports.WelcomeAuth, { ...props, appleEnabled: true }));
  assert.match(shown, /apple-sign-in-button/);
  assert.match(shown, /Продолжить с Apple/);
  assert.match(shown, /apple-sign-in-icon/);
  assert.match(shown, /или по email/);
  assert.match(shown, /Email form/);
});
