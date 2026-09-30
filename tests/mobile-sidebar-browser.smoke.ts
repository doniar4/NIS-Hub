import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {mkdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {build} from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import {chromium, expect} from "@playwright/test";

const artifacts = process.env.NIS_BROWSER_ARTIFACTS ?? "/tmp/nis-mobile-sidebar";

test("mobile sidebar works at 320px and 390px", {timeout:60_000}, async () => {
  mkdirSync(artifacts, {recursive:true});
  const [bundle, css] = await Promise.all([
    build({
      entryPoints:["tests/browser/mobile-sidebar-harness.tsx"],
      bundle:true,
      write:false,
      format:"esm",
      platform:"browser",
      jsx:"automatic",
      define:{"process.env":JSON.stringify({NODE_ENV:"production"})},
      plugins:[{
        name:"navigation-fixture",
        setup(api) {
          api.onResolve({filter:/^next\/navigation$/}, () => ({path:"navigation", namespace:"fixture"}));
          api.onLoad({filter:/.*/, namespace:"fixture"}, () => ({
            contents:'export const usePathname=()=>location.pathname;',
            loader:"js",
          }));
        },
      }],
    }),
    postcss([tailwindcss()]).process(readFileSync("src/app/globals.css", "utf8"), {
      from:"src/app/globals.css",
    }),
  ]);

  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css.css);
      return;
    }
    response.setHeader("Content-Type", "text/html;charset=utf-8");
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const menu = page.locator(".mobile-menu");
    const drawer = page.locator(".mobile-drawer");
    const panel = page.locator(".mobile-drawer-panel");

    const menuBox = await menu.boundingBox();
    assert.ok(menuBox && menuBox.width >= 43.5 && menuBox.height >= 43.5);
    await menu.click();
    await expect(drawer).toHaveAttribute("open", "");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("body")).toHaveAttribute("data-mobile-navigation-open", "");
    assert.equal(await page.locator("body").evaluate(element => getComputedStyle(element).overflow), "hidden");
    await expect(panel.locator('.sidebar-link[href="/"]')).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(400);
    const closeBox = await page.locator(".mobile-drawer-close").boundingBox();
    assert.ok(closeBox && closeBox.width >= 43.5 && closeBox.height >= 43.5, JSON.stringify(closeBox));
    await page.screenshot({path:join(artifacts,"sidebar-390.png"), animations:"disabled"});

    const overlayBox = await drawer.boundingBox();
    assert.ok(overlayBox);
    await page.mouse.click(overlayBox.x + overlayBox.width - 6, overlayBox.y + overlayBox.height / 2);
    await expect(drawer).not.toHaveAttribute("open", "");
    await expect(menu).toBeFocused();
    await expect(page.locator("body")).not.toHaveAttribute("data-mobile-navigation-open", "");

    await page.setViewportSize({width:320,height:700});
    await menu.click();
    const panelBox = await panel.boundingBox();
    assert.ok(panelBox && panelBox.x >= 0 && panelBox.x + panelBox.width <= 320);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await page.screenshot({path:join(artifacts,"sidebar-320.png"), animations:"disabled"});
    await page.keyboard.press("Escape");
    await expect(drawer).not.toHaveAttribute("open", "");
    await expect(menu).toBeFocused();

    await menu.click();
    await page.setViewportSize({width:800,height:700});
    await expect(drawer).not.toHaveAttribute("open", "");
    await page.close();
  } finally {
    await browser.close();
    server.close();
    await once(server, "close");
  }
});
