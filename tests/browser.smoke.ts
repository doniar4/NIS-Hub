import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as proxyRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { build } from "esbuild";
import { chromium, webkit, expect } from "@playwright/test";
import sharp from "sharp";
import { themeBootstrap } from "../src/lib/theme";
import { classes, subjects, books } from "./browser/fixtures";
import { dictionaries } from "../src/lib/i18n";

const app = process.env.NIS_BROWSER_BASE_URL || "http://127.0.0.1:3101";
const artifactDir = process.env.NIS_BROWSER_ARTIFACTS || "/private/tmp/nis-phase3-browser-results";

test("Phase 3 Chromium and WebKit browser verification", { timeout: 180_000 }, async t => {
  const bundle = await build({ entryPoints: [resolve("tests/browser/harness.tsx")], bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic", define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) }, logLevel: "silent" });
  const cssDir = resolve(".next/static/css");
  const css = readdirSync(cssDir).filter(name => name.endsWith(".css")).map(name => readFileSync(join(cssDir, name), "utf8")).join("\n");
  const avatar = await sharp({ create: { width: 96, height: 96, channels: 3, background: "#258060" } }).webp().toBuffer();
  const fixture = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://fixture.test").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); }
    else if (pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
    else if (pathname === "/avatar-expired.webp") { res.statusCode = 403; res.end("Expired synthetic fixture URL"); }
    else if (pathname === "/avatar-valid.webp") { res.setHeader("Content-Type", "image/webp"); res.end(avatar); }
    else if (pathname === "/favicon.ico") { res.statusCode = 204; res.end(); }
    else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>' + themeBootstrap + '</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  const address = fixture.address(); assert.ok(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  mkdirSync(artifactDir, { recursive: true });
  // Production locale cookies are Secure. Safari correctly requires HTTPS.
  // Test-only TLS proxy; do not weaken production cookie settings for localhost.
  const tlsDir = mkdtempSync("/private/tmp/nis-phase3-tls-");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(tlsDir, "key.pem"),
    "-out", join(tlsDir, "cert.pem"), "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
  const secure = createHttpsServer({ key: readFileSync(join(tlsDir, "key.pem")), cert: readFileSync(join(tlsDir, "cert.pem")) }, (req, res) => {
    const upstream = proxyRequest(app + req.url, { method: req.method, headers: { ...req.headers,
      "x-forwarded-host": req.headers.host, "x-forwarded-proto": "https" } }, response => {
      res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
    });
    upstream.on("error", () => { res.statusCode = 502; res.end("Local test upstream unavailable"); });
    req.pipe(upstream);
  });
  secure.listen(0, "127.0.0.1"); await once(secure, "listening");
  const secureAddress = secure.address(); assert.ok(secureAddress && typeof secureAddress !== "string");
  const publicApp = "https://127.0.0.1:" + secureAddress.port;
  try {
    for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]] as const) {
      const browser = await engine.launch({ headless: true });
      try {
        await t.test(name + ": instant filtering changes DOM and URL with ZERO requests or document navigation", async () => {
          const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
          await page.goto(origin + "/library?q=алгебра&classId=" + classes[0].id + "&subject=" + subjects[0].id);
          await expect(page.getByRole("searchbox")).toHaveValue("алгебра");
          await expect(page.getByRole("combobox", { name: "Class", exact: true })).toHaveValue(classes[0].id);
          await expect(page.locator("section li")).toHaveCount(books.filter(book => book.title.startsWith("Алгебра") && book.class_id === classes[0].id).length);
          await page.waitForLoadState("networkidle");
          const requests: string[] = []; page.on("request", request => requests.push(request.method() + " " + new URL(request.url()).pathname));
          await page.evaluate(() => { (window as unknown as { fixtureDocument: string }).fixtureDocument = "unchanged"; });
          await page.getByRole("searchbox").fill("Physics");
          await expect(page.getByRole("heading", { name: "No materials found" })).toBeVisible();
          await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption("");
          await page.getByRole("combobox", { name: "Class", exact: true }).selectOption(classes[1].id);
          await expect(page.locator("section li")).toHaveCount(books.filter(book => book.title.startsWith("Physics") && book.class_id === classes[1].id).length);
          assert.ok(page.url().includes("q=Physics"));
          await page.getByRole("button", { name: "Reset filters" }).focus();
          await page.keyboard.press("Enter");
          await expect(page.locator("section li")).toHaveCount(125);
          await expect(page.getByRole("searchbox")).toHaveValue("");
          await page.getByRole("searchbox").fill("NO MATCH");
          await page.getByRole("button", { name: "Simulate fresh route props" }).click();
          await expect(page.getByRole("searchbox")).toHaveValue("");
          await expect(page.locator("section li")).toHaveCount(125);
          await page.getByRole("searchbox").fill("NO MATCH AGAIN");
          await page.getByRole("button", { name: "Simulate fresh route props" }).click();
          await expect(page.getByRole("searchbox")).toHaveValue("");
          await expect(page.locator("section li")).toHaveCount(125);
          assert.equal(await page.evaluate(() => (window as unknown as { fixtureDocument: string }).fixtureDocument), "unchanged");
          assert.deepEqual(requests, []);
          await page.screenshot({ path: join(artifactDir, name + "-library.png") });
          t.diagnostic(name + ": filter requests=0; document retained;125 books reset; query restored");
          await page.close();
        });
        await t.test(name + ": keyboard Top4 uniqueness, translated subjects, expired avatar recovery and manual import preview", async () => {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
          await page.goto(origin + "/profile");
          await expect(page.getByLabel("Subject 2").locator('option[value="' + subjects[0].id + '"]')).toHaveJSProperty("disabled", true);
          await page.getByLabel("Subject 2").selectOption(subjects[1].id);
          await expect(page.getByLabel("Subject 3").locator('option[value="' + subjects[1].id + '"]')).toHaveJSProperty("disabled", true);
          await page.getByLabel("Subject 1").selectOption("");
          await expect(page.getByLabel("Subject 3").locator('option[value="' + subjects[0].id + '"]')).toHaveJSProperty("disabled", false);
          await page.getByLabel("Subject 3").focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
          await page.getByRole("button", { name: "Save Top 4 fixture" }).click();
          const values = JSON.parse(await page.getByTestId("submission").textContent() || "[]").filter(Boolean);
          assert.equal(new Set(values).size, values.length);
          await expect(page.getByText("Avatar unavailable", { exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Retry", exact: true }).click();
          await expect(page.getByRole("img", { name: "Avatar", exact: true })).toBeVisible();
          await expect.poll(() => page.getByRole("img", { name: "Avatar", exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(96);
          const payload = { version: 1, lessons: [{ class_id: classes[0].id, subject_id: subjects[0].id, date: "2026-09-14", lesson_number: 1 }] };
          await page.getByLabel("Timetable JSON file").setInputFiles({ name: "invalid-fixture.json", mimeType: "application/json", buffer: Buffer.from("{invalid") });
          await expect(page.getByRole("alert")).toBeVisible();
          await expect(page.getByRole("button", { name: "Import reviewed lessons" })).toHaveCount(0);
          await page.getByLabel("Timetable JSON file").setInputFiles({ name: "authorised-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) });
          await expect(page.getByRole("table")).toBeVisible();
          await page.getByRole("checkbox").check();
          await page.getByRole("button", { name: "Import reviewed lessons" }).click();
          await expect(page.getByText("Fixture accepted", { exact: true })).toBeVisible();
          await page.getByLabel("Interface language").selectOption("ru");
          await expect(page.getByLabel("Предмет 2").locator("option:checked")).toHaveText("Физика");
          await page.getByLabel("Язык интерфейса").selectOption("kk");
          await expect(page.getByLabel("Пән 2").locator("option:checked")).toHaveText("Физика");
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({ path: join(artifactDir, name + "-profile-fixture.png"), fullPage: true });
          await page.close();
        });
        await t.test(name + ": REAL Next public pages — theme, locale cookies/reload, legal drafts and private-access boundaries", async () => {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "light", ignoreHTTPSErrors: true });
          const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
          await page.goto(publicApp + "/privacy", { waitUntil: "networkidle" });
          await expect(page.getByRole("heading", { level: 1 })).toHaveText("Политика конфиденциальности");
          await page.getByLabel("Тема", { exact: true }).selectOption("dark");
          await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
          await page.reload({ waitUntil: "networkidle" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
          await page.getByLabel("Тема", { exact: true }).selectOption("light");
          await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
          await page.getByLabel("Тема", { exact: true }).selectOption("system");
          await page.emulateMedia({ colorScheme: "dark" });
          await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
          for (const locale of ["kk", "en", "ru"] as const) {
            await page.locator('select').filter({ has: page.locator('option[value="kk"]') }).selectOption(locale);
            await expect(page.locator("html")).toHaveAttribute("lang", locale);
            await page.waitForLoadState("networkidle");
            await page.reload({ waitUntil: "networkidle" }); await expect(page.locator("html")).toHaveAttribute("lang", locale);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText({ ru: "Политика конфиденциальности", kk: "Құпиялық саясаты", en: "Privacy Policy" }[locale]);
            await page.goto(publicApp + "/terms", { waitUntil: "networkidle" });
            await expect(page.getByRole("heading", { level: 1 })).toHaveText({ ru: "Условия использования", kk: "Пайдалану шарттары", en: "Terms of Use" }[locale]);
            await expect(page.getByText(dictionaries[locale].privacy, { exact: true }).first()).toBeVisible();
            await page.goto(publicApp + "/privacy", { waitUntil: "networkidle" });
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({ path: join(artifactDir, name + "-privacy-dark-mobile.png"), fullPage: true });
          await page.goto(publicApp + "/library", { waitUntil: "networkidle" }); await expect(page).toHaveURL(/\/login\?next=/);
          await page.goto(publicApp + "/admin", { waitUntil: "networkidle" }); await expect(page).toHaveURL(/\/login\?next=/);
          const response = await page.request.get(publicApp + "/api/books/00000000-0000-4000-8000-000000000030/access");
          assert.equal(response.status(), 401); assert.ok(!(await response.text()).includes("signedURL"));
          assert.deepEqual(errors, []);
          await page.close();
        });
      } finally { await browser.close(); }
    }
  } finally { await Promise.all([fixture, secure].map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))); }
});
