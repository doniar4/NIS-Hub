import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "../src/lib/i18n";
import { v053Copy } from "../src/lib/v053-copy";

test("Home and Schedule homework expose localized, safe Telegram CTAs without changing homework forms", async () => {
  const result = await build({
    stdin: {
      contents: 'export {ClassHomeworkPanel} from "./src/components/class-homework"; export {HomeworkPreview} from "./src/components/homework-preview"; export {LocaleProvider} from "./src/components/locale-provider";',
      resolveDir: process.cwd(),
    },
    write: false, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
    external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "homework-render-boundary", setup(api) {
      api.onResolve({ filter: /^@\/app\/actions\/homework$/ }, () => ({ path: "actions", namespace: "fixture" }));
      api.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      api.onResolve({ filter: /^\.\/safety-menu$/ }, () => ({ path: "safety", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "actions"
          ? 'export function loadHomework(){throw new Error("Unexpected load")} export function loadDailyHomework(){throw new Error("Unexpected load")} export function saveHomework(){throw new Error("Unexpected save")} export function deleteHomework(){throw new Error("Unexpected delete")}'
          : path === "safety"
            ? 'export function SafetyMenu(){return null}'
            : 'import React from "react";export default function Link({href,children,className}){return React.createElement("a",{href,className},children)}',
        loader: "js",
      }));
    } }],
  });
  const mod = { exports: {} as {
    ClassHomeworkPanel: React.ComponentType<Record<string, unknown>>;
    HomeworkPreview: React.ComponentType<Record<string, unknown>>;
    LocaleProvider: React.ComponentType<{ locale: Locale; children?: React.ReactNode }>;
  } };
  runInNewContext(result.outputFiles[0].text, { module: mod, exports: mod.exports, require });
  for (const locale of ["ru", "kk", "en"] as const) {
    for (const hasClass of [false, true]) {
      for (const component of [mod.exports.ClassHomeworkPanel, mod.exports.HomeworkPreview]) {
        const markup = renderToStaticMarkup(React.createElement(mod.exports.LocaleProvider,
          { locale },
          React.createElement(component, { userId: "test-user", date: "2026-10-04", subjects: [], hasClass }),
        ));
        const links = markup.match(/<a\b[^>]*href="https:\/\/t\.me\/nis_hub_support_bot"[^>]*>/g) ?? [];
        assert.equal(links.length, 2, `${locale}: main and compact CTA present even without a profile class`);
        for (const link of links) {
          assert.match(link, /target="_blank"/);
          assert.match(link, /rel="noopener noreferrer"/);
        }
        const p = v053Copy(locale);
        assert.ok(markup.includes(p.telegramHomeworkTitle));
        assert.ok(markup.includes(p.telegramHomeworkOpen));
        assert.ok(markup.includes(p.telegramHomeworkShort));
        assert.ok(markup.includes("@nis_hub_support_bot"));
        assert.match(markup, /button w-full sm:w-auto/);
        assert.match(markup, /flex flex-wrap items-center justify-between gap-2/);
        assert.ok(!markup.includes("<dialog"));
        if (component === mod.exports.ClassHomeworkPanel) {
          assert.equal(markup.includes("<form"), hasClass);
          if (hasClass) {
            assert.match(markup, /name="body"[^>]*maxLength="1000"/);
            assert.match(markup, /name="subject"/);
          }
        }
      }
    }
  }
});
