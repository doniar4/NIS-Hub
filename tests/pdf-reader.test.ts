import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPageText } from "../src/lib/pdf-page-text";
import { isRenderCancellation, pdfErrorDetail, reportPdfError } from "../src/lib/pdf-reader-errors";

test("PDF diagnostics retain the cause, redact secrets and stay silent in production", t => {
  const original = new TypeError("readableStream is not async iterable");
  assert.match(pdfErrorDetail(original), /TypeError: readableStream is not async iterable/);
  const detail = pdfErrorDetail(new Error("https://example.com/private.pdf?token=SECRET token=HIDDEN sb_secret_private"));
  for (const secret of ["SECRET", "HIDDEN", "sb_secret_private", "private.pdf"]) assert.ok(!detail.includes(secret));
  assert.equal(pdfErrorDetail({ message: "untrusted object" }), "Unknown PDF.js error");
  const log = t.mock.method(console, "error", () => {});
  const environment: Record<string, string | undefined> = process.env;
  const previous = environment.NODE_ENV;
  try {
    environment.NODE_ENV = "production";
    assert.equal(reportPdfError("render", original, 1), "");
    assert.equal(log.mock.callCount(), 0);
    environment.NODE_ENV = "development";
    assert.match(reportPdfError("render", original, 1), /readableStream/);
    assert.equal(log.mock.callCount(), 1);
    const cancellation = Object.assign(new Error("cancelled"), { name: "RenderingCancelledException" });
    assert.equal(isRenderCancellation(cancellation), true);
    assert.equal(reportPdfError("render", cancellation), "");
    assert.equal(log.mock.callCount(), 1);
  } finally {
    if (previous === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous;
  }
});

test("text extraction cancels pending reads and releases the stream lock", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const page = { streamTextContent: () => stream } as Pick<PDFPageProxy, "streamTextContent">;
  const abort = new AbortController();
  const pending = extractPageText(page, abort.signal);
  abort.abort();
  assert.equal(await pending, "");
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
  assert.equal(await extractPageText(page, abort.signal), "");
});

const fixture = process.env.NIS_READER_TEST_PDF;
test("existing reader PDF: v6 canvas, all pages, zoom, text and cancellation", { skip: !fixture && "Set NIS_READER_TEST_PDF to the existing private local test PDF" }, async t => {
  const require = createRequire(import.meta.url);
  const assets = dirname(require.resolve("pdfjs-dist/package.json"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  assert.equal(pdfjs.version, "6.3.289");
  const task = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(fixture!)), useSystemFonts: true,
    standardFontDataUrl: join(assets, "standard_fonts/"), cMapUrl: join(assets, "cmaps/"), wasmUrl: join(assets, "wasm/"),
  });
  try {
    const pdf = await task.promise;
    assert.ok(pdf.numPages >= 3, "fixture must contain at least the requested 3 pages");
    t.diagnostic(`Actual local test PDF: ${pdf.numPages} pages`);
    const page = await pdf.getPage(1);
    await t.test("reproduce Safari's missing stream iterator; fixed extraction still succeeds", async () => {
      const descriptor = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);
      Reflect.deleteProperty(ReadableStream.prototype, Symbol.asyncIterator);
      try {
        // This calls the actual installed v6 method, not a fake implementation.
        await assert.rejects(page.getTextContent(), /async iterable|not a function/);
        const text = await extractPageText(page, new AbortController().signal);
        assert.ok(text.length > 0);
      } finally {
        if (descriptor) Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, descriptor);
      }
    });
    const order = [...Array.from({ length: pdf.numPages }, (_, n) => n + 1), 2, 1];
    for (const number of order) {
      await t.test(`render page ${number} and read text`, async () => {
        const current = await pdf.getPage(number);
        const base = current.getViewport({ scale: 1 });
        const viewport = current.getViewport({ scale: Math.min(600 / base.width, 1.5) });
        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        await current.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) ink++;
        const text = await extractPageText(current, new AbortController().signal);
        if (number <= 3) {
          assert.ok(ink > 100, "the three content pages must visibly render, not just show a white canvas");
          assert.ok(text.length > 0, "the three content pages have a nonempty text layer");
        } else {
          // This local export has a fourth, entirely blank trailing page.
          // Do not invent visible content or change book metadata to hide it.
          assert.equal(ink, 0);
          assert.equal(text, "");
        }
        const output = process.env.NIS_READER_TEST_OUTPUT;
        if (output) { mkdirSync(output, { recursive: true }); writeFileSync(join(output, `page-${number}.png`), canvas.toBuffer("image/png")); }
        canvas.width = 0; canvas.height = 0;
      });
    }
    await t.test("zoom 200% and DPR 2 do not double-apply the viewport scale", async () => {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(600 / base.width, 1.5) * 2 });
      const canvas = createCanvas(Math.floor(viewport.width * 2), Math.floor(viewport.height * 2));
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, transform: [2, 0, 0, 2, 0, 0] }).promise;
      assert.equal(canvas.width, Math.floor(viewport.width * 2));
      assert.ok(canvas.toBuffer("image/png").length > 1000);
      canvas.width = 0; canvas.height = 0;
    });
    await t.test("cancel a render and immediately render the same page on a new canvas", async () => {
      const viewport = page.getViewport({ scale: 1 });
      const first = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const cancelled = page.render({ canvas: first as unknown as HTMLCanvasElement, viewport });
      const rejection = assert.rejects(cancelled.promise, { name: "RenderingCancelledException" });
      cancelled.cancel();
      const second = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      await page.render({ canvas: second as unknown as HTMLCanvasElement, viewport }).promise;
      await rejection;
      first.width = second.width = 0;
      first.height = second.height = 0;
    });
  } finally { await task.destroy(); }
});
