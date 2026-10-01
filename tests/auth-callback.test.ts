import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";

type RedirectResponse = { url: string; status: number; headers: Headers };
type RouteModule = { GET: (request: { nextUrl: URL }) => Promise<RedirectResponse> };

async function routeSource(path: string) {
  const fixtures: Record<string, string> = {
    "next/server": 'export const NextResponse={redirect(url,options){return {url:String(url),status:options?.status??307,headers:new Headers()}}};',
    "@/lib/supabase/server": "export async function createClient(){return globalThis.fixtureClient}",
    "@/lib/welcome-server": "export async function markWelcomeComplete(){globalThis.marked++}",
    "server-only": "export {};",
  };
  const result = await build({
    entryPoints: [resolve(path)], write: false, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "isolated-callback", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => Object.prototype.hasOwnProperty.call(fixtures, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtures[args.path], loader: "js" }));
    } }],
  });
  return result.outputFiles[0].text;
}

function loadRoute(source: string, client: unknown) {
  const mod = { exports: {} as RouteModule };
  const context = {
    module: mod, exports: mod.exports, fixtureClient: client, marked: 0,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://nis-hub-ura.vercel.app" } },
    URL, Headers,
  };
  runInNewContext(source, context);
  return { route: mod.exports.GET, context };
}

test("PKCE callback establishes a verified session then redirects only to canonical Profile", async () => {
  const source = await routeSource("src/app/auth/callback/route.ts");
  let exchanges = 0;
  const user = { id: "fixture-user" };
  const { route, context } = loadRoute(source, { auth: {
    exchangeCodeForSession: async (code: string) => {
      exchanges++;
      assert.equal(code, "test-code");
      return { data: { user, session: { access_token: "test-only" } }, error: null };
    },
    getUser: async () => ({ data: { user }, error: null }),
  } });
  const result = await route({ nextUrl: new URL("https://nis-hub-ura.vercel.app/auth/callback?code=test-code&next=https://untrusted.example") });
  assert.equal(result.url, "https://nis-hub-ura.vercel.app/profile");
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(exchanges, 1);
  assert.equal(context.marked, 1);
});

test("callback rejects expired, provider-error, mismatched-user and preview-origin requests", async () => {
  const source = await routeSource("src/app/auth/callback/route.ts");
  let exchanges = 0;
  const { route, context } = loadRoute(source, { auth: {
    exchangeCodeForSession: async () => { exchanges++; return { data: { user: { id: "one" }, session: {} }, error: null }; },
    getUser: async () => ({ data: { user: { id: "another" } }, error: null }),
  } });
  for (const url of [
    "https://nis-hub-ura.vercel.app/auth/callback?error=access_denied",
    "https://nis-hub-ura.vercel.app/auth/callback?code=",
    "https://preview-123.vercel.app/auth/callback?code=test-code",
  ]) {
    const result = await route({ nextUrl: new URL(url) });
    assert.equal(result.url, "https://nis-hub-ura.vercel.app/login?callback=failed");
  }
  assert.equal(exchanges, 0);
  const mismatch = await route({ nextUrl: new URL("https://nis-hub-ura.vercel.app/auth/callback?code=test-code") });
  assert.equal(mismatch.url, "https://nis-hub-ura.vercel.app/login?callback=failed");
  assert.equal(exchanges, 1);
  assert.equal(context.marked, 0);
});

test("legacy token-hash email confirmation still works and redirects canonically", async () => {
  const source = await routeSource("src/app/auth/confirm/route.ts");
  let verified = 0;
  const { route, context } = loadRoute(source, { auth: { verifyOtp: async (input: { type: string; token_hash: string }) => {
    verified++;
    assert.equal(input.type, "email");
    assert.equal(input.token_hash, "fixture-hash");
    return { error: null };
  } } });
  const result = await route({ nextUrl: new URL("https://nis-hub-ura.vercel.app/auth/confirm?token_hash=fixture-hash&type=email&next=https://untrusted.example") });
  assert.equal(result.url, "https://nis-hub-ura.vercel.app/profile");
  assert.equal(context.marked, 1);
  assert.equal(verified, 1);
  const invalid = await route({ nextUrl: new URL("https://nis-hub-ura.vercel.app/auth/confirm?token_hash=fixture-hash&type=recovery") });
  assert.equal(invalid.url, "https://nis-hub-ura.vercel.app/login?confirmation=failed");
  assert.equal(verified, 1);
});
