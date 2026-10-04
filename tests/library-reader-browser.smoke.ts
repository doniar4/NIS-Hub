import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { samplePdf } from "./browser/sample-pdf";
import type { Highlight } from "../src/lib/pdf-highlights";
import type { LibraryBook } from "../src/lib/library";

test(
  "Library uses bounded pages; PDF highlights survive canvas replacement, zoom, virtualization and reload",
  { timeout: 120000 },
  async () => {
    const bundle = await build({
      entryPoints: ["tests/browser/library-reader-harness.tsx"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
      plugins: [
        {
          name: "isolated-actions",
          setup(api) {
            api.onResolve(
              {
                filter:
                  /^(?:@\/app\/actions\/|\.\.\/\.\.\/src\/app\/actions\/)/,
              },
              (a) => ({ path: a.path, namespace: "fixture" }),
            );
            api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
              loader: "js",
              contents: `const rpc=async(name,...args)=>(await fetch('/fixture/action',{method:'POST',body:JSON.stringify({name,args})})).json();export const changeLibrary=(...a)=>rpc('library',...a);export const saveReading=async()=>({success:'Saved'});export const getHighlights=(...a)=>rpc('getHighlights',...a);export const saveHighlight=(...a)=>rpc('saveHighlight',...a);export const deleteHighlight=(...a)=>rpc('deleteHighlight',...a);`,
            }));
          },
        },
      ],
    });
    const books: LibraryBook[] = Array.from({ length: 61 }, (_, i) => ({
      id: String(i),
      title: `Book ${i + 1}`,
      author: "Test Author",
      languages: ["ru", "kz"],
      grade: 9,
      subject_id: "science",
    }));
    const page = (offset = 0, query = "") => {
      const filtered = books.filter(
        (b) => !query || b.title.toLowerCase().includes(query.toLowerCase()),
      );
      return {
        books: filtered.slice(offset, offset + 24),
        total: filtered.length,
        nextOffset: offset + 24 < filtered.length ? offset + 24 : null,
        suggestions: [],
      };
    };
    const css =
      readdirSync(".next/static/css")
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(".next/static/css/" + f, "utf8"))
        .join("\n") + readFileSync("src/styles/library.css", "utf8");
    let highlights: Highlight[] = [];
    const requests: number[] = [];
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://fixture");
      res.setHeader("Cache-Control", "no-store");
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (url.pathname === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else if (url.pathname === "/api/library") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        requests.push(offset);
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify(
            url.searchParams.has("personal")
              ? {
                  collections: [],
                  history: [
                    { query: "Book 61", searched_at: new Date().toISOString() },
                  ],
                  recent: [],
                }
              : page(offset, url.searchParams.get("q") ?? ""),
          ),
        );
      } else if (url.pathname === "/fixture/action") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const { name, args } = JSON.parse(Buffer.concat(chunks).toString());
        let result: unknown = { ok: true };
        if (name === "getHighlights")
          result = { ok: true, userId: "fixture-user", highlights };
        if (name === "saveHighlight")
          highlights = [
            ...highlights.filter((h) => h.id !== args[1].id),
            args[1],
          ];
        if (name === "deleteHighlight")
          highlights = highlights.filter((h) => h.id !== args[1]);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } else if (url.pathname.endsWith("/access")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: "/fixture.pdf", expiresIn: 600 }));
      } else if (url.pathname === "/fixture.pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.end(samplePdf());
      } else if (
        url.pathname === "/pdfjs-dist/legacy/build/pdf.worker.min.mjs"
      ) {
        res.setHeader("Content-Type", "application/javascript");
        res.end(
          readFileSync(
            "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          ),
        );
      } else if (
        /^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/[\w.-]+$/.test(
          url.pathname,
        )
      ) {
        res.end(readFileSync("public" + url.pathname));
      } else if (url.pathname === "/library" || url.pathname === "/reader") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.fixturePage=${JSON.stringify(page())}</script><script type="module" src="/bundle.js"></script></body></html>`,
        );
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const browser = await chromium.launch({ headless: true });
    try {
      const tab = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      const errors: string[] = [];
      tab.on("pageerror", (e) => errors.push(e.message));
      const origin = `http://127.0.0.1:${address.port}`;
      await tab.goto(origin + "/library");
      await expect(tab.locator(".library-catalog-card")).toHaveCount(24);
      assert.deepEqual(requests, []);
      mkdirSync("/tmp/nis-library-reader", { recursive: true });
      await tab.screenshot({
        path: "/tmp/nis-library-reader/catalog-desktop.png",
      });
      await tab.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() =>
          tab.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await tab.screenshot({
        path: "/tmp/nis-library-reader/catalog-mobile.png",
      });
      await tab.setViewportSize({ width: 1280, height: 900 });
      await expect(tab.getByText("Test Author").first()).toBeVisible();
      await expect(tab.getByText("Қазақша").first()).toBeVisible();
      await tab.getByRole("button", { name: "Show more" }).click();
      await expect(tab.locator(".library-catalog-card")).toHaveCount(48);
      assert.equal(requests.at(-1), 24);
      await tab.getByRole("searchbox").fill("Book 61");
      await expect(tab.locator(".library-catalog-card")).toHaveCount(1);
      await expect(tab.getByRole("heading", { name: "Book 61" })).toBeVisible();
      await tab.getByRole("button", { name: "Favorite: Book 61" }).click();
      await expect(
        tab.getByRole("button", { name: "Favorite: Book 61" }),
      ).toHaveAttribute("aria-pressed", "true");
      await tab.getByRole("button", { name: "Activity", exact: true }).click();
      await expect(
        tab.getByRole("heading", { name: "Library Activity" }),
      ).toBeVisible();
      await expect(tab.getByRole("button", { name: /Book 61/ })).toBeVisible();
      mkdirSync("/tmp/nis-library-reader", { recursive: true });
      await tab.screenshot({ path: "/tmp/nis-library-reader/activity.png" });
      await tab.goto(origin + "/reader");
      const canvas = tab.locator('[data-page="1"] canvas');
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await tab.getByTitle("Highlight text", { exact: true }).click();
      const overlay = tab.locator('[data-page="1"] .pdf-highlight-layer');
      await overlay.scrollIntoViewIfNeeded();
      const box = await overlay.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 200);
      await tab.mouse.move(box.x + 40, box.y + 60);
      await tab.mouse.down();
      await tab.mouse.move(box.x + 200, box.y + 85);
      await tab.mouse.up();
      const mark = tab.locator('[data-page="1"] .pdf-highlight-item');
      await expect(mark).toBeVisible();
      await expect.poll(() => highlights.length).toBe(1);
      assert.equal(
        await overlay.evaluate((el) =>
          el.parentElement?.querySelector(".pdf-canvas-host")?.contains(el),
        ),
        false,
      );
      await tab.getByRole("button", { name: "Zoom in", exact: true }).click();
      await expect(mark).toBeVisible();
      await expect(canvas).toBeVisible();
      await expect
        .poll(async () => {
          await tab.locator(".pdf-scroll-viewport").evaluate((el) => {
            el.dispatchEvent(new WheelEvent("wheel", { deltaY: 4000 }));
            el.scrollTop = el.scrollHeight;
          });
          return canvas.count();
        })
        .toBe(0);
      await tab.locator(".pdf-scroll-viewport").evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect(canvas).toBeVisible();
      await expect(mark).toBeVisible();
      await tab.reload();
      await expect(canvas).toBeVisible();
      await expect(mark).toBeVisible();
      await tab.getByTitle("Highlight text", { exact: true }).click();
      await tab.getByTitle("Eraser", { exact: true }).click();
      await mark.click();
      await expect(mark).toHaveCount(0);
      await expect.poll(() => highlights.length).toBe(0);
      await tab.reload();
      await expect(canvas).toBeVisible();
      await expect(mark).toHaveCount(0);
      assert.deepEqual(errors, []);
      await tab.screenshot({ path: "/tmp/nis-library-reader/reader.png" });
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
