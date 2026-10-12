import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test("AI Study: manual timeout recovery, bounded requests, preserved panel state and locale-safe results", async () => {
  const bundle = await build({
    entryPoints: ["tests/browser/ai-study-harness.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    plugins: [
      {
        name: "study-actions",
        setup(b) {
          b.onResolve(
            { filter: /^@\/app\/actions\/(ai-study|study-answers)$/ },
            (a) => ({ path: a.path, namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
            contents: `export async function ${a.path.endsWith("study-answers") ? "reviewStudyAnswers" : "generateStudy"}(input){return fetch('/rpc',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json());}`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const css = readdirSync(".next/static/css")
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(".next/static/css/" + f, "utf8"))
    .join("\n");
  const inputs: Array<{
    start?: number;
    end?: number;
    mode?: string;
    locale?: string;
    answers?: unknown[];
  }> = [];
  let failure: string | null = null;
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
    if (req.url === "/rpc") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw);
      inputs.push(input);
      const error = failure;
      await new Promise((resolve) => setTimeout(resolve, 250));
      const response = error
        ? { error }
        : input.answers
          ? {
              response: {
                feedback: [
                  {
                    index: 0,
                    status: "correct",
                    feedback: "Верно по источнику.",
                    evidence: [{ page: 7, quote: "Хлорофилл поглощает свет." }],
                  },
                ],
                topicsToReview: [],
              },
              source: { start: 7, end: 7 },
            }
          : {
              generationId: "00000000-0000-4000-8000-000000000040",
              source: {
                start: input.start,
                end: input.end,
                variantId: input.variantId,
                hash: "fixture",
              },
              response: {
                insufficient: false,
                sections: [
                  {
                    kind: input.mode === "questions" ? "questions" : "overview",
                    insufficient: false,
                    points: [
                      {
                        text:
                          input.mode === "questions"
                            ? "Какую роль играет хлорофилл?"
                            : input.locale === "en"
                              ? "Chlorophyll absorbs light energy for photosynthesis."
                              : input.locale === "kk"
                                ? "Хлорофилл фотосинтез үшін жарықты сіңіреді."
                                : "Хлорофилл поглощает световую энергию для фотосинтеза.",
                        evidence: [
                          {
                            page: input.start,
                            quote: "Хлорофилл поглощает свет.",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="ru"><meta charset="UTF-8"><link rel="stylesheet" href="/styles.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`,
    artifacts =
      process.env.NIS_BROWSER_ARTIFACTS ?? "/tmp/nis-ai-study-browser";
  mkdirSync(artifacts, { recursive: true });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/#ai-study");
    const panel = page.locator("#ai-study"),
      from = panel.getByLabel("Со страницы", { exact: true }),
      to = panel.getByLabel("По страницу", { exact: true });
    await expect(panel).toBeVisible();
    await expect(from).toHaveValue("7");
    await expect(to).toHaveValue("7");
    const submitStyle = await panel
      .locator(".ai-study-action-btn")
      .evaluate((el) => ({
        image: getComputedStyle(el).backgroundImage,
        color: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
    assert.equal(
      submitStyle.image,
      "none",
      "Primary action uses a readable solid background",
    );
    assert.equal(submitStyle.background, "rgb(35, 75, 121)");
    assert.equal(submitStyle.color, "rgb(255, 255, 255)");
    await panel.screenshot({ path: artifacts + "/desktop-empty.png" });
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("nis-reader-page", {
          detail: {
            variantId: "00000000-0000-4000-8000-000000000030",
            page: 8,
          },
        }),
      ),
    );
    await expect(from).toHaveValue("8");
    await from.fill("7");
    await to.fill("9");
    failure = "timeout";
    await panel.locator(".study-request").evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(panel.locator(".study-loading")).toBeVisible();
    await expect(panel.getByRole("radio").first()).toBeDisabled();
    await expect(panel.getByRole("alert")).toContainText("Gemini");
    assert.equal(
      inputs.length,
      1,
      "Concurrent submissions only send one request",
    );
    await panel.screenshot({ path: artifacts + "/desktop-timeout.png" });
    failure = null;
    await panel
      .getByRole("button", { name: "Разобрать одну страницу" })
      .click();
    await expect(panel.locator(".study-result")).toContainText("Хлорофилл");
    assert.equal(inputs.at(-1)?.start, 7);
    assert.equal(inputs.at(-1)?.end, 7);
    await expect(panel.locator("cite")).toContainText("7");
    await panel.screenshot({ path: artifacts + "/desktop-result.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel.locator(".study-result")).toContainText("Хлорофилл");
    await expect(to).toHaveValue("7");
    await panel.screenshot({ path: artifacts + "/mobile-result.png" });
    assert.ok(
      await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "No panel overflow on mobile",
    );
    await panel.locator(".inspector-heading button").click();
    await expect(panel).not.toBeVisible();
    await page.locator(".reader-workspace-heading > button").click();
    await expect(panel.locator(".study-result")).toContainText("Хлорофилл");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await panel
      .getByRole("radio", { name: /Вопросы для самопроверки/ })
      .check();
    await panel
      .getByRole("button", { name: "Подготовить", exact: true })
      .click();
    await expect(panel.locator(".study-answer-form textarea")).toBeVisible();
    await panel.locator(".study-answer-form textarea").fill("Поглощает свет.");
    await panel.locator(".study-answer-form button").click();
    await expect(panel.locator(".study-answer-form")).toContainText(
      "Верно по источнику.",
    );
    for (const locale of ["en", "kk", "ru"]) {
      await page.evaluate(
        (l) =>
          window.dispatchEvent(
            new CustomEvent("study-test-locale", { detail: l }),
          ),
        locale,
      );
      await expect(panel.locator(".study-result")).toHaveCount(0);
      await panel.getByRole("radio").first().focus();
      await panel.getByRole("radio").first().press("Space");
      await panel.locator(".ai-study-action-btn").click();
      if (locale === "en") {
        await expect(panel.locator(".study-loading")).toBeVisible();
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("study-test-locale", { detail: "kk" }),
          ),
        );
        await expect(panel.locator(".ai-study-action-btn")).toBeEnabled();
        await expect(panel.locator(".study-result")).toHaveCount(0);
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("study-test-locale", { detail: "en" }),
          ),
        );
        await panel.locator(".ai-study-action-btn").click();
      }
      await expect(panel.locator(".study-result")).toBeVisible();
      assert.equal(inputs.at(-1)?.locale, locale);
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await panel.screenshot({
          path: `${artifacts}/desktop-${locale}-${theme}.png`,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
        await panel.screenshot({
          path: `${artifacts}/mobile-${locale}-${theme}.png`,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
