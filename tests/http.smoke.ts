import test from "node:test";
import assert from "node:assert/strict";

// Default: unconfigured app. Opt in with NIS_TEST_CONFIGURED=1 for a configured,
// logged-out app. No real user credentials are used by either mode.
const configured = process.env.NIS_TEST_CONFIGURED === "1";
const request = (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
const origin = process.env.NIS_TEST_ORIGIN ?? "http://127.0.0.1:3100";
const parsed = new URL(origin);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new Error("Smoke tests only run against localhost.");
test("protected routes redirect without an authenticated session", async () => {
  for (const path of ["/profile", "/admin", "/library", "/schedule", "/books/00000000-0000-4000-8000-000000000030/read"]) {
    const response = await request(origin + path, { redirect: "manual" });
    const target = configured ? "/login" : "/setup";
    if (response.status === 307) assert.equal(new URL(response.headers.get("location")!, origin).pathname, target);
    else {
      // Next 16 streaming redirects emit a refresh meta tag after headers flush.
      assert.equal(response.status, 200, path);
      const html = await response.text();
      const redirect = html.match(/<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=([^"]+)"/);
      assert.ok(redirect, "Streaming response must redirect, not show protected content");
      assert.equal(new URL(redirect[1],origin).pathname,target);
    }
  }
});
test("private file endpoint is closed without a session, validates IDs and disables caching", async () => {
  const response = await request(origin + "/api/books/00000000-0000-4000-8000-000000000030/access");
  assert.equal(response.status, configured ? 401 : 503);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await request(origin + "/api/books/invalid/access")).status, 404);
});
test("public pages render; auth availability matches configuration; missing page is a real 404", async () => {
  for (const path of ["/", "/setup", "/privacy", "/terms", "/login", "/signup"]) {
    const response = await request(origin + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /NIS Hub/);
    if (["/login", "/signup"].includes(path)) {
      if (configured) assert.doesNotMatch(html, /<fieldset[^>]*disabled/);
      else assert.match(html, /<fieldset[^>]*disabled/);
    }
  }
  assert.equal((await request(origin + "/nonexistent-page")).status, 404);
  const confirm = await request(origin + "/auth/confirm?token_hash=bad&type=email", { redirect: "manual" });
  assert.equal(new URL(confirm.headers.get("location")!, origin).pathname, "/login");
});
