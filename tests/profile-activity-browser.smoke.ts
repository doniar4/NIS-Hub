import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { fontBootstrap } from "../src/lib/font-fallback";
import {
  buildGrid,
  generateContributions,
  dayMs,
} from "../src/components/ui/contribution-skyline";

test("Profile skyline, streak updates, working dock and visible system fonts on a slow/failed connection", async () => {
  const bundle = await build({
    entryPoints: ["tests/browser/profile-activity-harness.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env": "{}",
    },
    plugins: [
      {
        name: "profile-fixture",
        setup(b) {
          b.onResolve(
            { filter: /^@\/app\/actions\/(profile-activity|activity)$/ },
            (a) => ({ path: a.path, namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
            contents: a.path.endsWith("profile-activity")
              ? "export async function loadProfileActivity(){return fetch('/activity').then(r=>r.json());}"
              : "export async function recordUserActivity(path){return fetch('/visit',{method:'POST',body:JSON.stringify({path})}).then(r=>r.json());}",
            loader: "js",
          }));
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "next-fixture",
          }));
          b.onLoad({ filter: /navigation/, namespace: "next-fixture" }, () => ({
            contents:
              'export const usePathname=()=>"/profile";export const useRouter=()=>({refresh(){},push(){},prefetch(){}});',
            loader: "js",
          }));
          b.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "next-fixture",
          }));
          b.onLoad({ filter: /link/, namespace: "next-fixture" }, () => ({
            resolveDir: process.cwd(),
            contents:
              'import React from "react";export default function Link({href,prefetch,children,...props}){return React.createElement("a",{href,...props},children)}',
            loader: "js",
          }));
        },
      },
    ],
  });
  const css =
    readdirSync(".next/static/css")
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(".next/static/css/" + f, "utf8"))
      .join("\n") +
    "\n" +
    readFileSync("src/styles/profile.css", "utf8");
  let today = "2026-10-12",
    visits = 0,
    failed = false;
  const initial = buildGrid(
    generateContributions(dayMs(today), 17),
    dayMs(today),
    1,
  ).cells.map(({ date, count }) => ({
    date,
    count:
      date === "2026-10-07"
        ? 0
        : date >= "2026-10-08"
          ? date === today
            ? 0
            : 2
          : count,
  }));
  const recorded = new Map<string, number>();
  const server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(bundle.outputFiles[0].contents);
      return;
    }
    if (req.url === "/styles.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
      return;
    }
    if (req.url === "/visit") {
      visits++;
      recorded.set(
        today,
        (recorded.get(today) ??
          initial.find((d) => d.date === today)?.count ??
          0) + 1,
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === "/activity") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          failed
            ? null
            : {
                today,
                days: [
                  ...initial.filter((d) => !recorded.has(d.date)),
                  ...Array.from(recorded, ([date, count]) => ({ date, count })),
                ],
              },
        ),
      );
      return;
    }
    if (req.url?.startsWith("/_next/static/media/")) {
      const file = req.url.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+\.(woff2|woff)$/.test(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        res.setHeader("Content-Type", "font/woff2");
        res.end(readFileSync(".next/static/media/" + file));
      } catch {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="ru"><meta charset="UTF-8"><link rel="stylesheet" href="/styles.css"><script>${fontBootstrap}</script><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`,
    artifacts =
      process.env.NIS_BROWSER_ARTIFACTS ?? "/tmp/nis-profile-activity-browser";
  mkdirSync(artifacts, { recursive: true });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/profile");
    const activity = page.locator("#profile-activity"),
      canvas = activity.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(() => visits).toBe(1);
    await expect(activity.locator(".profile-visit-streak > strong")).toHaveText(
      "5",
    );
    await canvas.focus();
    await canvas.press("End");
    await expect(activity.getByRole("tooltip")).toContainText(/12 окт.*2026/);
    await page.screenshot({
      path: artifacts + "/profile-desktop-2d.png",
      fullPage: true,
    });
    await activity
      .getByRole("button", { name: "Город активности 3D", exact: true })
      .click();
    await expect(
      activity.getByRole("button", {
        name: "Город активности 3D",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => canvas.evaluate((el) => el.parentElement!.clientHeight))
      .toBeGreaterThan(180);
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: artifacts + "/profile-desktop-3d.png",
      fullPage: true,
    });
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 35,
      box.y + box.height / 2 + 15,
      { steps: 5 },
    );
    await page.mouse.up();
    await activity
      .getByRole("button", { name: "Календарь активности", exact: true })
      .click();
    await expect(
      activity.getByRole("button", {
        name: "Календарь активности",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const dock = page.getByRole("navigation", { name: "Быстрые переходы" });
    const library = dock.getByRole("link", { name: "Библиотека", exact: true });
    await expect(library).toHaveAttribute("href", "/library");
    const before = await library.boundingBox();
    assert.ok(before);
    await library.hover();
    await expect
      .poll(() => library.evaluate((el) => el.clientWidth))
      .toBeGreaterThan(50);
    await page.mouse.move(0, 0);
    await library.focus();
    await expect(page.locator(".dock-label")).toContainText("Библиотека");
    await expect(dock.getByRole("link")).toHaveCount(6);
    await dock.getByRole("button", { name: "Сменить тему" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("radio", { name: "Тёмная", exact: true }),
    ).toBeChecked();
    for (const locale of ["ru", "kk", "en"]) {
      await page.evaluate(
        (l) =>
          window.dispatchEvent(
            new CustomEvent("profile-test-locale", { detail: l }),
          ),
        locale,
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(canvas).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          )
          .toBe(true);
        await page.screenshot({
          path: `${artifacts}/profile-${locale}-${width}-dark.png`,
          fullPage: true,
        });
      }
    }
    // A successful visit notification re-fetches authoritative totals once.
    today = "2026-10-13";
    await page.clock.setFixedTime(new Date("2026-10-12T19:01:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => visits).toBe(2);
    await expect(activity.locator(".profile-visit-streak > strong")).toHaveText(
      "6",
    );
    await page.close();

    const slow = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await slow.addInitScript(() =>
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "2g" },
      }),
    );
    await slow.route(/\.(woff2|woff)(\?|$)/, (route) => route.abort());
    await slow.goto(origin + "/profile");
    await expect(slow.locator("html")).toHaveAttribute("data-font", "system");
    const family = await slow
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    assert.match(family, /system-ui/);
    assert.doesNotMatch(family, /Variable/);
    await expect(
      slow.getByRole("heading", { name: "Айдана Нұрланқызы" }),
    ).toBeVisible();
    await slow.screenshot({
      path: artifacts + "/profile-system-font-mobile.png",
      fullPage: true,
    });
    await slow.close();

    const blocked = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await blocked.route(/\.(woff2|woff)(\?|$)/, (route) => route.abort());
    await blocked.goto(origin + "/profile");
    await expect(
      blocked.getByRole("heading", { name: "Айдана Нұрланқызы" }),
    ).toBeVisible();
    await expect(blocked.locator("#profile-activity canvas")).toBeVisible();
    await blocked.close();

    failed = true;
    const unavailable = await browser.newPage();
    await unavailable.goto(origin + "/profile?unavailable");
    await expect(unavailable.locator("#profile-activity canvas")).toHaveCount(
      0,
    );
    await expect(
      unavailable.locator(".profile-activity-unavailable"),
    ).toContainText("временно недоступна");
    failed = false;
    await unavailable
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await expect(unavailable.locator("#profile-activity canvas")).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
