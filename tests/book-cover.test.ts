import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("BookCover has no PDF transport, renderer, or canvas dependency", async () => {
  const source = readFileSync("src/components/book-cover.tsx", "utf8");
  assert.doesNotMatch(source, /pdfjs-dist|\/api\/books\/|getDocument\s*\(|<canvas|\.getContext\s*\(/);
  const bundle = await build({
    entryPoints: [resolve("src/components/book-cover.tsx")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react"],
    logLevel: "silent",
    metafile: true,
    plugins: [{
      name: "render-isolation",
      setup(api) {
        api.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture" }));
        api.onResolve({ filter: /^\.\/locale-provider$/ }, () => ({ path: "locale", namespace: "fixture" }));
        api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          loader: "js",
          contents: path === "image"
            ? "import React from 'react'; export default function Image({ unoptimized, ...props }) { return React.createElement('img', props); }"
            : "export function useI18n() { return { locale: 'en' }; }",
        }));
      },
    }],
  });
  assert.ok(Object.keys(bundle.metafile!.inputs).every(path => !path.includes("pdfjs-dist")));
  const mod = { exports: {} as { BookCover: React.ComponentType<{ title: string; url: string | null }> } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, mod, mod.exports);
  const signed = "https://storage.example.invalid/storage/v1/object/sign/book-covers/books/test.webp?token=fixture";
  const image = renderToStaticMarkup(React.createElement(mod.exports.BookCover, { title: "Physics", url: signed }));
  assert.match(image, /role="img"/);
  assert.match(image, /aria-label="Cover: Physics"/);
  assert.match(image, /src="https:\/\/storage\.example\.invalid\/storage\/v1\/object\/sign\/book-covers\/books\/test\.webp\?token=fixture"/);
  assert.doesNotMatch(image, /Cover unavailable/);
  const missing = renderToStaticMarkup(React.createElement(mod.exports.BookCover, { title: "Physics", url: null }));
  assert.match(missing, /Cover unavailable/);
  assert.match(missing, /aria-label="Cover: Physics — Cover unavailable"/);
  assert.doesNotMatch(missing, /<img|<canvas/);
});
