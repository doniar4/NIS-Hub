import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Run against a local server: node --import tsx --test tests/welcome-design-browser.smoke.ts
test("welcome depth, delayed cue, shader and accessible auth modes", { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.NIS_BROWSER_BASE_URL || "http://localhost:3000");
    await expect(page.locator(".welcome-scroll-cue")).toHaveCount(0);
    await expect(page.locator(".welcome-scroll-cue")).toBeVisible({ timeout: 10_000 });
    const tablet = await page.locator(".welcome-hardware-tablet").boundingBox();
    const laptop = await page.locator(".welcome-hardware-laptop").boundingBox();
    assert.ok(tablet && laptop && tablet.x + tablet.width < laptop.x);
    const phone = page.locator(".welcome-hardware-phone");
    await page.mouse.move(1100, 350);
    await expect.poll(() => phone.evaluate(el => el.style.translate)).not.toBe("");
    await page.locator(".welcome-scroll-cue").click();
    await expect(page.locator(".welcome-scroll-cue")).toHaveCount(0);
    await expect(page.locator('[role="tab"][data-mode="signup"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const login = page.locator('[role="tab"][data-mode="login"]');
    await expect(login).toHaveAttribute("aria-selected", "true");
    await expect(login).toBeFocused();
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const colors = await page.locator(".welcome-auth-tabs").evaluate(el => ({
        active: getComputedStyle(el.querySelector('[aria-selected="true"]')!).backgroundColor,
        track: getComputedStyle(el).backgroundColor,
      }));
      assert.notEqual(colors.active, colors.track);
    }
    const canvas = page.locator(".shader-background");
    assert.ok(await canvas.evaluate(el => el instanceof HTMLCanvasElement && el.width > 1 && el.height > 1 && !!el.getContext("webgl")));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".welcome-motion-control")).toHaveCount(0);
    await expect(login).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
