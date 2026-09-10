import test from "node:test";
import assert from "node:assert/strict";

// Run against a local production/dev server with NO Supabase env configured.
const origin = process.env.NIS_TEST_ORIGIN ?? "http://127.0.0.1:3100";
const parsed = new URL(origin);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new Error("Smoke tests only run against localhost.");
test("unconfigured protected routes redirect to setup, never show fake authenticated content", async () => {
  for (const path of ["/profile", "/admin", "/library", "/schedule", "/books/00000000-0000-4000-8000-000000000030/read"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/setup");
  }
});
test("private file endpoint is closed without configuration, validates IDs and disables caching", async () => {
  const response = await fetch(origin + "/api/books/00000000-0000-4000-8000-000000000030/access");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await fetch(origin + "/api/books/invalid/access")).status, 404);
});
test("public pages render; auth forms are disabled; missing page is a real 404", async () => {
  for (const path of ["/", "/setup", "/privacy", "/terms", "/login", "/signup"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /NIS Hub/);
    if (["/login", "/signup"].includes(path)) assert.match(html, /<fieldset[^>]*disabled/);
  }
  assert.equal((await fetch(origin + "/nonexistent-page")).status, 404);
  const confirm = await fetch(origin + "/auth/confirm?token_hash=bad&type=email", { redirect: "manual" });
  assert.equal(new URL(confirm.headers.get("location")!, origin).pathname, "/login");
});
