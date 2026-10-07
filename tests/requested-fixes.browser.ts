import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium, webkit, expect } from "@playwright/test";
import { samplePdf } from "./browser/sample-pdf";

test(
  "requested fixes: full-width reader, centered zoom, bounded AI and honest mobile messages",
  { timeout: 180000 },
  async () => {
    const bundle = await build({
      entryPoints: ["tests/browser/requested-fixes-harness.tsx"],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      jsx: "automatic",
      define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
      plugins: [
        {
          name: "isolated-actions",
          setup(api) {
            api.onResolve({ filter: /^next\/navigation$/ }, () => ({
              path: "navigation",
              namespace: "fixture",
            }));
            api.onResolve(
              { filter: /^@\/lib\/community-client$|^@\/app\/actions\// },
              (a) => ({ path: a.path, namespace: "fixture" }),
            );
            api.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
              loader: "js",
              contents:
                a.path === "navigation"
                  ? "export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){}});"
                  : `const rpc=async(name,...args)=>(await fetch('/fixture/action',{method:'POST',body:JSON.stringify({name,args})})).json();
          export const loadInbox=()=>rpc('inbox');export const startConversation=()=>rpc('start');
          export const loadMessages=()=>rpc('history');export const sendMessage=(...a)=>rpc('send',...a);
          export const markConversationRead=async()=>({ok:true});export const safetyAction=async()=>({success:true});
          export const saveReading=async()=>({success:'Saved'});export const changeLibrary=async()=>({ok:true});
          export const getHighlights=async()=>({ok:true,userId:'fixture',highlights:[]});
          export const saveHighlight=async()=>({ok:true});export const deleteHighlight=async()=>({ok:true});
          export const generateStudy=(...a)=>rpc('study',...a);export const reviewStudyAnswers=async()=>({error:'unavailable'});`,
            }));
          },
        },
      ],
    });
    const css = readdirSync(".next/static/css")
      .filter((n) => n.endsWith(".css"))
      .map((n) => readFileSync(".next/static/css/" + n, "utf8"))
      .join("\n");
    const pdf = samplePdf(),
      id = "00000000-0000-4000-8000-000000000030",
      user = "00000000-0000-4000-8000-000000000001";
    const peer = "00000000-0000-4000-8000-000000000002",
      thread = "00000000-0000-4000-8000-000000000080";
    let pdfRequests = 0,
      accessRequests = 0;
    const studyInputs: { start: number; end: number }[] = [],
      sent: string[] = [];
    const server = createServer(async (req, res) => {
      const path = new URL(req.url ?? "/", "http://fixture.local").pathname;
      if (path === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (path === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else if (path === "/fixture.pdf") {
        pdfRequests++;
        res.setHeader("Content-Type", "application/pdf");
        res.end(pdf);
      } else if (path === `/api/books/${id}/access`) {
        accessRequests++;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: "/fixture.pdf", expiresIn: 60 }));
      } else if (path === "/avatar.svg") {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "max-age=600");
        res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#4b8c70"/></svg>',
        );
      } else if (path === "/fixture/action") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const { name, args } = JSON.parse(Buffer.concat(chunks).toString());
        let result: unknown = { ok: true };
        if (name === "inbox")
          result = {
            data: [
              {
                id: thread,
                peer_id: peer,
                peer_name: "Timur",
                peer_avatar_url: "/avatar.svg",
                last_body: sent.at(-1) ?? "Incoming",
                last_sender_id: sent.length ? user : peer,
                last_at: "2026-10-07T09:00:00Z",
                unread: 0,
                blocked: false,
                last_deleted: false,
              },
            ],
          };
        if (name === "history")
          result = {
            data: [
              {
                id: peer,
                thread_id: thread,
                sender_id: peer,
                body: "Incoming",
                created_at: "2026-10-07T09:00:00Z",
                deleted_at: null,
              },
              ...sent.map((body, i) => ({
                id: `own-${i}`,
                thread_id: thread,
                sender_id: user,
                body,
                created_at: "2026-10-07T09:01:00Z",
                deleted_at: null,
              })),
            ],
            more: false,
          };
        if (name === "send") {
          sent.push(args[1]);
          result = { id: "sent" };
        }
        if (name === "study") {
          studyInputs.push(args[0]);
          result = {
            generationId: id,
            source: {
              variantId: id,
              start: args[0].start,
              end: args[0].end,
              hash: "fixture",
            },
            response: {
              insufficient: false,
              sections: [
                {
                  kind: "overview",
                  insufficient: false,
                  points: [
                    {
                      text: "Fixture study result",
                      evidence: [
                        { page: args[0].start, quote: "Original test page" },
                      ],
                    },
                  ],
                },
              ],
            },
          };
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } else if (path === "/pdfjs-dist/legacy/build/pdf.worker.min.mjs") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(
          readFileSync(
            "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          ),
        );
      } else if (
        /^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/[a-zA-Z0-9_.-]+$/.test(
          path,
        )
      ) {
        res.end(readFileSync("public" + path));
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
        );
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`,
      artifacts = process.env.NIS_BROWSER_ARTIFACTS ?? "/tmp/nis-fixes-browser";
    mkdirSync(artifacts, { recursive: true });
    try {
      for (const [name, engine] of [
        ["chromium", chromium],
        ["webkit", webkit],
      ] as const) {
        if (
          process.env.NIS_BROWSER_ENGINES &&
          !process.env.NIS_BROWSER_ENGINES.split(",").includes(name)
        )
          continue;
        const browser = await engine.launch({ headless: true });
        try {
          for (const width of [390, 1440]) {
            const page = await browser.newPage({
              viewport: { width, height: 900 },
              reducedMotion: "no-preference",
            });
            const errors: string[] = [];
            page.on("pageerror", (e) => errors.push(e.message));
            await page.goto(origin + "/books/fixture/read");
            await expect(
              page.locator(".pdf-scroll-viewport canvas").first(),
            ).toBeVisible({ timeout: 15000 });
            await expect
              .poll(() =>
                page
                  .locator(".pdf-scroll-viewport")
                  .evaluate((el) =>
                    Math.abs(
                      el.clientWidth -
                        24 -
                        el.querySelector("canvas")!.getBoundingClientRect()
                          .width,
                    ),
                  ),
              )
              .toBeLessThan(3);
            const fitWidth = await page
              .locator(".pdf-scroll-viewport")
              .evaluate((el) => ({
                root: el.clientWidth,
                canvas: el.querySelector("canvas")!.getBoundingClientRect()
                  .width,
              }));
            assert.ok(
              fitWidth.root - fitWidth.canvas < 40,
              "PDF fills available width",
            );

            const beforePdf = pdfRequests,
              beforeAccess = accessRequests;
            await page
              .getByRole("button", { name: "Увеличить", exact: true })
              .click();
            await expect(page.locator(".reader-controls")).toContainText(
              "125%",
            );

            await expect
              .poll(() =>
                page.locator(".pdf-scroll-viewport").evaluate((el) => {
                  const page = el
                      .querySelector(".pdf-page-surface")!
                      .getBoundingClientRect(),
                    view = el.getBoundingClientRect();
                  return Math.abs(
                    page.left +
                      page.width / 2 -
                      view.left -
                      el.clientLeft -
                      el.clientWidth / 2,
                  );
                }),
              )
              .toBeLessThan(3);
            await page
              .getByRole("button", { name: "Увеличить", exact: true })
              .click();
            await expect
              .poll(() =>
                page.locator(".pdf-scroll-viewport").evaluate((el) => {
                  const page = el
                      .querySelector(".pdf-page-surface")!
                      .getBoundingClientRect(),
                    view = el.getBoundingClientRect();
                  return Math.abs(
                    page.left +
                      page.width / 2 -
                      view.left -
                      el.clientLeft -
                      el.clientWidth / 2,
                  );
                }),
              )
              .toBeLessThan(3);
            await page
              .getByRole("button", { name: "По ширине", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Далее", exact: true })
              .click();
            await expect(page.locator(".reader-controls")).toContainText(
              "2 / 4",
            );
            await page.locator(".reader-workspace-heading > button").click();
            await expect(page.locator("#ai-study")).toBeVisible();
            if (width >= 1280) {
              const layout = await page
                .locator(".reader-workspace")
                .evaluate((el) => ({
                  display: getComputedStyle(el).display,
                  reader: el
                    .querySelector(".reader-main")!
                    .getBoundingClientRect()
                    .toJSON(),
                  ai: el
                    .querySelector("#ai-study")!
                    .getBoundingClientRect()
                    .toJSON(),
                }));
              assert.equal(layout.display, "grid");
              assert.ok(
                layout.ai.left >= layout.reader.right,
                "AI occupies a separate desktop column",
              );
            }
            const start = page.getByLabel("Со страницы", { exact: true }),
              end = page.getByLabel("По страницу", { exact: true });
            await expect(start).toHaveValue("2");
            await expect(end).toHaveValue("2");
            await start.fill("3");
            await expect(end).toHaveValue("3");
            await end.fill("4");
            await page
              .getByRole("button", { name: "Подготовить", exact: true })
              .click();
            await expect(page.locator("#ai-study")).toContainText(
              "Fixture study result",
            );
            assert.deepEqual(studyInputs.at(-1)?.start, 3);
            assert.equal(studyInputs.at(-1)?.end, 4);
            assert.equal(
              pdfRequests,
              beforePdf,
              "zoom and AI never redownload the PDF",
            );
            assert.equal(accessRequests, beforeAccess);
            await page.screenshot({
              path: `${artifacts}/${name}-reader-${width}.png`,
            });
            await page.locator("#ai-study .inspector-heading button").click();
            // Exercise iPhone's missing-element-Fullscreen-API path in Chromium.
            await page.evaluate(() =>
              Object.defineProperty(
                HTMLElement.prototype,
                "requestFullscreen",
                { configurable: true, value: undefined },
              ),
            );
            await page.getByTitle("На весь экран", { exact: true }).click();
            await expect(page.locator(".pdf-reader")).toHaveAttribute(
              "data-fullscreen",
              "true",
            );
            const screen = await page
              .locator(".pdf-reader")
              .evaluate((el) => ({
                rect: el.getBoundingClientRect().toJSON(),
                width: innerWidth,
              }));
            assert.ok(
              Math.abs(screen.rect.left) < 1 &&
                Math.abs(screen.rect.width - screen.width) < 1,
            );
            await page
              .getByTitle("Выйти из полноэкранного режима", { exact: true })
              .click();
            await expect(page.locator(".pdf-reader")).toHaveAttribute(
              "data-fullscreen",
              "false",
            );
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
            assert.deepEqual(errors, []);
            await page.close();
          }
          const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
            reducedMotion: "no-preference",
          });
          sent.length = 0;
          await page.goto(origin + "/messages?messages");
          await expect(page.locator(".conversation-link img")).toBeVisible();
          await page.locator(".conversation-link").click();
          await expect(page.locator(".conversation-profile img")).toBeVisible();
          await expect(page.locator(".message-history")).toContainText(
            "Incoming",
          );
          assert.notEqual(
            await page
              .locator(".page-content")
              .evaluate((el) => getComputedStyle(el).animationName),
            "none",
          );
          assert.ok(
            await page
              .locator(".mobile-bottom-link")
              .first()
              .evaluate((el) =>
                getComputedStyle(el).transitionProperty.includes("transform"),
              ),
          );
          await page.locator(".message-compose-field").fill("My own message");
          await page.locator(".message-send-btn").click();
          await expect(page.locator(".message-own")).toContainText(
            "My own message",
          );
          await expect(page.locator(".message-typing-indicator")).toHaveCount(
            0,
          );
          await page.locator(".conversation-back").click();
          await expect(page.locator(".conversation-preview")).toContainText(
            "Вы: My own message",
          );
          await page.screenshot({ path: `${artifacts}/${name}-messages.png` });
          await page.emulateMedia({ reducedMotion: "reduce" });
          assert.equal(
            await page
              .locator(".page-content")
              .evaluate((el) => getComputedStyle(el).animationName),
            "none",
          );
          await page.close();
        } finally {
          await browser.close();
        }
      }
    } finally {
      server.close();
      await once(server, "close");
    }
  },
);
