import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import { profileSchema } from "../src/lib/validation";

test(
  "bio persists in light theme after autosave, manual save, theme/locale changes, retry and reload",
  { timeout: 90000 },
  async () => {
    const db = await v051Database();
    let browser, server: ReturnType<typeof createServer> | undefined;
    try {
      await db.exec(
        `insert into auth.users(id) values('${id(1)}'); insert into classes(id,name) values('${id(10)}','9A'); update profiles set display_name='Тестовый ученик',class_id='${id(10)}' where id='${id(1)}';`,
      );
      await asUser(db, id(1));
      const bundle = await build({
        entryPoints: ["tests/browser/profile-white-harness.tsx"],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
        jsx: "automatic",
        define: { "process.env.NODE_ENV": '"production"' },
        plugins: [
          {
            name: "profile-action",
            setup(api) {
              api.onResolve({ filter: /^@\/app\/actions\/profile$/ }, () => ({
                path: "profile",
                namespace: "fixture",
              }));
              api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
                loader: "js",
                contents:
                  'export async function saveProfile(_,form){const r=await fetch("/fixture/save-profile",{method:"POST",body:JSON.stringify({display_name:form.get("display_name"),class_id:form.get("class_id"),bio:form.get("bio"),subjects:form.getAll("subjects").filter(Boolean)})});return r.json();}',
              }));
            },
          },
        ],
      });
      const css = (
        await postcss([tailwindcss()]).process(
          readFileSync("src/app/globals.css", "utf8"),
          { from: "src/app/globals.css" },
        )
      ).css;
      const stored = async () =>
        (
          await db.query<{
            display_name: string;
            class_id: string;
            bio: string | null;
          }>("select display_name,class_id,bio from profiles where id=$1", [
            id(1),
          ])
        ).rows[0];
      let failNext = false,
        writes = 0;
      server = createServer(async (req, res) => {
        try {
          if (req.url === "/bundle.js") {
            res.setHeader("Content-Type", "application/javascript");
            res.end(bundle.outputFiles[0].contents);
          } else if (req.url === "/style.css") {
            res.setHeader("Content-Type", "text/css");
            res.end(css);
          } else if (req.url === "/fixture/save-profile") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk);
            const parsed = profileSchema.safeParse(
              JSON.parse(Buffer.concat(chunks).toString()),
            );
            res.setHeader("Content-Type", "application/json");
            if (failNext) {
              failNext = false;
              res.end(JSON.stringify({ error: "Сбой сохранения, повторите" }));
              return;
            }
            if (!parsed.success) {
              res.end(JSON.stringify({ error: "Некорректные данные" }));
              return;
            }
            await db.query("select save_profile_v053($1,$2,$3,$4)", [
              parsed.data.display_name,
              parsed.data.class_id,
              parsed.data.subjects,
              parsed.data.bio,
            ]);
            writes++;
            res.end(JSON.stringify({ success: "Сохранено" }));
          } else {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(
              `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.fixtureProfile=${JSON.stringify(await stored()).replace(/</g, "\\u003c")}</script><script type="module" src="/bundle.js"></script></body></html>`,
            );
          }
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Fixture failed" }));
        }
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        }),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem("nis-theme", "light"),
      );
      await page.goto(`http://127.0.0.1:${address.port}`);
      const bio = page.locator('textarea[name="bio"]');
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await bio.fill("Люблю физику.\nҚазақша мәтін 🙂");
      await expect
        .poll(async () => (await stored()).bio)
        .toBe("Люблю физику.\nҚазақша мәтін 🙂");
      await expect(page.locator("#profile-form")).toHaveAttribute(
        "data-status",
        "saved",
      );
      await page.reload();
      await expect(bio).toHaveValue("Люблю физику.\nҚазақша мәтін 🙂");
      await bio.fill("Сохранено вручную");
      await page.locator('#profile-form button[type="submit"]').click();
      await expect
        .poll(async () => (await stored()).bio)
        .toBe("Сохранено вручную");
      await expect(page.locator("#profile-form")).toHaveAttribute(
        "data-status",
        "saved",
      );
      await bio.fill("Bio сохраняется при переключении темы");
      await page.getByRole("radio", { name: "Тёмная" }).check();
      await expect
        .poll(async () => (await stored()).bio)
        .toBe("Bio сохраняется при переключении темы");
      await page.getByRole("radio", { name: "Светлая" }).check();
      await bio.fill("Новый bio при смене языка");
      await page.getByRole("button", { name: "KZ", exact: true }).click();
      await expect
        .poll(async () => (await stored()).bio, { timeout: 5000 })
        .toBe("Новый bio при смене языка");
      await page.getByRole("button", { name: "RU", exact: true }).click();
      await expect(page.locator("#profile-form")).not.toHaveAttribute(
        "data-status",
        "saving",
      );
      failNext = true;
      const previous = (await stored()).bio;
      await bio.fill("Сохранить после ошибки сети");
      await page.locator('#profile-form button[type="submit"]').click();
      await expect(page.getByRole("alert")).toHaveText(
        "Сбой сохранения, повторите",
      );
      assert.equal((await stored()).bio, previous);
      await page.locator('#profile-form button[type="submit"]').click();
      await expect
        .poll(async () => (await stored()).bio)
        .toBe("Сохранить после ошибки сети");
      await expect(page.locator("#profile-form")).toHaveAttribute(
        "data-status",
        "saved",
      );
      await bio.fill("x".repeat(280));
      await page.locator('#profile-form button[type="submit"]').click();
      await expect.poll(async () => (await stored()).bio?.length ?? 0).toBe(280);
      await expect(page.locator("#profile-form")).toHaveAttribute(
        "data-status",
        "saved",
      );
      await bio.fill("");
      await page.locator('#profile-form button[type="submit"]').click();
      await expect.poll(async () => (await stored()).bio).toBe(null);
      await expect(page.locator("#profile-form")).toHaveAttribute(
        "data-status",
        "saved",
      );
      await page.reload();
      await expect(bio).toHaveValue("");
      assert.ok(writes >= 7);
      assert.deepEqual(errors, []);
      mkdirSync("test-results/profile-white", { recursive: true });
      await page.screenshot({ path: "test-results/profile-white/bio.png" });
    } finally {
      await browser?.close();
      if (server)
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      await db.close();
    }
  },
);
