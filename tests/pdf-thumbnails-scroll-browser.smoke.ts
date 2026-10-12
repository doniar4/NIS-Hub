import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test(
  "mouse wheel scrolls the PDF thumbnail rail independently with global smooth scrolling enabled",
  { timeout: 60000 },
  async () => {
    const bundle = await build({
      entryPoints: ["tests/browser/pdf-thumbnails-scroll-harness.tsx"],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
    });
    const css = readFileSync("src/styles/workspaces.css", "utf8");
    const server = createServer((req, res) => {
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (req.url === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0"><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
        );
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const tab = await browser.newPage({
          viewport: { width: 1280, height: 900 },
        }),
        errors: string[] = [];
      tab.on("pageerror", (e) => errors.push(e.message));
      await tab.goto(`http://127.0.0.1:${addr.port}`);
      await expect(tab.locator("html")).toHaveClass(/lenis/);
      const rail = tab.locator(".pdf-thumbnails"),
        viewport = tab.locator(".pdf-scroll-viewport");
      await expect(rail.locator('[aria-current="page"]')).toHaveText("34");
      const initial = await rail.evaluate((el) => el.scrollTop);
      assert.ok(initial > 0);
      await rail.hover();
      await tab.mouse.wheel(0, 500);
      await expect
        .poll(() => rail.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(initial + 100);
      assert.equal(await viewport.evaluate((el) => el.scrollTop), 0);
      assert.equal(await tab.evaluate(() => scrollY), 0);
      const down = await rail.evaluate((el) => el.scrollTop);
      await tab.mouse.wheel(0, -300);
      await expect
        .poll(() => rail.evaluate((el) => el.scrollTop))
        .toBeLessThan(down - 100);
      // The rail must keep native keyboard scrolling as well.
      await rail.focus();
      const beforeKey = await rail.evaluate((el) => el.scrollTop);
      await tab.keyboard.press("PageDown");
      await expect
        .poll(() => rail.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(beforeKey);
      await rail.evaluate((el) => {
        el.scrollTop = 0;
      });
      await rail
        .getByRole("button", { name: "Страница 2", exact: true })
        .click();
      await expect(tab.locator("#selected-page")).toHaveText("2");
      await rail.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await rail.hover();
      await tab.mouse.wheel(0, 800);
      assert.equal(
        await tab.evaluate(() => scrollY),
        0,
        "rail boundary does not scroll the document",
      );
      await viewport.hover();
      await tab.mouse.wheel(0, 400);
      await expect
        .poll(() => viewport.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(100);
      // Native nested scrolling remains available when reduced motion disables Lenis.
      await tab.emulateMedia({ reducedMotion: "reduce" });
      await tab.reload();
      await expect(rail).toBeVisible();
      await rail.hover();
      const reducedInitial = await rail.evaluate((el) => el.scrollTop);
      await tab.mouse.wheel(0, 350);
      await expect
        .poll(() => rail.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(reducedInitial);
      mkdirSync("test-results/pdf-thumbnails", { recursive: true });
      await tab.screenshot({ path: "test-results/pdf-thumbnails/scroll.png" });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
