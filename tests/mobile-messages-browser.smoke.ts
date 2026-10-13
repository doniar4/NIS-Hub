import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

const artifacts = process.env.NIS_BROWSER_ARTIFACTS ?? "/private/tmp/nis-mobile-messages-results";

test("mobile messages show index, conversation and back navigation", { timeout: 60_000 }, async () => {
  const bundle = await build({
    entryPoints: ["tests/browser/mobile-messages-harness.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [{
      name: "messages-fixture-boundaries",
      setup(api) {
        api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
        api.onResolve({ filter: /^@\/lib\/community-client$/ }, () => ({ path: "community", namespace: "fixture" }));
        api.onResolve({ filter: /^@\/app\/actions\/community-safety$/ }, () => ({ path: "safety", namespace: "fixture" }));
        api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents: args.path === "navigation"
            ? "export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){}});"
            : args.path === "safety"
              ? "export const safetyAction=async()=>({success:true});"
              : 'const thread={id:"00000000-0000-4000-8000-000000000080",peer_id:"00000000-0000-4000-8000-000000000002",peer_name:"Timur",last_body:"Fixture message",last_at:"2026-09-18T09:00:00Z",last_deleted:false,blocked:false,unread:0};export const loadInbox=async()=>({data:[thread]});export const startConversation=async()=>({id:thread.id});export const loadMessages=async()=>({data:[{id:"00000000-0000-4000-8000-000000000082",thread_id:thread.id,sender_id:thread.peer_id,body:"Fixture message",client_id:"fixture",created_at:thread.last_at,deleted_at:null}],more:false});export const sendMessage=async()=>({success:true});export const markConversationRead=async()=>({ok:true});',
          loader: "js",
        }));
      },
    }],
  });
  const css = readdirSync(".next/static/css")
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(".next/static/css", name), "utf8"))
    .join("\n");
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    if (path === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle.outputFiles[0].contents);
    } else if (path === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}/messages`;
  mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await expect(page.locator(".conversation-link")).toBeVisible();
      await expect(page.locator(".messages-index")).toBeVisible();
      await expect(page.locator('.mobile-bottom-nav a[aria-current="page"]')).toHaveCount(1);
      await page.locator(".conversation-link").click();
      await expect(page.locator(".messages-index")).toBeHidden();
      await expect(page.locator(".conversation-panel")).toBeVisible();
      await expect(page.locator(".conversation-back")).toBeFocused();
      await expect(page.locator(".message-history")).toContainText("Fixture message");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Messages overflow at ${width}px`);
      await page.screenshot({ path: join(artifacts, `messages-${width}.png`), animations: "disabled" });
      await page.locator(".conversation-back").click();
      await expect(page.locator(".messages-index")).toBeVisible();
      await expect(page.locator(".conversation-link")).toBeFocused();
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
    await once(server, "close");
  }
});
