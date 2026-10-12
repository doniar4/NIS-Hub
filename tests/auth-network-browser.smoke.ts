import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

test(
  "light and dark login stays clickable on slow Wi-Fi when the decorative chunk fails",
  { timeout: 90000 },
  async () => {
    const bundle = await build({
      entryPoints: ["tests/browser/auth-network-harness.tsx"],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        {
          name: "auth-fixture",
          setup(api) {
            api.onResolve({ filter: /^next\/dynamic$/ }, () => ({
              path: "dynamic",
              namespace: "fixture",
            }));
            api.onResolve({ filter: /^next\/link$/ }, () => ({
              path: "link",
              namespace: "fixture",
            }));
            api.onResolve(
              { filter: /^@\/components\/ui\/shader-background$/ },
              () => ({ path: "shader", namespace: "fixture" }),
            );
            api.onResolve({ filter: /^@\/app\/actions\/auth$/ }, () => ({
              path: "actions",
              namespace: "fixture",
            }));
            api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
              loader: "jsx",
              resolveDir: process.cwd(),
              contents:
                path === "dynamic"
                  ? 'import React from "react";export default function dynamic(load){const Component=React.lazy(load);return ()=> <React.Suspense fallback={null}><Component/></React.Suspense>;}'
                  : path === "link"
                    ? "export default function Link({prefetch,...props}){return <a {...props}/>;}"
                    : path === "shader"
                      ? 'throw new Error("Decorative chunk network failure");export default function Shader(){return null;}'
                      : "export async function startSocialSignIn(){return {}};",
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
    let attempts = 0;
    const server = createServer(async (req, res) => {
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (req.url === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else if (req.url === "/fixture/authenticate") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const input = JSON.parse(Buffer.concat(chunks).toString());
        assert.equal(input.email, "fixture@example.org");
        assert.equal(input.password, "fixture-password");
        attempts++;
        res.setHeader("Content-Type", "application/json");
        if (input.mode === "signup") assert.equal(input.terms, "on");
        res.end(
          JSON.stringify({
            success:
              input.mode === "signup" ? "Подтвердите email" : "Вход выполнен",
          }),
        );
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
        );
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
          }),
          errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript((t) => {
          localStorage.setItem("nis-theme", t);
        }, theme);
        const session = await page.context().newCDPSession(page);
        await session.send("Network.enable");
        await session.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 250,
          downloadThroughput: 128 * 1024,
          uploadThroughput: 64 * 1024,
          connectionType: "wifi",
        });
        await page.goto(
          `http://127.0.0.1:${address.port}/?auth=login#welcome-auth`,
        );
        const form = page.locator('[role="tabpanel"]:visible form');
        await expect(form).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        assert.equal(
          await page
            .locator(".welcome-auth-panel")
            .evaluate((el) => getComputedStyle(el).opacity),
          "1",
        );
        await form.locator('input[type="email"]').fill("fixture@example.org");
        await form.locator('input[type="password"]').fill("fixture-password");
        await form.getByRole("button", { name: "Войти", exact: true }).click();
        await expect(
          page.getByText("Вход выполнен", { exact: true }),
        ).toBeVisible();
        await page.locator('[data-mode="signup"]').click();
        await expect(page.locator('[data-mode="signup"]')).toHaveAttribute(
          "aria-selected",
          "true",
        );
        const signup = page.locator('[role="tabpanel"]:visible form');
        await signup.locator('input[type="email"]').fill("fixture@example.org");
        await signup.locator('input[type="password"]').fill("fixture-password");
        const beforeSignup = attempts;
        await signup
          .getByRole("button", { name: "Зарегистрироваться", exact: true })
          .click();
        assert.equal(
          attempts,
          beforeSignup,
          "registration must require terms consent",
        );
        await expect(signup.locator('[name="terms"]:invalid')).toHaveCount(1);
        await signup.locator('[name="terms"]').check();
        await signup
          .getByRole("button", { name: "Зарегистрироваться", exact: true })
          .click();
        await expect(
          page.getByText("Подтвердите email", { exact: true }),
        ).toBeVisible();
        await page.locator('[data-mode="signup"]').focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.locator('[data-mode="login"]')).toHaveAttribute(
          "aria-selected",
          "true",
        );
        assert.equal(
          await page
            .locator('[role="tabpanel"]:visible')
            .evaluate((el) => getComputedStyle(el).opacity),
          "1",
          "switching auth modes never fades the form to white",
        );
        assert.equal(
          await page.locator('[data-mode="login"]').getAttribute("href"),
          "/?auth=login&next=%2Fschedule#welcome-auth",
        );
        assert.deepEqual(errors, []);
        mkdirSync("test-results/auth-network", { recursive: true });
        await page.screenshot({
          path: `test-results/auth-network/${theme}.png`,
        });
        await page.close();
      }
      assert.equal(attempts, 4);
    } finally {
      await browser?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
