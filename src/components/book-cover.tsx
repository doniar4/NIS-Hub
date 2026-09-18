"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { useI18n } from "./locale-provider";
import { communityCopy } from "@/lib/community-copy";

export function BookCover({
  title,
  url,
  bookId,
  variantId,
}: {
  title: string;
  url: string | null;
  bookId?: string;
  variantId?: string;
}) {
  const { locale } = useI18n(),
    p = communityCopy(locale),
    host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false),
    [status, setStatus] = useState<"loading" | "ready" | "failed">("loading"),
    [attempt, setAttempt] = useState(0),
    [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !bookId || !variantId) return;
    let cancelled = false,
      task: PDFDocumentLoadingTask | undefined,
      render: RenderTask | undefined;
    const abort = new AbortController();
    async function load() {
      try {
        const access = await fetch(
          `/api/books/${bookId}/access?variant=${encodeURIComponent(variantId!)}`,
          { signal: abort.signal, cache: "no-store" },
        );
        if (!access.ok) throw new Error("unavailable");
        const { url: pdfUrl } = (await access.json()) as { url: string };
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdfjs.getDocument({
          url: pdfUrl,
          disableAutoFetch: true,
          disableStream: true,
          useSystemFonts: true,
          cMapUrl: "/pdfjs/cmaps/",
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
          iccUrl: "/pdfjs/iccs/",
        });
        const doc = await task.promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale: 1 }),
          scale = Math.min(240 / viewport.width, 360 / viewport.height),
          target = page.getViewport({ scale });
        const element = canvas.current;
        element.width = Math.ceil(target.width);
        element.height = Math.ceil(target.height);
        const context = element.getContext("2d");
        if (!context) throw new Error("canvas_unavailable");
        render = page.render({
          canvas: element,
          canvasContext: context,
          viewport: target,
        });
        await render.promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      } finally {
        if (task) void task.destroy().catch(() => {});
      }
    }
    void load();
    return () => {
      cancelled = true;
      abort.abort();
      render?.cancel();
      if (task) void task.destroy().catch(() => {});
    };
  }, [visible, bookId, variantId, attempt]);
  const fallback =
    (!bookId || !variantId || status === "failed") && url && !imageFailed;
  return (
    <div
      ref={host}
      className="book-first-page"
      aria-label={`${p.cover}: ${title}`}
    >
      {bookId && variantId && (
        <canvas
          ref={canvas}
          className={
            status === "ready" ? "cover-canvas" : "cover-canvas cover-pending"
          }
          aria-hidden="true"
        />
      )}
      {fallback ? (
        <Image
          unoptimized
          src={url}
          width={100}
          height={150}
          alt=""
          className="reading-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : status !== "ready" ? (
        <div
          className={
            status === "loading" && bookId
              ? "cover-skeleton"
              : "cover-unavailable"
          }
        >
          {status === "failed" || !bookId ? (
            <>
              <span>{p.coverFailed}</span>
              {bookId && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus("loading");
                    setAttempt((n) => n + 1);
                  }}
                >
                  {p.coverRetry}
                </button>
              )}
            </>
          ) : (
            <span className="sr-only">{p.loading}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
