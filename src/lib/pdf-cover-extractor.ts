"use client";

/**
 * Extracts ONLY the first page of a PDF file as a lightweight JPEG Blob (~25-35 KB).
 * Runs completely in the client's browser memory from the selected File or ArrayBuffer.
 * This guarantees 0 bytes of extra egress from Supabase when uploading or updating covers.
 */
export async function extractPdfCoverBlob(file: File | ArrayBuffer | Blob): Promise<Blob | null> {
  try {
    const bytes = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const task = pdfjs.getDocument({
      data: bytes,
      useSystemFonts: true,
      cMapUrl: "/pdfjs/cmaps/",
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    });

    const doc = await task.promise;
    if (doc.numPages < 1) return null;

    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    // Target a crisp 300px width thumbnail
    const targetWidth = 300;
    const scale = targetWidth / Math.max(baseViewport.width, 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fill white background before rendering
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderTask = page.render({
      canvasContext: ctx as unknown as Parameters<typeof page.render>[0]["canvasContext"],
      viewport,
      canvas,
    });
    await renderTask.promise;

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  } catch {
    if (process.env.NODE_ENV === "development") console.error("[extractPdfCoverBlob] cover extraction failed");
    return null;
  }
}

/**
 * Extracts ONLY page 1 of a PDF from a signed URL using HTTP Range requests.
 * `disableAutoFetch: true` and `rangeChunkSize: 65536` guarantee that PDF.js
 * does NOT download the whole PDF, downloading only ~100-250KB for page 1.
 */
export async function extractPdfCoverDataUrlFromUrl(url: string): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const task = pdfjs.getDocument({
      url,
      useSystemFonts: true,
      rangeChunkSize: 65536,
      disableAutoFetch: true,
      disableStream: true,
      cMapUrl: "/pdfjs/cmaps/",
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    });

    const doc = await task.promise;
    if (doc.numPages < 1) return null;

    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    const targetWidth = 240;
    const scale = targetWidth / Math.max(baseViewport.width, 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderTask = page.render({
      canvasContext: ctx as unknown as Parameters<typeof page.render>[0]["canvasContext"],
      viewport,
      canvas,
    });
    await renderTask.promise;

    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    if (process.env.NODE_ENV === "development") console.error("[extractPdfCoverDataUrlFromUrl] cover extraction failed");
    return null;
  }
}
