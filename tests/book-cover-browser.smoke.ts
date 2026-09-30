import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test("signed image loads, failed/missing covers fall back, no PDF request is made", { timeout: 60000 }, async () => {
  const contents = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { LocaleProvider } from "./src/components/locale-provider";',
    'import { BookCover } from "./src/components/book-cover";',
    'createRoot(document.getElementById("app")!).render(',
    '  <LocaleProvider locale="en">',
    '    <BookCover title="Real" url="/storage/v1/object/sign/book-covers/books/test.webp?token=fixture" />',
    '    <BookCover title="Missing" url="/storage/v1/object/sign/book-covers/books/missing.png?token=fixture" />',
    '    <BookCover title="No cover" url={null} />',
    '  </LocaleProvider>',
    ');',
  ].join("\n");
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), sourcefile: "cover-browser-fixture.tsx", loader: "tsx", contents },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", logLevel: "silent",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
  });
  const requests: string[] = [];
  const image = readFileSync("public/images/academic-still-life.webp");
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://local").pathname;
    requests.push(path);
    if (path === "/") { res.setHeader("Content-Type", "text/html"); res.end('<div id="app"></div><script src="/bundle.js"></script>'); return; }
    if (path === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); return; }
    if (path.endsWith("/test.webp")) { res.setHeader("Content-Type", "image/webp"); res.end(image); return; }
    res.statusCode = 404; res.end();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + (server.address() as { port: number }).port);
    const good = page.getByRole("img", { name: "Cover: Real" });
    const failed = page.getByRole("img", { name: "Cover: Missing — Cover unavailable" });
    const absent = page.getByRole("img", { name: "Cover: No cover — Cover unavailable" });
    await expect(good).toBeVisible();
    await expect(good.locator("img")).toHaveJSProperty("complete", true);
    await expect(failed).toContainText("Cover unavailable");
    await expect(absent).toContainText("Cover unavailable");
    assert.equal(await failed.locator("img").count(), 0);
    assert.equal(await absent.locator("img").count(), 0);
    assert.equal(requests.filter(path => path.includes("/book-covers/")).length, 2);
    assert.equal(requests.some(path => path.includes("/book-files/") || /^\/api\/books\//.test(path) || path.endsWith(".pdf")), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
