import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import sharp from "sharp";
import { chromium, webkit, expect, type Page } from "@playwright/test";

async function inspectScrollLayers(page: Page) {
  const state = await page.evaluate(() => {
    const main = document.querySelector(".app-main")!;
    const top = document.querySelector(".app-topbar")!.getBoundingClientRect();
    const nav = document.querySelector(".mobile-bottom-nav")!.getBoundingClientRect();
    // Hit-test the actual content, not just DOM presence. A full-page dimming
    // element above it (including pointer-events:none) must fail this check.
    const y = Math.min(innerHeight - 100, Math.max(top.bottom + 30, innerHeight / 2));
    const blockers = [...document.querySelectorAll("body *")].filter(el => {
      if (el === main || el.contains(main) || main.contains(el) || el.closest(".ambient-background")) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0 &&
        ["fixed", "absolute"].includes(s.position) && r.width >= innerWidth * .9 && r.height >= innerHeight * .7 &&
        r.top < y && r.bottom > y;
    }).map(el => el.className);
    return {
      openDialogs: document.querySelectorAll("dialog[open]").length,
      modal: document.body.hasAttribute("data-mobile-navigation-open"), blockers,
      hitContent: document.elementsFromPoint(innerWidth / 2, y).some(el => el === main || main.contains(el)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      topVisible: top.top >= 0 && top.bottom < innerHeight,
      navBottom: nav.bottom, height: innerHeight,
      stableAncestors: [".app-frame", ".app-content", ".app-main"].map(selector => {
        const s = getComputedStyle(document.querySelector(selector)!);
        return { transform: s.transform, filter: s.filter };
      }),
    };
  });
  assert.equal(state.openDialogs, 0, "no modal opens while scrolling");
  assert.equal(state.modal, false, "drawer scroll-lock flag stays absent");
  assert.deepEqual(state.blockers, [], "no visible viewport-sized overlay, even non-interactive ones");
  assert.equal(state.hitContent, true, "schedule content remains in the hit-tested stack");
  assert.equal(state.overflow, false, "no horizontal overflow");
  assert.equal(state.topVisible, true, "sticky topbar remains visible");
  assert.ok(Math.abs(state.navBottom - (state.height - 8)) <= 2, "bottom navigation stays fixed");
  for (const s of state.stableAncestors) assert.deepEqual(s, { transform: "none", filter: "none" });
}

async function checkPanelPixels(page: Page, label: string, theme: "light" | "dark") {
  const sample = await page.locator(".schedule-lessons").evaluate(el => {
    const r = el.getBoundingClientRect(), top = document.querySelector(".app-topbar")!.getBoundingClientRect();
    return { x: Math.round(r.left + 8), y: Math.round(Math.max(top.bottom + 12, Math.min(innerHeight - 100, r.top + 30))) };
  });
  const screenshot = await page.screenshot();
  const pixel = await sharp(screenshot).extract({ left: sample.x, top: sample.y, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  const readable = theme === "light" ? pixel.every(channel => channel > 180) : pixel[0] < 100 && pixel[2] > pixel[0] + 8;
  if (!readable) {
    await page.screenshot({ path: join("test-results", "mobile-schedule-scroll", "gray-repaint-failure.png") });
    const diagnostic = await page.evaluate(({ x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>(".ambient-background canvas")!;
      const gl = canvas.getContext("webgl")!, rgb = new Uint8Array(4), r = canvas.getBoundingClientRect();
      gl.readPixels(Math.round((x-r.left)*canvas.width/r.width), Math.round((r.bottom-y)*canvas.height/r.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgb);
      return { canvasPixel: [...rgb], contextLost: gl.isContextLost(), panel: getComputedStyle(document.querySelector(".schedule-lessons")!).backgroundColor };
    }, sample);
    assert.fail(`${label}: gray panel ${[...pixel]}; ${JSON.stringify(diagnostic)}`);
  }
  assert.ok(readable, `${label}: ${theme} lesson panel must not become gray (${[...pixel]})`);
}

test("Mobile Schedule scroll layers: no gray WebGL resize frame in WebKit/Chromium, no unintended overlay", { timeout: 180000 }, async () => {
  const [bundle, css] = await Promise.all([
    build({ entryPoints: ["tests/browser/mobile-schedule-scroll-harness.tsx"], bundle: true, write: false,
      platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
      plugins: [{ name: "isolated-schedule", setup(api) {
        api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
        api.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
        api.onResolve({ filter: /^@\/app\/actions\/(homework|community-safety)$/ }, () => ({ path: "actions", namespace: "fixture" }));
        api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "jsx", resolveDir: process.cwd(), contents: path === "navigation"
          ? 'export const usePathname=()=>"/schedule";export const useRouter=()=>({prefetch(){},refresh(){}});'
          : path === "link" ? 'export default function Link({prefetch,...props}){return <a {...props}/>;}'
          : 'export const loadDailyHomework=async()=>({data:[]});export const loadHomework=loadDailyHomework;export const saveHomework=async()=>({ok:true});export const deleteHomework=saveHomework;export const safetyAction=saveHomework;' }));
      } }],
    }),
    postcss([tailwindcss()]).process(readFileSync("src/app/globals.css", "utf8") + "\n" + readFileSync("src/styles/mobile.css", "utf8"), { from: "src/app/globals.css" }),
  ]);
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://fixture").pathname;
    if (path === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); }
    else if (path === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const artifacts = join("test-results", "mobile-schedule-scroll"); mkdirSync(artifacts, { recursive: true });
  try {
    for (const [name, engine] of [["webkit", webkit], ["chromium", chromium]] as const) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${address.port}/schedule`);
        await expect(page.locator(".lesson-row")).toHaveCount(12);
        await page.waitForTimeout(600); // Let the existing entrance animation finish.
        for (const theme of ["light", "dark"] as const) {
          await page.locator(`.theme-switch input[value=${theme}]`).check();
          for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => window.scrollTo(0, 0));
            const surfaces = await page.locator(".app-topbar, .mobile-bottom-nav, .app-topbar .global-search, .app-topbar .theme-switch, .app-topbar select.field, .app-topbar .mobile-menu").evaluateAll(elements => elements.map(el => {
              const s = getComputedStyle(el);
              return { className: el.className, blur: s.backdropFilter, prefixed: s.getPropertyValue("-webkit-backdrop-filter") };
            }));
            for (const s of surfaces) {
              if (["app-topbar", "mobile-bottom-nav", "global-search"].includes(s.className))
                assert.match(s.blur, /blur\(/, `${s.className}: existing glass remains enabled`);
            }
            // Normal scroll, fast frame-to-frame direction changes, both edges.
            for (const offset of [0, 120, 360, 720, 1300, 10000, 800, 100, 0]) {
              await page.evaluate(async y => { window.scrollTo(0, y); await new Promise(requestAnimationFrame); }, offset);
              await inspectScrollLayers(page);
              await checkPanelPixels(page, `${name}/${width}/scroll=${offset}`, theme);
            }
            // Reduced viewport is a proxy for browser chrome resizing, NOT a real iOS toolbar test.
            for (const height of [700, 844]) {
              const before = await page.locator(".lesson-row").nth(1).evaluate(el => el.getBoundingClientRect().top + scrollY);
              await page.setViewportSize({ width, height });
              await page.evaluate(() => window.scrollTo(0, 500)); await inspectScrollLayers(page);
              await checkPanelPixels(page, `${name}/${width}/height=${height}`, theme);
              const after = await page.locator(".lesson-row").nth(1).evaluate(el => el.getBoundingClientRect().top + scrollY);
              assert.ok(Math.abs(before - after) < 1, "viewport-height changes do not jump lesson layout");
            }
            await page.screenshot({ path: join(artifacts, `${name}-${width}-${theme}-scroll.png`) });
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.getByRole("tab").nth(1).click();
            await expect(page.locator(".schedule-lessons time")).toHaveAttribute("datetime", "2026-10-06");
            await page.getByRole("tab").nth(0).click();
            await expect(page.locator(".schedule-lessons time")).toHaveAttribute("datetime", "2026-10-05");
            await inspectScrollLayers(page);
            await page.locator(".mobile-menu").click();
            await expect(page.locator(".mobile-drawer")).toHaveAttribute("open", "");
            await page.locator(".mobile-drawer-close").click();
            await expect(page.locator("body")).not.toHaveAttribute("data-mobile-navigation-open", "");
            await expect(page.locator(".mobile-menu")).toBeFocused(); await inspectScrollLayers(page);
          }
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        assert.match(await page.locator(".app-topbar").evaluate(el => getComputedStyle(el).backdropFilter), /blur\(/, "desktop glass remains enabled");
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
