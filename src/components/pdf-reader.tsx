"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { saveReading } from "@/app/actions/reading";
import { isRenderCancellation, reportPdfError } from "@/lib/pdf-reader-errors";
import { extractPageText } from "@/lib/pdf-page-text";

export function PdfReader({ bookId, initialPage, initialBookmarks }: { bookId: string; initialPage: number; initialBookmarks: number[] }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(600);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [pageText, setPageText] = useState("");
  const [message, setMessage] = useState("");
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [pending, startTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const savedPage = useRef<number | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/books/${bookId}/access`, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Войдите снова, чтобы читать материал." : "PDF недоступен. Возможно, материал снят с публикации или файл ещё не загружен.");
        const { url } = await response.json() as { url: string };
        // PDF.js 6's modern bundle assumes new built-ins (e.g. Map
        // getOrInsertComputed). The matching legacy pair supports Safari 18+.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        // Fetch fully within the short URL lifetime; no later range requests to an expired URL.
        const file = await fetch(url, { signal: abort.signal, cache: "no-store", referrerPolicy: "no-referrer" });
        if (!file.ok) throw new Error("Не удалось получить PDF. Повторите загрузку.");
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > 52428800) throw new Error("PDF превышает допустимый размер 50 МБ.");
        if (cancelled) return;
        task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" });
        const document = await task.promise;
        if (cancelled) return;
        setPage(p => Math.min(Math.max(1, p), document.numPages));
        setPdf(document);
      } catch (reason: unknown) {
        if (!cancelled) {
          const detail = reportPdfError("load", reason);
          setError("Не удалось открыть PDF. Проверьте вход и повторите загрузку." + (detail ? ` ${detail}` : ""));
          setBusy(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; abort.abort(); if (task) void task.destroy().catch(reason => { reportPdfError("cleanup", reason); }); };
  }, [bookId, attempt]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const textAbort = new AbortController();
    async function render() {
      try {
        const pdfPage = await pdf!.getPage(page);
        if (cancelled) return;
        setBusy(true);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: Math.min(width / base.width, 1.5) * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute("aria-hidden", "true");
        // v6 prefers canvas. If supplying a canvasContext instead, v6 requires
        // canvas: null. Use a fresh canvas per job to avoid concurrent reuse.
        // CSS viewport carries zoom; the additional transform is only for DPR.
        renderTask = pdfPage.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await renderTask.promise;
        if (cancelled) return;
        const previous = canvasHost.current?.firstElementChild;
        canvasHost.current?.replaceChildren(canvas);
        if (previous instanceof HTMLCanvasElement) { previous.width = 0; previous.height = 0; }
        setPageText("");
        setBusy(false);
        if (savedPage.current !== page) {
          timer = setTimeout(() => {
            saveQueue.current = saveQueue.current.then(async () => {
              if (cancelled) return;
              const result = await saveReading(bookId, page, "progress");
              if (!cancelled) {
                if (result.success) savedPage.current = page;
                setMessage(result.error ?? result.success ?? "");
              }
            }).catch(() => { if (!cancelled) setMessage("Позиция не сохранена: проверьте подключение."); });
          }, 400);
        }
        // A text-layer failure must not hide a successfully rendered canvas or
        // stop bookmark/progress controls. Report it as a separate stage.
        try {
          const text = await extractPageText(pdfPage, textAbort.signal);
          if (!cancelled) setPageText(text);
        } catch (reason: unknown) {
          if (!cancelled) {
            reportPdfError("text", reason, page);
            setPageText("Не удалось извлечь текст этой страницы. PDF доступен для просмотра.");
          }
        }
      } catch (reason: unknown) {
        if (cancelled || isRenderCancellation(reason)) return;
        const detail = reportPdfError("render", reason, page);
        setError("Не удалось отобразить страницу. Попробуйте загрузить PDF снова." + (detail ? ` ${detail}` : ""));
        setBusy(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
      textAbort.abort();
      renderTask?.cancel();
      if (timer) clearTimeout(timer);
      const release = () => {
        // Keep the last complete frame until its replacement is ready. Free
        // cancelled/offscreen backing stores after PDF.js has stopped using them.
        if (canvas && !canvas.isConnected) { canvas.width = 0; canvas.height = 0; }
      };
      if (renderTask) void renderTask.promise.then(release, release);
      else release();
    };
  }, [pdf, page, width, zoom, bookId]);

  function goTo(value: number) {
    if (pdf && value !== page && Number.isInteger(value) && value >= 1 && value <= pdf.numPages) { setBusy(true); setPage(value); setMessage(""); }
  }
  function toggleBookmark() {
    const currentPage = page;
    const removing = bookmarks.includes(currentPage);
    startTransition(async () => {
      try {
        const result = await saveReading(bookId, currentPage, removing ? "remove" : "bookmark");
        setMessage(result.error ?? result.success ?? "");
        if (result.success) setBookmarks(values => removing ? values.filter(value => value !== currentPage) : [...values, currentPage].sort((a, b) => a - b));
      } catch { setMessage("Закладка не сохранена: проверьте подключение."); }
    });
  }
  return <section aria-label="Чтение PDF" className="space-y-5">
    {error ? <div className="form-error" role="alert"><p>{error}</p><button className="button button-secondary mt-4" onClick={() => { setPdf(null); setError(""); setBusy(true); setAttempt(a => a + 1); }}>Повторить загрузку</button></div> : <>
      <div className="flex flex-wrap items-end gap-3">
        <button className="button button-secondary" disabled={!pdf || page <= 1 || busy} onClick={() => goTo(page - 1)}>← Назад</button>
        <label className="w-28"><span className="field-label">Страница{pdf ? ` / ${pdf.numPages}` : ""}</span><input className="field" aria-label="Номер страницы" type="number" min={1} max={pdf?.numPages ?? 1} value={page} disabled={!pdf} onChange={event => goTo(Number(event.target.value))} /></label>
        <button className="button button-secondary" disabled={!pdf || page >= pdf.numPages || busy} onClick={() => goTo(page + 1)}>Далее →</button>
        <label><span className="field-label">Масштаб</span><select className="field" value={zoom} disabled={!pdf} onChange={event => setZoom(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>
        <button className="button" disabled={!pdf || busy || pending} aria-pressed={bookmarks.includes(page)} onClick={toggleBookmark}>{pending ? "Сохранение…" : bookmarks.includes(page) ? "Удалить закладку" : "В закладки"}</button>
      </div>
      <p className="min-h-6 text-sm text-[var(--muted)]" role="status">{busy ? "Загружаем страницу…" : message || `Страница ${page} из ${pdf?.numPages ?? "…"}`}</p>
    </>}
    <div ref={viewportRef} className="w-full min-w-0 overflow-x-auto border border-[var(--line)] bg-[var(--surface)]" aria-busy={busy}><div ref={canvasHost} className="mx-auto w-fit min-h-64" /></div>
    {!busy && !error && <details className="border border-[var(--line)] p-4"><summary className="cursor-pointer text-sm font-semibold">Текст страницы {page}</summary><p className="mt-4 whitespace-pre-wrap leading-7">{pageText || "В этом PDF нет текстового слоя. Для доступности нужен документ с распознанным текстом."}</p></details>}
    {bookmarks.length > 0 && <nav aria-label="Закладки этой книги" className="flex flex-wrap items-center gap-2"><span className="mr-2 text-sm">Закладки:</span>{bookmarks.map(value => <button className="button button-secondary button-small" disabled={!pdf || value > pdf.numPages} key={value} onClick={() => goTo(value)}>Стр. {value}</button>)}</nav>}
  </section>;
}
