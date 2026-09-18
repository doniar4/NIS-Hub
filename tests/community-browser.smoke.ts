import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import { themeBootstrap } from "../src/lib/theme";
const artifacts = "/tmp/nis-community-browser";
test(
  "Community UI: isolated PostgreSQL transport, responsive themes, diary import, PDF cover and sidebar",
  { timeout: 120000 },
  async () => {
    const bundle = await build({
      entryPoints: [resolve("tests/browser/community-harness.tsx")],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      jsx: "automatic",
      logLevel: "silent",
      define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
      plugins: [
        {
          name: "isolated-server-boundaries",
          setup(api) {
            api.onResolve({ filter: /^next\/navigation$/ }, () => ({
              path: "navigation",
              namespace: "fixture",
            }));
            api.onResolve({ filter: /^@\/lib\/community-client$/ }, () => ({
              path: "community",
              namespace: "fixture",
            }));
            api.onResolve({ filter: /^@\/app\/actions\/ai-study$/ }, () => ({
              path: "ai",
              namespace: "fixture",
            }));
            api.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
              contents:
                a.path === "navigation"
                  ? "export function usePathname(){return location.pathname;} export function useRouter(){return {refresh(){}};}"
                  : a.path === "ai"
                    ? 'export async function generateStudy(){return {error:"disabled"};}'
                    : `const call=async(name,args)=>(await fetch('/rpc',{method:'POST',body:JSON.stringify({name,args})})).json();${["loadInbox", "startConversation", "loadMessages", "sendMessage", "markConversationRead", "loadNotifications", "dismissNotification"].map((n) => `export const ${n}=(...args)=>call('${n}',args);`).join("")}`,
              loader: "js",
            }));
          },
        },
      ],
    });
    const css = readdirSync(".next/static/css")
      .filter((n) => n.endsWith(".css"))
      .map((n) => readFileSync(join(".next/static/css", n), "utf8"))
      .join("\n");
    const db = await v051Database();
    await db.exec(
      `insert into auth.users(id) values ('${id(1)}'),('${id(2)}');update profiles set display_name='Amina' where id='${id(1)}';update profiles set display_name='Timur' where id='${id(2)}';`,
    );
    let queue = Promise.resolve(),
      thread = "";
    const server = createServer(async (req, res) => {
      const path = new URL(req.url!, "http://local").pathname;
      if (path === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
        return;
      }
      if (path === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (path === "/favicon.ico") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (path.startsWith("/api/books/")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: "/fixture.pdf" }));
        return;
      }
      if (path === "/fixture.pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.end(
          "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 240 360]/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length 33>>stream\n0.1 0.4 0.2 rg 0 0 240 360 re f\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF",
        );
        return;
      }
      if (path === "/pdfjs-dist/legacy/build/pdf.worker.min.mjs") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(
          readFileSync(
            "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          ),
        );
        return;
      }
      if (path === "/rpc" || path === "/incoming") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c);
        const body =
          path === "/rpc"
            ? JSON.parse(Buffer.concat(chunks).toString())
            : { name: "incoming", args: [] };
        queue = queue.then(async () => {
          try {
            await asUser(db, body.name === "incoming" ? id(2) : id(1));
            const a = body.args;
            let result: unknown;
            switch (body.name) {
              case "loadInbox":
                result = {
                  data: (await db.query("select * from dm_inbox()")).rows,
                };
                break;
              case "startConversation":
                thread = (
                  await db.query<{ id: string }>("select start_dm($1) id", [
                    a[0],
                  ])
                ).rows[0].id;
                result = { id: thread };
                break;
              case "loadMessages":
                result = {
                  data: (
                    await db.query(
                      "select * from direct_messages where thread_id=$1 order by created_at,id",
                      [a[0]],
                    )
                  ).rows,
                  more: false,
                };
                break;
              case "sendMessage":
                result = (await db.query("select send_dm($1,$2,$3) id", a))
                  .rows[0];
                break;
              case "markConversationRead":
                await db.query("select read_dm($1,$2)", a);
                result = { ok: true };
                break;
              case "dismissNotification":
                await db.query("select dismiss_notification($1)", a);
                result = { ok: true };
                break;
              case "loadNotifications": {
                const data = (
                  await db.query<{ read_at: string | null }>(
                    "select * from notification_feed()",
                  )
                ).rows;
                result = {
                  data,
                  unread: data.filter((n) => !n.read_at).length,
                };
                break;
              }
              case "incoming":
                await db.query("select send_dm($1,$2,$3)", [
                  thread,
                  "Reply from Timur",
                  crypto.randomUUID(),
                ]);
                result = { ok: true };
                break;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch {
            res.end(JSON.stringify({ error: "unavailable" }));
          }
        });
        return;
      }
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        '<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>' +
          themeBootstrap +
          '</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = "http://127.0.0.1:" + address.port;
    mkdirSync(artifacts, { recursive: true });
    const browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.NIS_CHROMIUM_PATH ?? "/usr/lib/chromium/chromium",
    });
    try {
      const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
        }),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/profile");
      await expect(page.locator(".profile-portrait")).toBeVisible();
      const portrait = await page.locator(".profile-portrait").boundingBox(),
        heading = await page.locator("h1").boundingBox();
      assert.ok(
        portrait &&
          heading &&
          portrait.x < heading.x &&
          Math.abs(portrait.y - heading.y) < 70,
      );
      const divider = page.locator(".sidebar-toggle-divider");
      const initial = await divider.evaluate(
        (e) => getComputedStyle(e).transform,
      );
      await page.locator(".sidebar-collapse").click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-sidebar",
        "collapsed",
      );
      await page.waitForTimeout(450);
      assert.notEqual(
        await divider.evaluate((e) => getComputedStyle(e).transform),
        initial,
      );
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-sidebar",
        "collapsed",
      );
      await page.locator(".sidebar-collapse").click();
      await expect(page.locator(".app-sidebar")).toHaveCSS("width", "240px");
      for (const theme of ["light", "dark"]) {
        await page.locator("input[type=radio][value=" + theme + "]").check();
        await page.screenshot({
          path: join(artifacts, "profile-" + theme + ".png"),
          fullPage: true,
          animations: "disabled",
        });
      }
      await expect(page.locator("input[type=radio]")).toHaveCount(2);
      await page.goto(origin + "/messages");
      await page.getByRole("textbox", { name: "Имя получателя" }).fill("timur");
      await page.getByRole("button", { name: "Открыть чат" }).click();
      await expect(page.getByRole("heading", { name: "Timur" })).toBeVisible();
      await page
        .getByRole("textbox", { name: "Сообщение", exact: true })
        .fill("Local test message");
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      await expect(
        page.getByText("Local test message", { exact: true }).last(),
      ).toBeVisible();
      await page.screenshot({
        path: join(artifacts, "messages-dark.png"),
        fullPage: true,
      });
      await page.goto(origin + "/diary");
      await expect(page.locator("tbody tr")).toHaveCount(6);
      await page.locator("input[type=file]").setInputFiles({
        name: "grades.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "subject,date,score,max,type\nPhysics,2026-09-18,9,10,Quiz",
        ),
      });
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody")).toContainText("Physics");
      await page.locator("input[type=file]").setInputFiles({
        name: "bad.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("bad data"),
      });
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.locator("tbody")).toContainText("Physics");
      await page.request.post(origin + "/incoming");
      await page.evaluate(() =>
        window.dispatchEvent(new Event("nis-notifications-change")),
      );
      await page.getByRole("button", { name: /Уведомления/ }).click();
      await expect(page.locator(".notification-card").first()).toContainText(
        "Timur",
      );
      await page.screenshot({
        path: join(artifacts, "notifications-dark.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Отметить прочитанным" })
        .first()
        .click();
      await page.keyboard.press("Escape");
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const path of ["/profile", "/diary", "/messages"]) {
          await page.goto(origin + path);
          await page.waitForTimeout(200);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            "overflow " + path + " " + width,
          );
          await page.screenshot({
            path: join(artifacts, path.slice(1) + "-" + width + ".png"),
            fullPage: true,
          });
        }
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(origin + "/reader");
      await page.locator("summary").click();
      await expect(page.locator(".ai-study-panel form")).toBeVisible();
      await expect(
        page.locator(".book-first-page .cover-canvas:not(.cover-pending)"),
      ).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({
        path: join(artifacts, "reader.png"),
        fullPage: true,
      });
      for (const locale of ["ru", "kk", "en"]) {
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto(origin + "/diary?locale=" + locale);
        await expect(page.locator("tbody tr")).toHaveCount(6);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "locale overflow " + locale,
        );
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(origin + "/profile");
      assert.equal(
        await page
          .locator(".cursor-bloom")
          .evaluate((e) => getComputedStyle(e).display),
        "none",
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
      await queue;
      await db.close();
    }
  },
);
