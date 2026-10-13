import {readerActionBoundary} from "./browser/reader-action-boundary";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { themeBootstrap } from "../src/lib/theme";
import { subjects } from "./browser/fixtures";

const publicOrigin = process.env.NIS_PUBLIC_BASE_URL ?? "http://localhost:3000";
const artifacts = process.env.NIS_BROWSER_ARTIFACTS ?? "/tmp/nis-redesign-results";

function isolatedBoundaries() {
  return {
    name: "isolated-boundaries",
    setup(api: import("esbuild").PluginBuild) {
      api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      api.onResolve({ filter: /^@\/lib\/(supabase\/client|community-client)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
      api.onResolve({ filter: /^@\/app\/actions\// }, (args) => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => {
        const rpc = 'const rpc=async(name,args)=>(await fetch("/rpc",{method:"POST",body:JSON.stringify({name,args})})).json();';
        const contents = args.path === "navigation"
          ? 'export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){},replace(url){history.replaceState(null,"",url);}});'
          : args.path.endsWith("community-client")
            ? "export const loadNotifications=async()=>({data:[],unread:0});export const dismissNotification=async()=>({success:true});export const blockPerson=async()=>({success:true});export const reportContent=async()=>({success:true});"
            : args.path.endsWith("supabase/client")
              ? "export const createClient=()=>({storage:{from:()=>({upload:async()=>({error:null})})}});"
              : args.path.endsWith("reading")
                ? rpc + 'export const saveReading=(...args)=>rpc("reading",args);'
                : args.path.endsWith("homework")
                  ? rpc + 'export const loadHomework=(...args)=>rpc("homework",args);export const loadDailyHomework=(...args)=>rpc("homework",args);export const saveHomework=async()=>({success:true});export const deleteHomework=async()=>({success:true});'
                  : args.path.endsWith("sms")
                    ? 'export const refreshSms=async()=>({connected:false});export const connectSms=async()=>({connected:false});export const continueSmsLogin=async()=>({connected:false});export const sendSmsLoginCode=async()=>({connected:false});export const cancelSmsLogin=async()=>({connected:false});export const disconnectSms=async()=>({connected:false});export const loadSmsSubject=async()=>({assessments:[]});'
                    : args.path.endsWith("ai-study")
                      ? 'export const generateStudy=async()=>({response:{insufficient:true,sections:[]},source:{start:1,end:1}});'
                      : args.path.endsWith("study-answers")
                        ? 'export const reviewStudyAnswers=async()=>({error:"failed"});'
                        : args.path.endsWith("edupage")
                          ? 'export const syncEduPage=async()=>({error:"unavailable"});'
                          : args.path.endsWith("tasks")
                            ? 'export const safetyAction=async()=>({success:true});export const savePersonalTask=async()=>({success:true});export const setPersonalTaskStatus=async()=>({success:true});export const snoozePersonalTask=async()=>({success:true});'
                            : "export const safetyAction=async()=>({success:true});";
        return { contents, loader: "js" };
      });
    },
  } satisfies import("esbuild").Plugin;
}

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.locator(`.theme-switch label:has(> input[value="${theme}"])`).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.right > innerWidth + 2 || box.left < -2;
      })
      .slice(0, 8)
      .map((element) => ({ className: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })),
  }));
  assert.ok(overflow.document <= overflow.viewport + 2, JSON.stringify(overflow));
}

test("reference redesign: welcome, signup and dashboard themes remain responsive", { timeout: 120_000 }, async () => {
  mkdirSync(artifacts, { recursive: true });

  const bundle = await build({
    entryPoints: ["tests/browser/liquid-glass-harness.tsx"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [readerActionBoundary,isolatedBoundaries()],
  });
  const css = readdirSync(".next/static/css")
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(".next/static/css", name), "utf8"))
    .join("\n");

  const dashboardServer = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
      return;
    }
    if (pathname.endsWith(".woff2")) {
      try {
        response.end(readFileSync(join(".next/static/media", basename(pathname))));
      } catch {
        response.statusCode = 404;
        response.end();
      }
      return;
    }
    if (/^[/]images[/]subjects[/][a-z]+[.]svg$/.test(pathname)) {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end(readFileSync(`public${pathname}`));
      return;
    }
    if (pathname === "/rpc") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString()) as { name: string; args: unknown[] };
      response.setHeader("Content-Type", "application/json");
      if (body.name === "homework") {
        response.end(JSON.stringify({ data: [] }));
        return;
      }
      response.end(JSON.stringify({ success: true }));
      return;
    }
    response.setHeader("Content-Type", "text/html;charset=utf-8");
    response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>${themeBootstrap};window.fixtureReading={page:1,bookmarks:[]}</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`);
  });
  dashboardServer.listen(0, "127.0.0.1");
  await once(dashboardServer, "listening");
  const address = dashboardServer.address();
  assert.ok(address && typeof address !== "string");
  const dashboardOrigin = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch({ headless: true });
  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await publicContext.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${publicOrigin}/`);
    await expect(page.locator(".welcome-screen")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: join(artifacts, "welcome-light.png"), fullPage: true, animations: "disabled" });

    await setTheme(page, "dark");
    await page.screenshot({ path: join(artifacts, "welcome-dark.png"), fullPage: true, animations: "disabled" });

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(page.locator(".welcome-cta")).toHaveCount(0);
    const ctaBox = await page.locator(".welcome-devices").boundingBox();
    assert.ok(ctaBox && ctaBox.height >= 44, "Device link keeps a comfortable touch target");
    await page.screenshot({ path: join(artifacts, "welcome-mobile-dark.png"), fullPage: true, animations: "disabled" });

    await page.locator(".welcome-devices").click();
    await expect(page.locator(".welcome-auth-panel")).toBeInViewport();
    await expect(page.locator('[role="tabpanel"]:visible input[name="email"]')).toBeVisible();
    await page.getByRole("tab").nth(1).click();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[role="tabpanel"]:visible input[name="terms"]')).toHaveCount(0);
    await page.getByRole("tab").nth(0).click();
    await expect(page.locator('[role="tabpanel"]:visible input[name="terms"]')).toBeVisible();

    await page.goto(`${publicOrigin}/signup`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, "light");
    await expect(page.locator(".welcome-screen")).toBeVisible();
    await expect(page.locator(".auth-experience")).toHaveCount(0);
    await expect(page.getByRole("tab").nth(0)).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: join(artifacts, "signup-light.png"), fullPage: true, animations: "disabled" });
    await setTheme(page, "dark");
    await page.screenshot({ path: join(artifacts, "signup-dark.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: join(artifacts, "signup-mobile-dark.png"), fullPage: true, animations: "disabled" });

    await page.goto(`${publicOrigin}/login?next=%2Fschedule`);
    await expect(page.locator(".welcome-screen")).toBeVisible();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[role="tabpanel"]:not([hidden]) input[name="next"]')).toHaveValue("/schedule");
    await expect(page.locator(".auth-experience")).toHaveCount(0);

    await page.goto(`${publicOrigin}/`);
    await expect(page.locator(".welcome-screen")).toBeVisible();
    assert.deepEqual(errors, []);
    await publicContext.close();

    const dashboardPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const dashboardErrors: string[] = [];
    dashboardPage.on("pageerror", (error) => dashboardErrors.push(error.message));
    await dashboardPage.goto(`${dashboardOrigin}/?locale=ru`);
    await expect(dashboardPage.locator(".lesson-status-bar")).toBeVisible();
    await expect(dashboardPage.locator(".home-timetable")).toBeVisible();
    assert.equal(await dashboardPage.locator(".dashboard-primary > *").count(), 3, "Current dashboard primary structure is preserved");
    await setTheme(dashboardPage, "light");
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.screenshot({ path: join(artifacts, "dashboard-light.png"), fullPage: true, animations: "disabled" });
    await setTheme(dashboardPage, "dark");
    await dashboardPage.screenshot({ path: join(artifacts, "dashboard-dark.png"), fullPage: true, animations: "disabled" });

    await dashboardPage.setViewportSize({ width: 390, height: 844 });
    const menuBox = await dashboardPage.locator(".mobile-menu").boundingBox();
    assert.ok(menuBox && menuBox.width >= 44 && menuBox.height >= 44, "Mobile menu keeps a 44px touch target");
    await dashboardPage.screenshot({ path: join(artifacts, "dashboard-mobile-dark.png"), fullPage: true, animations: "disabled" });
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.locator(".global-search button").click();
    await expect(dashboardPage.locator(".global-search")).toHaveAttribute("data-expanded", "true");
    await expect(dashboardPage.locator(".global-search input")).toBeFocused();
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.locator(".global-search input").press("Escape");
    await dashboardPage.locator(".mobile-menu").click();
    await expect(dashboardPage.locator(".mobile-drawer")).toBeVisible();
    await dashboardPage.locator(".mobile-drawer-close").click();
    await expect(dashboardPage.locator(".mobile-drawer")).toBeHidden();

    for (const width of [320, 360, 375, 390, 393, 430, 768, 1440]) {
      await dashboardPage.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await expectNoHorizontalOverflow(dashboardPage);
      if (width < 768) {
        await expect(dashboardPage.locator(".mobile-bottom-nav a")).toHaveCount(5);
        await expect(dashboardPage.locator('.mobile-bottom-nav a[aria-current="page"]')).toHaveCount(1);
        const boxes = await dashboardPage.locator(".mobile-bottom-nav a").evaluateAll((links) =>
          links.map((link) => Math.round(link.getBoundingClientRect().height)),
        );
        assert.ok(boxes.every((height) => height >= 44), "Every bottom tab is touch sized");
      } else {
        await expect(dashboardPage.locator(".mobile-bottom-nav")).toBeHidden();
      }
    }
    await dashboardPage.setViewportSize({ width: 390, height: 844 });
    await dashboardPage.goto(`${dashboardOrigin}/library?locale=ru`);
    await expect(dashboardPage.locator(".library-grid li")).toHaveCount(24);
    await expect(dashboardPage.locator(".library-filter-toggle")).toBeVisible();
    await expect(dashboardPage.locator("#library-filter-fields")).toBeHidden();
    await dashboardPage.locator(".library-filter-toggle").click();
    await expect(dashboardPage.locator("#library-filter-fields")).toBeVisible();
    const requests: string[] = [];
    dashboardPage.on("request", (request) => requests.push(request.url()));
    await dashboardPage.locator("#library-filter-fields select").nth(1).selectOption(subjects[1].id);
    assert.ok((await dashboardPage.locator(".library-grid li").count()) > 0);
    assert.ok((await dashboardPage.locator(".library-grid li").count()) < 125);
    assert.ok(new URL(dashboardPage.url()).searchParams.get("subject") === subjects[1].id);
    assert.deepEqual(requests.filter((url) => url.includes("/api/")), [], "Local filters never fetch data");
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.screenshot({ path: join(artifacts, "library-mobile-dark.png"), fullPage: true, animations: "disabled" });
    await dashboardPage.setViewportSize({ width: 320, height: 568 });
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.goto(`${dashboardOrigin}/schedule?locale=ru`);
    await expect(dashboardPage.locator(".schedule-day-content")).toBeVisible();
    await dashboardPage.locator(".day-square-btn").nth(1).click();
    await expect(dashboardPage.locator(".day-square-btn").nth(1)).toHaveAttribute("aria-selected", "true");
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.screenshot({ path: join(artifacts, "schedule-mobile-dark.png"), fullPage: true, animations: "disabled" });
    await dashboardPage.goto(`${dashboardOrigin}/profile?locale=ru`);
    await expect(dashboardPage.locator(".profile-heading")).toBeVisible();
    const taskTitleHeight = await dashboardPage.locator(".task-center-heading h2").evaluate((heading) => heading.getBoundingClientRect().height);
    assert.ok(taskTitleHeight < 65, "Task title remains readable at 320px");
    await expectNoHorizontalOverflow(dashboardPage);
    await dashboardPage.screenshot({ path: join(artifacts, "profile-mobile-dark.png"), fullPage: true, animations: "disabled" });
    for (const locale of ["ru", "kk", "en"]) {
      await dashboardPage.goto(`${dashboardOrigin}/library?locale=${locale}`);
      await expect(dashboardPage.locator(".library-filter-toggle")).toBeVisible();
      await expectNoHorizontalOverflow(dashboardPage);
    }
    await dashboardPage.close();
  } finally {
    await browser.close();
    dashboardServer.close();
    await once(dashboardServer, "close");
  }
});
