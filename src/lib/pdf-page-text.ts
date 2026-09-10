import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { reportPdfError } from "./pdf-reader-errors";

// PDF.js 6.3.289 getTextContent() uses for-await on ReadableStream, including
// in its legacy bundle. Safari versions without stream async iteration throw
// there. The public stream/getReader APIs do not need that browser feature.
export async function extractPageText(page: Pick<PDFPageProxy, "streamTextContent">, signal: AbortSignal): Promise<string> {
  if (signal.aborted) return "";
  const reader = page.streamTextContent().getReader();
  const parts: string[] = [];
  const cancel = () => { void reader.cancel().catch(reason => { reportPdfError("cleanup", reason); }); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const item of value.items) {
        if ("str" in item) parts.push(item.str, item.hasEOL ? "\n" : " ");
      }
    }
    return signal.aborted ? "" : parts.join("").trim();
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
