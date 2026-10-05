import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { join, basename } from "node:path";
import { build } from "esbuild";
import { chromium, webkit, expect as baseExpect } from "@playwright/test";
import { classes, subjects } from "./browser/fixtures";
import type { ClassHomework } from "../src/lib/database.types";

const expect = baseExpect.configure({ timeout: 10000 });
const makeWork = (id: string, date: string, body: string, subject = subjects[0].id): ClassHomework => ({
  id, class_id: classes[0].id, subject_id: subject, due_date: date, body, created_by: "fixture-user",
  created_at: "", updated_at: "", moderation_status: "visible", deleted_at: null,
});

test("Inline daily homework: shared requests, day/race/event updates, expansion, actions and responsive themes/locales", { timeout: 180000 }, async () => {
  const bundle = await build({ entryPoints: ["tests/browser/inline-homework-harness.tsx"], bundle: true, write: false,
    platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "isolated-homework-actions", setup(api) {
      api.onResolve({ filter: /^@\/app\/actions\/(homework|community-safety)$/ }, () => ({ path: "actions", namespace: "fixture" }));
      api.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "jsx", resolveDir: process.cwd(), contents: path === "link"
        ? 'export default function Link({prefetch,...props}){return <a {...props}/>;}'
        : path === "navigation" ? 'export const useRouter=()=>({refresh(){}});'
        : 'const rpc=async(name,args)=>(await fetch("/rpc",{method:"POST",body:JSON.stringify({name,args})})).json();' +
          ["loadHomework", "loadDailyHomework", "saveHomework", "deleteHomework", "safetyAction"].map(name => `export const ${name}=(...args)=>rpc("${name}",args);`).join("") }));
    } }],
  });
  const cssRoot = ".next/static/css";
  const css = readdirSync(cssRoot, { recursive: true }).filter(name => String(name).endsWith(".css"))
    .map(name => readFileSync(join(cssRoot, String(name)), "utf8")).join("\n");
  let calls: string[] = [], fail = false;
  const long = "LONG_HW " + "Questions and exercises with a long explanation. ".repeat(18);
  const initialRows = [makeWork("first", "2026-10-05", long), makeWork("second", "2026-10-05", "SECOND_HW"),
    makeWork("physics", "2026-10-05", "PHYSICS_HW", subjects[1].id),
    makeWork("tuesday", "2026-10-06", "TUESDAY_HW"), makeWork("wednesday", "2026-10-07", "WEDNESDAY_HW"),
    makeWork("thursday", "2026-10-08", "THURSDAY_HW")];
  let rows = initialRows.map(row => ({ ...row }));
  const server = createServer(async (req, res) => {
    const route = new URL(req.url!, "http://fixture").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (route === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); return; }
    if (route === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
    if (route.endsWith(".woff2")) { try { res.end(readFileSync(join(".next/static/media", basename(route)))); } catch { res.statusCode = 404; res.end(); } return; }
    if (route === "/favicon.ico") { res.statusCode = 204; res.end(); return; }
    if (route === "/rpc") {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
      const { name, args } = JSON.parse(Buffer.concat(chunks).toString());
      let value: unknown;
      if (name === "loadDailyHomework" || name === "loadHomework") {
        calls.push(`${name}:${args[0]}`);
        value = fail ? { error: "failed" } : { data: rows.filter(row => row.due_date === args[0] && !row.deleted_at && row.moderation_status === "visible") };
        // A slower Thursday response must never replace a newer Wednesday view.
        if (args[0] === "2026-10-08") await new Promise(resolve => setTimeout(resolve, 200));
      } else if (name === "saveHomework") {
        const v = args[0], previous = rows.findIndex(row => row.id === v.id);
        const row = makeWork(v.id ?? "saved-fixture", v.date, v.body, v.subject);
        if (previous >= 0) rows[previous] = row; else rows.push(row);
        value = { ok: true };
      } else if (name === "deleteHomework") { rows = rows.filter(row => row.id !== args[0]); value = { ok: true }; }
      else value = { error: "failed" };
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value)); return;
    }
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const artifacts = join(process.cwd(), "test-results", "inline-homework"); mkdirSync(artifacts, { recursive: true });
  try {
    for (const [name, engine] of (process.env.NIS_BROWSER_ENGINE === "chromium" ? [["chromium", chromium]] as const : [["chromium", chromium], ["webkit", webkit]] as const)) {
      rows = initialRows.map(row => ({ ...row })); fail = false;
      const browser = await engine.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
        calls = []; await page.goto(origin + "/schedule");
        await expect(page.locator(".lesson-inline-homework")).toHaveCount(2);
        assert.deepEqual(calls, ["loadDailyHomework:2026-10-05"], "rows, preview and collapsed editor share one day load");
        const first = page.locator(".lesson-row").first();
        await expect(first).toContainText("LONG_HW"); await expect(first).not.toContainText("PHYSICS_HW");
        await expect(page.locator(".lesson-row").nth(2).locator(".lesson-inline-homework")).toHaveCount(0);
        const details = first.locator("details"), summary = details.locator("summary");
        assert.ok(await first.locator(".lesson-homework-preview").evaluate(el => el.scrollHeight > el.clientHeight), "long body is actually clamped");
        await summary.focus(); await summary.press("Enter"); await expect(details).toHaveAttribute("open", "");
        await expect(details.locator("li")).toHaveCount(2); await expect(details).toContainText("SECOND_HW");
        await details.locator("ul").focus(); await expect(details.locator("ul")).toBeFocused();
        await summary.press("Enter"); await expect(details).not.toHaveAttribute("open", "");
        const tabs = page.getByRole("tab");
        await tabs.nth(1).click(); await expect(page.locator(".lesson-inline-homework")).toContainText("TUESDAY_HW");
        for(const body of ["LONG_HW", "PHYSICS_HW", "SECOND_HW"]) await expect(page.locator(".lesson-list")).not.toContainText(body);
        assert.deepEqual(calls, ["loadDailyHomework:2026-10-05", "loadDailyHomework:2026-10-06"]);
        await tabs.nth(3).click(); await tabs.nth(2).click();
        await expect(page.locator(".lesson-inline-homework")).toContainText("WEDNESDAY_HW");
        await page.waitForLoadState("networkidle"); await expect(page.locator(".lesson-list")).not.toContainText("THURSDAY_HW");
        await tabs.nth(0).click(); await expect(first).toContainText("LONG_HW");
        const beforeSelection = calls.length; await first.locator(".lesson-select").click();
        await expect(first.locator(".lesson-select")).toHaveAttribute("aria-pressed", "true");
        assert.equal(calls.length, beforeSelection, "selecting lessons/expanding homework does not fetch");
        await expect(first.locator(".timetable-materials")).toHaveAttribute("href", new RegExp(`subject=${subjects[0].id}`));
        await first.locator(".action-menu-trigger").click(); await expect(page.getByRole("menu")).toBeVisible();
        await page.getByRole("menuitem", { name: "Add homework", exact: true }).click();
        await expect(page.getByRole("dialog").locator('input[type="date"]')).toHaveValue("2026-10-05");
        await page.getByRole("dialog").locator("textarea").fill("QUICK_ADDED_HW");
        const beforeSave = calls.length; await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
        await expect(first).toContainText("QUICK_ADDED_HW"); assert.equal(calls.length, beforeSave + 1);
        await page.locator(".schedule-homework > summary").click();
        await page.locator(".homework-entry").first().getByRole("button", { name: "Edit", exact: true }).click();
        await page.locator(".homework-panel textarea").fill("EDITED_HW");
        const beforeEdit = calls.length; await page.locator(".homework-panel form").getByRole("button", { name: "Save", exact: true }).click();
        await expect(first).toContainText("EDITED_HW"); assert.equal(calls.length, beforeEdit + 1);
        const beforeClassChange = calls.length;
        await page.locator(".schedule-class-select").selectOption(classes[1].id);
        await expect(page.locator(".lesson-inline-homework")).toHaveCount(0);
        await expect(page.locator(".lesson-row")).toHaveCount(3);
        await page.locator(".schedule-class-select").selectOption(classes[0].id);
        await expect(first).toContainText("EDITED_HW");
        assert.equal(calls.length, beforeClassChange, "class browsing never fetches another class's homework");

        // Home's school-day navigation uses its displayed date, not today's date.
        calls = []; await page.goto(origin + "/home"); await expect(first).toContainText("EDITED_HW");
        assert.deepEqual(calls, ["loadDailyHomework:2026-10-05"]);
        await page.getByRole("button", { name: "Next school day", exact: true }).click();
        await expect(first).toContainText("TUESDAY_HW");
        await page.getByRole("button", { name: "Previous school day", exact: true }).click(); await expect(first).toContainText("EDITED_HW");
        const lessonBox = await first.locator(".lesson-select").boundingBox(), homeworkBox = await first.locator("details").boundingBox();
        assert.ok(lessonBox && homeworkBox && homeworkBox.x >= lessonBox.x + lessonBox.width, "desktop homework occupies the middle area");
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const locale of ["ru", "kk", "en"]) {
            await page.goto(origin + `/home?locale=${locale}`); await expect(first.locator("details")).toBeVisible();
            for (const theme of ["light", "dark"]) {
              await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${width}/${locale}/${theme}: no overflow`);
              const info = await first.locator(".lesson-select").boundingBox(), hw = await first.locator("details").boundingBox();
              assert.ok(info && hw);
              if (width <= 768) assert.ok(hw.y >= info.y + info.height, "mobile/tablet homework sits below subject info");
              await expect(first.locator(".timetable-materials")).toBeVisible(); await expect(first.locator(".action-menu-trigger")).toBeVisible();
              assert.equal(await first.locator(".lesson-homework-preview").evaluate(el => getComputedStyle(el).webkitLineClamp), "2");
              if (locale === "en" && [390, 1440].includes(width)) await page.screenshot({ path: join(artifacts, `${name}-${width}-${theme}.png`), fullPage: true });
            }
          }
        }
        fail = true; await page.evaluate(() => window.dispatchEvent(new Event("nis-homework-change")));
        await expect(page.locator(".lesson-inline-homework")).toHaveCount(0); await expect(page.locator(".lesson-row")).toHaveCount(3);
        await expect(page.locator(".homework-preview [role=alert]")).toBeVisible();
        fail = false; await page.evaluate(() => window.dispatchEvent(new Event("nis-homework-change"))); await expect(first.locator("details")).toBeVisible();
        assert.deepEqual(errors, [], "no browser/hydration errors");
      } finally { await browser.close(); }
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
