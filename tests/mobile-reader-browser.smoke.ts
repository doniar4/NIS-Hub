import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { build } from "esbuild";
import { chromium, webkit, expect } from "@playwright/test";

const fixturePdf = process.env.NIS_READER_TEST_PDF;
const artifacts = process.env.NIS_BROWSER_ARTIFACTS ?? "/private/tmp/nis-mobile-reader-results";
const bookId = "00000000-0000-4000-8000-000000000030";

test("mobile Reader renders real test PDF in Chromium and WebKit", { skip: !fixturePdf, timeout: 180_000 }, async (t) => {
  const pdf = readFileSync(fixturePdf!);
  const bundle = await build({
    entryPoints: ["tests/browser/mobile-reader-harness.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [{
      name: "reading-fixture-boundary",
      setup(api) {
        api.onResolve({ filter: /^@\/app\/actions\/reading$/ }, () => ({ path: "reading", namespace: "fixture" }));
        api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'export async function saveReading(bookId,page,mode){const result=await fetch("/fixture/reading",{method:"POST",body:JSON.stringify({page,mode})});return result.json();}',
          loader: "js",
        }));
      },
    }],
  });
  const css = readdirSync(".next/static/css")
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(".next/static/css", name), "utf8"))
    .join("\n");
  const saves: { page: number; mode: string }[] = [];
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://fixture.local").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle.outputFiles[0].contents);
    } else if (pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else if (pathname === "/fixture.pdf") {
      response.setHeader("Content-Type", "application/pdf");
      response.end(pdf);
    } else if (pathname === `/api/books/${bookId}/access`) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ url: "/fixture.pdf", expiresIn: 60 }));
    } else if (pathname === "/fixture/reading") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      saves.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ success: "Saved" }));
    } else if (pathname === "/pdfjs-dist/legacy/build/pdf.worker.min.mjs") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"));
    } else if (/^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/[a-zA-Z0-9_.-]+$/.test(pathname)) {
      response.end(readFileSync("public" + pathname));
    } else if (pathname.endsWith(".woff2")) {
      try { response.end(readFileSync(join(".next/static/media", basename(pathname)))); }
      catch { response.statusCode = 404; response.end(); }
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  mkdirSync(artifacts, { recursive: true });
  try {
    for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]] as const) {
      await t.test(name, async () => {
        const browser = await engine.launch({ headless: true });
        try {
          for (const width of [320, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 844 } });
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(origin);
            await expect(page.locator(".reader-controls")).toContainText("1 / 3", { timeout: 15_000 });
            await expect(page.locator(".pdf-scroll-viewport canvas").first()).toBeVisible({ timeout: 15_000 });
            const size = await page.locator(".pdf-scroll-viewport canvas").first().evaluate((canvas) => ({ width: (canvas as HTMLCanvasElement).width, height: (canvas as HTMLCanvasElement).height }));
            assert.ok(size.width > 100 && size.height > 100);
            const progressSaved = page.waitForResponse((response) => response.url().endsWith("/fixture/reading"));
            await page.getByRole("button", { name: "Далее" }).click();
            await expect(page.locator(".reader-controls")).toContainText("2 / 3");
            await progressSaved;
            await page.getByRole("button", { name: "Назад" }).click();
            await expect(page.locator(".reader-controls")).toContainText("1 / 3");
            await page.getByRole("button", { name: "Увеличить" }).click();
            await expect(page.locator(".reader-controls")).toContainText("125%");
            await page.getByRole("button", { name: "Страница целиком" }).click();
            await page.locator(".reader-controls input[type=number]").fill("3");
            await page.getByRole("button", { name: "Перейти" }).click();
            await expect(page.locator(".reader-controls")).toContainText("3 / 3");
            await page.locator(".pdf-reader > details summary").click();
            await expect(page.locator(".pdf-reader > details")).toContainText("NIS Hub Reader Test");
            const bookmarkSaved = page.waitForResponse((response) => response.url().endsWith("/fixture/reading"));
            await page.locator(".bookmark-action").click();
            await bookmarkSaved;
            await expect(page.locator(".bookmark-action")).toHaveAttribute("aria-pressed", "true");
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} Reader overflow at ${width}px`);
            assert.deepEqual(errors, []);
            await page.screenshot({ path: join(artifacts, `${name}-${width}.png`), animations: "disabled" });
            await page.close();
          }
        } finally { await browser.close(); }
      });
    }
    assert.ok(saves.some((entry) => entry.mode === "progress"), "Reader persists progress through the existing action boundary");
  } finally {
    server.close();
    await once(server, "close");
  }
});
