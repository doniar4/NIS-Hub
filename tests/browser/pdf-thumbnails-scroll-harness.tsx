import { createRoot } from "react-dom/client";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { SmoothScroll } from "../../src/components/smooth-scroll";
import { PdfThumbnails } from "../../src/components/pdf-thumbnails";

// Rendering is stubbed; the scroll container, thumbnails, selection and the
// production Lenis instance all run as they do in the real reader.
const pdf = {
  numPages: 60,
  getPage: async () => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 420 * scale,
      height: 594 * scale,
    }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
  }),
} as unknown as PDFDocumentProxy;
function Harness() {
  const [page, setPage] = useState(34);
  return (
    <LocaleProvider locale="ru">
      <SmoothScroll />
      <main style={{ padding: 24 }}>
        <div style={{ height: 120 }}>Reader</div>
        <div className="reader-stage" data-thumbnails="true">
          <PdfThumbnails pdf={pdf} page={page} onSelect={setPage} />
          <div className="pdf-scroll-viewport" data-lenis-prevent>
            <div style={{ height: 6000 }}>
              Page <span id="selected-page">{page}</span>
            </div>
          </div>
        </div>
        <div style={{ height: 1600 }}>Below reader</div>
      </main>
    </LocaleProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
