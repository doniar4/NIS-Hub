import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import {
  chromium,
  webkit,
  devices,
  expect,
  type Page,
  type Browser,
} from "@playwright/test";
import { INSTALL_KEYS, INSTALL_COOLDOWN } from "../src/lib/install-awareness";
import { installCopy } from "../src/lib/install-copy";

async function overflow(page: Page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no horizontal overflow",
  );
}
test(
  "Install awareness: real components in mobile WebKit/Chromium, platform/storage/prompt boundaries",
  { timeout: 180000 },
  async (t) => {
    const [bundle, css] = await Promise.all([
      build({
        entryPoints: ["tests/browser/install-awareness-harness.tsx"],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
        jsx: "automatic",
        define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
        plugins: [
          {
            name: "next-routing-boundary",
            setup(api) {
              api.onResolve({ filter: /^next\/navigation$/ }, () => ({
                path: "navigation",
                namespace: "fixture",
              }));
              api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
                loader: "js",
                contents:
                  'import {useSyncExternalStore} from "react";const subscribe=f=>{addEventListener("popstate",f);return()=>removeEventListener("popstate",f)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>"/");',
                resolveDir: process.cwd(),
              }));
            },
          },
        ],
      }),
      postcss([tailwindcss()]).process(
        [
          "src/app/globals.css",
          "src/styles/mobile.css",
          "src/styles/install.css",
        ]
          .map((f) => readFileSync(f, "utf8"))
          .join("\n"),
        { from: "src/app/globals.css" },
      ),
    ]);
    const server = createServer((req, res) => {
      const path = new URL(req.url!, "http://fixture").pathname;
      if (path === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (path === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css.css);
      } else if (path === "/icons/icon-192.png") {
        res.setHeader("Content-Type", "image/png");
        res.end(readFileSync("public/icons/icon-192.png"));
      } else if (path.startsWith("/api/")) {
        res.statusCode = 500;
        res.end("Unexpected API request");
      } else {
        res.setHeader("Content-Type", "text/html;charset=utf-8");
        res.end(
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
        );
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    const origin = `http://127.0.0.1:${addr.port}`,
      artifacts = "test-results/install-awareness";
    mkdirSync(artifacts, { recursive: true });
    async function fresh(
      browser: Browser,
      device: (typeof devices)[string],
      seed?: "third" | "standalone" | "iosStandalone" | "denied",
    ) {
      const context = await browser.newContext({ ...device });
      if (seed)
        await context.addInitScript(
          ({ seed, keys }) => {
            if (seed === "third" && !localStorage.getItem(keys.visits))
              localStorage.setItem(keys.visits, "2");
            if (seed === "denied")
              for (const key of ["localStorage", "sessionStorage"])
                Object.defineProperty(window, key, {
                  configurable: true,
                  get() {
                    throw new DOMException("Unavailable", "SecurityError");
                  },
                });
            if (seed === "iosStandalone")
              Object.defineProperty(navigator, "standalone", {
                value: true,
                configurable: true,
              });
            if (seed === "standalone") {
              const original = window.matchMedia.bind(window);
              window.matchMedia = (query) => {
                const media = original(query);
                if (query === "(display-mode: standalone)")
                  Object.defineProperty(media, "matches", { value: true });
                return media;
              };
            }
          },
          { seed, keys: INSTALL_KEYS },
        );
      const page = await context.newPage(),
        errors: string[] = [],
        api: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().includes("/api/")) api.push(r.url());
      });
      return { context, page, errors, api };
    }
    try {
      for (const [name, engine, device] of [
        ["webkit", webkit, devices["iPhone 13"]],
        ["chromium", chromium, devices["Pixel 7"]],
      ] as const) {
        const browser = await engine.launch();
        try {
          for (const locale of ["ru", "kk", "en"] as const) {
            const f = await fresh(browser, device),
              { page, context } = f,
              c = installCopy(locale);
            for (const theme of ["light", "dark"]) {
              await page.goto(`${origin}/?locale=${locale}&theme=${theme}`);
              await expect(page.locator(".install-home")).toBeVisible();
              await expect(page.locator(".install-reminder")).toHaveCount(0);
              await expect(page.locator(".install-home")).toContainText(
                c.homeTitle,
              );
              for (const width of [390, 320]) {
                await page.setViewportSize({ width, height: 844 });
                await overflow(page);
              }
              await page.locator(".install-home .button").click();
              await expect(page.getByRole("dialog")).toBeVisible();
              await expect(page.locator(".install-guide h2")).toHaveText(
                c.title,
              );
              await expect(page.locator(".install-guide li")).toHaveCount(3);
              await expect(
                page.locator(".install-guide li").first(),
              ).toContainText(name === "webkit" ? "Safari" : "Chrome");
              assert.equal(
                await page
                  .locator("body")
                  .evaluate((el) => getComputedStyle(el).overflow),
                "hidden",
              );
              await expect(page.locator(".install-close")).toBeFocused();
              await page.keyboard.press("Tab");
              assert.ok(
                await page.evaluate(
                  () => !!document.activeElement?.closest("dialog"),
                ),
                "native focus trap",
              );
              await overflow(page);
              const box = await page.locator(".install-guide").boundingBox();
              assert.ok(
                box && box.x >= 0 && box.x + box.width <= 320 && box.y >= 0,
              );
              await page.screenshot({
                path: join(artifacts, `${name}-${locale}-${theme}-guide.png`),
                animations: "disabled",
              });
              await page.keyboard.press("Escape");
              await expect(page.getByRole("dialog")).toHaveCount(0);
              await expect(page.locator("main h1")).toBeFocused();
              assert.notEqual(
                await page
                  .locator("body")
                  .evaluate((el) => getComputedStyle(el).overflow),
                "hidden",
              );
              await page.locator('nav a[href="/profile"]').click();
              await expect(
                page.locator(".install-profile-button"),
              ).toBeVisible();
              await page.locator(".install-profile-button").click();
              await expect(page.getByRole("dialog")).toBeVisible();
              await page.locator(".install-close").click();
              await expect(
                page.locator(".install-profile-button"),
              ).toBeFocused();
              // Only reset feature storage for the next independent visual case.
              await page.evaluate((keys) => {
                localStorage.clear();
                sessionStorage.clear();
                void keys;
              }, INSTALL_KEYS);
            }
            assert.deepEqual(f.errors, []);
            assert.deepEqual(f.api, []);
            await context.close();
          }
          const third = await fresh(browser, device, "third");
          await third.page.goto(origin + "/profile");
          await expect(
            third.page.locator(".install-profile-button"),
          ).toBeVisible();
          await third.page.locator('nav a[href="/"]').click();
          await expect(third.page.locator(".install-reminder")).toBeVisible();
          await expect(third.page.locator(".install-home")).toHaveCount(0);
          await expect(third.page.getByRole("dialog")).toHaveCount(0);
          await third.page.locator('nav a[href="/schedule"]').click();
          await expect(third.page.locator(".install-reminder")).toHaveCount(0);
          await third.page.reload();
          await expect(third.page.locator(".install-reminder")).toHaveCount(0);
          await third.context.close();
          const dismiss = await fresh(browser, device, "third");
          await dismiss.page.goto(origin + "/");
          await expect(dismiss.page.locator(".install-reminder")).toBeVisible();
          await dismiss.page.locator(".install-reminder .text-link").click();
          await expect(dismiss.page.locator(".install-reminder")).toHaveCount(
            0,
          );
          const until = await dismiss.page.evaluate(
            (key) => Number(localStorage.getItem(key)),
            INSTALL_KEYS.dismissed,
          );
          assert.ok(until >= Date.now() + INSTALL_COOLDOWN - 5000);
          await dismiss.page.evaluate(() => sessionStorage.clear());
          await dismiss.page.reload();
          await expect(
            dismiss.page.locator(".install-reminder,.install-home"),
          ).toHaveCount(0);
          await dismiss.page.locator('nav a[href="/profile"]').click();
          await expect(
            dismiss.page.locator(".install-profile-button"),
          ).toBeVisible();
          await dismiss.context.close();
          for (const signal of ["standalone", "iosStandalone"] as const) {
            const f = await fresh(browser, device, signal);
            await f.page.goto(origin + "/");
            await expect(
              f.page.locator(".install-home,.install-reminder"),
            ).toHaveCount(0);
            await f.page.locator('nav a[href="/profile"]').click();
            await expect(f.page.locator(".install-profile")).toContainText(
              installCopy("ru").installed,
            );
            await expect(f.page.locator(".install-profile-button")).toHaveCount(
              0,
            );
            await f.context.close();
          }
          const blocked = await fresh(browser, device, "denied");
          await blocked.page.goto(origin + "/");
          await expect(blocked.page.locator(".install-home")).toBeVisible();
          await expect(blocked.page.locator(".install-reminder")).toHaveCount(
            0,
          );
          await blocked.page.locator(".install-home .button").click();
          await expect(blocked.page.getByRole("dialog")).toBeVisible();
          await blocked.page.locator(".install-close").click();
          assert.deepEqual(blocked.errors, []);
          await blocked.context.close();
          const quiet = await fresh(browser, device, "third");
          for (const route of ["/profile", "/admin", "/books/demo/read"]) {
            await quiet.page.goto(origin + route);
            await expect(quiet.page.locator(".install-reminder")).toHaveCount(
              0,
            );
          }
          await quiet.context.close();
          const reduced = await fresh(browser, device);
          await reduced.page.emulateMedia({ reducedMotion: "reduce" });
          await reduced.page.goto(origin + "/");
          await expect(reduced.page.locator(".install-home")).toBeVisible();
          await reduced.page.locator(".install-home .button").click();
          assert.equal(
            await reduced.page
              .locator("dialog")
              .evaluate((el) => getComputedStyle(el).animationName),
            "none",
          );
          await reduced.page.mouse.click(5, 5);
          await expect(reduced.page.getByRole("dialog")).toHaveCount(0);
          await reduced.context.close();
          t.diagnostic(
            `${name}: RU/KK/EN, light/dark, 390/320px, focus/Escape/backdrop, standalone, 3 visits, 7-day dismissal, storage denied, once/session, zero API requests: pass`,
          );
        } finally {
          await browser.close();
        }
      }
      const browser = await chromium.launch();
      try {
        // Explicit event-boundary fixtures; no claim of actual OS installation.
        const f = await fresh(browser, devices["Pixel 7"]);
        await f.page.goto(origin + "/profile?locale=en");
        await expect(f.page.locator(".install-profile-button")).toBeEnabled();
        // Plain browser JS avoids tsx's function-name helper in serialized
        // object methods. This is the browser event boundary, not a UI mock.
        await f.page.evaluate(`(()=>{
          let calls=0;
          const event=Object.assign(new Event("beforeinstallprompt",{cancelable:true}),{
            prompt:async()=>{calls++;document.documentElement.dataset.promptCalls=String(calls);},
            userChoice:Promise.resolve({outcome:"dismissed"})
          });
          dispatchEvent(event);
        })()`);
        assert.equal(
          await f.page.locator("html").getAttribute("data-prompt-calls"),
          null,
        );
        await f.page.locator(".install-profile-button").click();
        await expect(f.page.locator(".install-native")).toBeVisible();
        await f.page.locator(".install-native").click();
        await expect(f.page.locator("html")).toHaveAttribute(
          "data-prompt-calls",
          "1",
        );
        await expect(f.page.locator(".install-native")).toHaveCount(0);
        await expect(f.page.locator("dialog li")).toHaveCount(3);
        await f.page.keyboard.press("Escape");
        await f.page.evaluate(() => dispatchEvent(new Event("appinstalled")));
        await expect(f.page.locator(".install-profile")).toContainText(
          "NIS Hub is installed",
        );
        assert.deepEqual(f.errors, []);
        assert.deepEqual(f.api, []);
        await f.context.close();
        for (const [ua, note] of [
          [
            devices["iPhone 13"].userAgent.replace(
              /Version\/[\d.]+/,
              "CriOS/130.0",
            ),
            installCopy("en").safariNote,
          ],
          [
            devices["Pixel 7"].userAgent + " SamsungBrowser/26",
            installCopy("en").androidNote,
          ],
        ]) {
          const context = await browser.newContext({
              ...devices["Pixel 7"],
              userAgent: ua,
            }),
            page = await context.newPage();
          await page.goto(origin + "/profile?locale=en");
          await page.locator(".install-profile-button").click();
          await expect(page.locator(".install-browser-note")).toHaveText(note);
          await expect(page.locator("dialog li,.install-native")).toHaveCount(
            0,
          );
          await context.close();
        }
        const desktop = await browser.newContext({
            viewport: { width: 1440, height: 900 },
          }),
          page = await desktop.newPage();
        await page.goto(origin + "/");
        await expect(
          page.locator(".install-home,.install-reminder"),
        ).toHaveCount(0);
        await page.locator('nav a[href="/profile"]').click();
        await page.locator(".install-profile-button").click();
        await expect(page.locator(".install-browser-note")).toContainText(
          installCopy("ru").desktopNote,
        );
        await overflow(page);
        await desktop.close();
      } finally {
        await browser.close();
      }
    } finally {
      server.close();
      await once(server, "close");
    }
  },
);
