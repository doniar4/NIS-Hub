"use client";
<<<<<<< HEAD

=======
import {readerKeyDelta,readerScale} from "@/lib/reader-controls";
import {v051Copy} from "@/lib/v051-copy";
import { useI18n } from "@/components/locale-provider";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
import { saveReading } from "@/app/actions/reading";
import { useI18n } from "@/components/locale-provider";
import { BookmarkIcon, RefreshIcon } from "@/components/icons";
import { extractPageText } from "@/lib/pdf-page-text";
<<<<<<< HEAD
import { isRenderCancellation, reportPdfError } from "@/lib/pdf-reader-errors";
import { readerKeyDelta, readerScale } from "@/lib/reader-controls";
import { v051Copy } from "@/lib/v051-copy";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

function PdfPage({ pdf, number, width, height, fit, zoom, root, onVisible }: {
  pdf: PDFDocumentProxy; number: number; width: number; height: number;
  fit: "width" | "page"; zoom: number; root: HTMLDivElement | null;
  onVisible: (page: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(number === 1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!element.current || !root) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      setNearby(true);
      if (entry.intersectionRatio >= 0.5) onVisible(number);
    }, { root, rootMargin: "900px 0px", threshold: [0, 0.5] });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [number, onVisible, root]);
  useEffect(() => {
    if (!nearby) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let canvas: HTMLCanvasElement | undefined;
    async function render() {
      try {
        setLoading(true); setFailed(false);
        const source = await pdf.getPage(number);
        if (cancelled) return;
        const base = source.getViewport({ scale: 1 });
        const viewport = source.getViewport({ scale: readerScale(width, height, base.width, base.height, fit, zoom) });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute("aria-hidden", "true");
        task = source.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (!cancelled) canvasHost.current?.replaceChildren(canvas);
      } catch (reason) {
        if (!cancelled && !isRenderCancellation(reason)) {
          reportPdfError("render", reason, number);
          setFailed(true);
=======
export function PdfReader({ bookId, variantId = bookId, initialPage, initialBookmarks }: {
    bookId: string; variantId?:string;
    initialPage: number;
    initialBookmarks: number[];
}) {
    const { t,locale } = useI18n(); const v=v051Copy(locale);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(initialPage);
    const [zoom, setZoom] = useState(1);
    const [fit,setFit]=useState<"width"|"page">("width");
    const [height,setHeight]=useState(650);
    const [jump,setJump]=useState("");
    const [width, setWidth] = useState(600);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState<{ key: "loadPdfError" | "renderPdfError"; detail: string } | null>(null);
    const [textFailed, setTextFailed] = useState(false);
    const messages = useRef(t);
    useEffect(() => { messages.current = t; }, [t]);
    const [busy, setBusy] = useState(true);
    const [pageText, setPageText] = useState("");
    const [message, setMessage] = useState("");
    const [bookmarks, setBookmarks] = useState(initialBookmarks);
    const [pending, startTransition] = useTransition();
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasHost = useRef<HTMLDivElement>(null);
    const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
    const savedPage = useRef<number | null>(null);
    useEffect(()=>{
      const resize=()=>setHeight(Math.max(200,window.innerHeight-220));
      resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
    },[]);
    useEffect(()=>{
      const key=(event:KeyboardEvent)=>{
        const delta=readerKeyDelta(event);if(!delta||!pdf||busy||error)return;
        event.preventDefault();setPage(current=>Math.max(1,Math.min(pdf.numPages,current+delta)));setMessage("");
      };
      window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
    },[pdf,busy,error]);
    useEffect(() => {
        const element = viewportRef.current;
        if (!element)
            return;
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
                const response = await fetch(`/api/books/${bookId}/access?variant=${variantId}`, { cache: "no-store", signal: abort.signal });
                if (!response.ok)
                    throw new Error(response.status === 401 ? "Войдите снова, чтобы читать материал." : "PDF недоступен. Возможно, материал снят с публикации или файл ещё не загружен.");
                const { url } = await response.json() as {
                    url: string;
                };
                // PDF.js 6's modern bundle assumes new built-ins (e.g. Map
                // getOrInsertComputed). The matching legacy pair supports Safari 18+.
                const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
                if (cancelled)
                    return;
                pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
                // Fetch fully within the short URL lifetime; no later range requests to an expired URL.
                const file = await fetch(url, { signal: abort.signal, cache: "no-store", referrerPolicy: "no-referrer" });
                if (!file.ok)
                    throw new Error("Не удалось получить PDF. Повторите загрузку.");
                const bytes = await file.arrayBuffer();
                if (bytes.byteLength > 52428800)
                    throw new Error("PDF превышает допустимый размер 50 МБ.");
                if (cancelled)
                    return;
                task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" });
                const document = await task.promise;
                if (cancelled)
                    return;
                setPage(p => Math.min(Math.max(1, p), document.numPages));
                setPdf(document);
            }
            catch (reason: unknown) {
                if (!cancelled) {
                    const detail = reportPdfError("load", reason);
                    setError({ key: "loadPdfError", detail: detail || "" });
                    setBusy(false);
                }
            }
        }
        void load();
        return () => { cancelled = true; abort.abort(); if (task)
            void task.destroy().catch(reason => { reportPdfError("cleanup", reason); }); };
    }, [bookId, variantId, attempt]);
    useEffect(() => {
        if (!pdf)
            return;
        let cancelled = false;
        let renderTask: RenderTask | undefined;
        let canvas: HTMLCanvasElement | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const textAbort = new AbortController();
        async function render() {
            try {
                const pdfPage = await pdf!.getPage(page);
                if (cancelled)
                    return;
                setBusy(true);
                const base = pdfPage.getViewport({ scale: 1 });
                const viewport = pdfPage.getViewport({ scale: readerScale(width,height,base.width,base.height,fit,zoom) });
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
                if (cancelled)
                    return;
                const previous = canvasHost.current?.firstElementChild;
                canvasHost.current?.replaceChildren(canvas);
                if (previous instanceof HTMLCanvasElement) {
                    previous.width = 0;
                    previous.height = 0;
                }
                setPageText("");
                setTextFailed(false);
                setBusy(false);
                if (savedPage.current !== page) {
                    timer = setTimeout(() => {
                        saveQueue.current = saveQueue.current.then(async () => {
                            if (cancelled)
                                return;
                            const result = await saveReading(bookId, page, "progress",variantId);
                            if (!cancelled) {
                                if (result.success)
                                    savedPage.current = page;
                                setMessage(result.error ?? result.success ?? "");
                            }
                        }).catch(() => { if (!cancelled)
                            setMessage(messages.current.saveError); });
                    }, 400);
                }
                // A text-layer failure must not hide a successfully rendered canvas or
                // stop bookmark/progress controls. Report it as a separate stage.
                try {
                    const text = await extractPageText(pdfPage, textAbort.signal);
                    if (!cancelled)
                        setPageText(text);
                }
                catch (reason: unknown) {
                    if (!cancelled) {
                        reportPdfError("text", reason, page);
                        setTextFailed(true);
                    }
                }
            }
            catch (reason: unknown) {
                if (cancelled || isRenderCancellation(reason))
                    return;
                const detail = reportPdfError("render", reason, page);
                setError({ key: "renderPdfError", detail: detail || "" });
                setBusy(false);
            }
        }
        void render();
        return () => {
            cancelled = true;
            textAbort.abort();
            renderTask?.cancel();
            if (timer)
                clearTimeout(timer);
            const release = () => {
                // Keep the last complete frame until its replacement is ready. Free
                // cancelled/offscreen backing stores after PDF.js has stopped using them.
                if (canvas && !canvas.isConnected) {
                    canvas.width = 0;
                    canvas.height = 0;
                }
            };
            if (renderTask)
                void renderTask.promise.then(release, release);
            else
                release();
        };
    }, [pdf, page, width, height, fit, zoom, bookId, variantId]);
    function goTo(value: number) {
        if (pdf && value !== page && Number.isInteger(value) && value >= 1 && value <= pdf.numPages) {
            setBusy(true);
            setPage(value);
            setMessage("");
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
<<<<<<< HEAD
    void render();
    return () => { cancelled = true; task?.cancel(); if (canvas && !canvas.isConnected) { canvas.width = 0; canvas.height = 0; } };
  }, [fit, height, nearby, number, pdf, width, zoom]);
  return <div ref={element} data-page={number} className="relative flex min-h-64 justify-center border-b border-[var(--line)] bg-[var(--surface)] py-3 last:border-b-0">
    <div ref={canvasHost} className="w-fit self-start" />
    {nearby && loading && <p className="absolute mt-8 text-sm text-[var(--muted)]">Загрузка страницы {number}…</p>}
    {failed && <p className="py-12 text-sm text-[var(--danger)]">Не удалось отобразить страницу {number}.</p>}
  </div>;
}

export function PdfReader({ bookId, variantId = bookId, initialPage, initialBookmarks }: {
  bookId: string; variantId?: string; initialPage: number; initialBookmarks: number[];
}) {
  const { t, locale } = useI18n(); const v = v051Copy(locale);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"width" | "page">("width");
  const [height, setHeight] = useState(650);
  const [width, setWidth] = useState(600);
  const [jump, setJump] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<{ key: "loadPdfError"; detail: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [text, setText] = useState("");
  const [textFailed, setTextFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [pending, startTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const positioned = useRef(false);
  const savedPage = useRef<number | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const messages = useRef(t);
  useEffect(() => { messages.current = t; }, [t]);
  const visiblePage = useCallback((next: number) => {
    setText(""); setTextFailed(false); setPage(next);
  }, []);

  useEffect(() => {
    const resize = () => setHeight(Math.max(300, window.innerHeight - 260));
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, Math.floor(entry.contentRect.width))));
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);
  const goTo = useCallback((next: number, smooth = true) => {
    if (!pdf || !Number.isInteger(next) || next < 1 || next > pdf.numPages) return;
    setMessage(""); setText(""); setTextFailed(false); setPage(next);
    scrollRoot?.querySelector<HTMLElement>(`[data-page="${next}"]`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [pdf, scrollRoot]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const delta = readerKeyDelta(event);
      if (!delta || !pdf || busy || error) return;
      event.preventDefault(); goTo(Math.max(1, Math.min(pdf.numPages, page + delta)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, error, goTo, page, pdf]);
  useEffect(() => {
    let cancelled = false; let task: PDFDocumentLoadingTask | undefined;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/books/${bookId}/access?variant=${variantId}`, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Войдите снова, чтобы читать материал." : "PDF недоступен. Возможно, материал снят с публикации или файл ещё не загружен.");
        const { url } = await response.json() as { url: string };
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const file = await fetch(url, { signal: abort.signal, cache: "no-store", referrerPolicy: "no-referrer" });
        if (!file.ok) throw new Error("Не удалось получить PDF. Повторите загрузку.");
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > 52428800) throw new Error("PDF превышает допустимый размер 50 МБ.");
        task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" });
        const document = await task.promise;
        if (!cancelled) { positioned.current = false; setPage(current => Math.min(Math.max(1, current), document.numPages)); setPdf(document); setBusy(false); }
      } catch (reason) {
        if (!cancelled) { setError({ key: "loadPdfError", detail: reportPdfError("load", reason) || "" }); setBusy(false); }
      }
    }
    void load();
    return () => { cancelled = true; abort.abort(); if (task) void task.destroy().catch(reason => reportPdfError("cleanup", reason)); };
  }, [attempt, bookId, variantId]);
  useEffect(() => {
    if (!pdf || !scrollRoot || positioned.current) return;
    const timer = window.setTimeout(() => { goTo(page, false); positioned.current = true; });
    return () => window.clearTimeout(timer);
  }, [goTo, page, pdf, scrollRoot]);
  useEffect(() => {
    if (!pdf) return;
    const abort = new AbortController();
    void pdf.getPage(page).then(source => extractPageText(source, abort.signal)).then(value => {
      if (!abort.signal.aborted) setText(value);
    }).catch(reason => {
      if (!abort.signal.aborted) { reportPdfError("text", reason, page); setTextFailed(true); }
    });
    return () => abort.abort();
  }, [page, pdf]);
  useEffect(() => {
    if (!pdf || savedPage.current === page) return;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.then(async () => {
        const result = await saveReading(bookId, page, "progress", variantId);
        if (result.success) savedPage.current = page;
        setMessage(result.error ?? result.success ?? "");
      }).catch(() => setMessage(messages.current.saveError));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [bookId, page, pdf, variantId]);
  function toggleBookmark() {
    const current = page; const removing = bookmarks.includes(current);
    startTransition(async () => {
      try {
        const result = await saveReading(bookId, current, removing ? "remove" : "bookmark", variantId);
        setMessage(result.error ?? result.success ?? "");
        if (result.success) setBookmarks(values => removing ? values.filter(value => value !== current) : [...values, current].sort((a, b) => a - b));
      } catch { setMessage(messages.current.saveError); }
    });
  }
  return <section aria-label={t.reader} className="space-y-5">
    {error ? <div className="form-error" role="alert"><p>{t[error.key]} {error.detail}</p><button className="button button-secondary button-reload mt-4" onClick={() => { setPdf(null); setError(null); setBusy(true); setAttempt(value => value + 1); }}><RefreshIcon />{t.reloadPdf}</button></div> : <p className="min-h-6 text-sm text-[var(--muted)]" role="status">{busy ? t.loadingPage : message || `${t.page} ${page} ${t.of} ${pdf?.numPages ?? "…"}`}</p>}
    <div ref={viewportRef} className="w-full min-w-0">
      <div ref={setScrollRoot} className="h-[calc(100vh-16rem)] min-h-[18.75rem] max-h-[900px] overflow-x-auto overflow-y-auto overscroll-contain border border-[var(--line)] bg-[var(--surface)]" aria-busy={busy} tabIndex={0} aria-label={t.reader}>
        {pdf && Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index + 1} pdf={pdf} number={index + 1} width={width} height={height} fit={fit} zoom={zoom} root={scrollRoot} onVisible={visiblePage} />)}
      </div>
    </div>
    {!busy && !error && <details className="border border-[var(--line)] p-4"><summary className="cursor-pointer text-sm font-semibold">{t.pageText} {page}</summary><p className="mt-4 whitespace-pre-wrap leading-7">{textFailed ? t.textPdfError : text || t.noText}</p></details>}
    {bookmarks.length > 0 && <nav aria-label={t.bookBookmarks} className="flex flex-wrap items-center gap-2"><span className="mr-2 text-sm">{t.bookmarks}</span>{bookmarks.map(value => <button className="button button-secondary button-small" disabled={!pdf || value > pdf.numPages} key={value} onClick={() => goTo(value)}>{t.page} {value}</button>)}</nav>}
    {!error && <div className="reader-controls sticky bottom-0 z-20 flex flex-wrap items-end gap-2 border border-[var(--line)] bg-[var(--surface)] p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <button className="button button-secondary" disabled={!pdf || page <= 1} onClick={() => goTo(page - 1)}>{t.previous}</button><span className="self-center tabular-nums" aria-live="polite">{page} / {pdf?.numPages ?? "…"}</span><button className="button button-secondary" disabled={!pdf || page >= pdf.numPages} onClick={() => goTo(page + 1)}>{t.next}</button>
      <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); goTo(Number(jump)); setJump(""); }}><label className="w-24"><span className="field-label">{t.page}</span><input className="field" aria-label={t.pageNumber} type="number" min={1} max={pdf?.numPages ?? 1} placeholder={String(page)} value={jump} disabled={!pdf} onChange={event => setJump(event.target.value)} /></label><button className="button button-secondary" disabled={!pdf}>{v.jump}</button></form>
      <div className="flex items-center gap-2"><button className="button button-secondary" aria-label={v.zoomOut} disabled={!pdf || zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button><span className="text-sm tabular-nums">{Math.round(zoom * 100)}%</span><button className="button button-secondary" aria-label={v.zoomIn} disabled={!pdf || zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button></div>
      <button className="button button-secondary" disabled={!pdf} aria-pressed={fit === "width" && zoom === 1} onClick={() => { setFit("width"); setZoom(1); }}>{v.fitWidth}</button><button className="button button-secondary" disabled={!pdf} aria-pressed={fit === "page" && zoom === 1} onClick={() => { setFit("page"); setZoom(1); }}>{v.fitPage}</button><button className="button bookmark-action" disabled={!pdf || pending} aria-pressed={bookmarks.includes(page)} onClick={toggleBookmark}><BookmarkIcon /><span>{pending ? t.saving : bookmarks.includes(page) ? t.removeBookmark : t.addBookmark}</span></button>
    </div>}
=======
    function toggleBookmark() {
        const currentPage = page;
        const removing = bookmarks.includes(currentPage);
        startTransition(async () => {
            try {
                const result = await saveReading(bookId, currentPage, removing ? "remove" : "bookmark",variantId);
                setMessage(result.error ?? result.success ?? "");
                if (result.success)
                    setBookmarks(values => removing ? values.filter(value => value !== currentPage) : [...values, currentPage].sort((a, b) => a - b));
            }
            catch {
                setMessage(messages.current.saveError);
            }
        });
    }
    return <section aria-label={t.reader} className="space-y-5">
    {error ? <div className="form-error" role="alert"><p>{t[error.key]} {error.detail}</p><button className="button button-secondary mt-4" onClick={() => { setPdf(null); setError(null); setBusy(true); setAttempt(a => a + 1); }}>{t.reloadPdf}</button></div> : <>

      <p className="min-h-6 text-sm text-[var(--muted)]" role="status">{busy ? t.loadingPage : message || `${t.page} ${page} ${t.of} ${pdf?.numPages ?? "…"}`}</p>
    </>}
    <div ref={viewportRef} className="w-full min-w-0 overflow-x-auto border border-[var(--line)] bg-[var(--surface)]" aria-busy={busy}><div ref={canvasHost} className="mx-auto w-fit min-h-64"/></div>
    {!busy && !error && <details className="border border-[var(--line)] p-4"><summary className="cursor-pointer text-sm font-semibold">{t.pageText + " "}{page}</summary><p className="mt-4 whitespace-pre-wrap leading-7">{textFailed ? t.textPdfError : pageText || t.noText}</p></details>}
    {bookmarks.length > 0 && <nav aria-label={t.bookBookmarks} className="flex flex-wrap items-center gap-2"><span className="mr-2 text-sm">{t.bookmarks}</span>{bookmarks.map(value => <button className="button button-secondary button-small" disabled={!pdf || value > pdf.numPages} key={value} onClick={() => goTo(value)}>{t.page + " "}{value}</button>)}</nav>}
    {!error&&<div className="reader-controls sticky bottom-0 z-20 flex flex-wrap items-end gap-2 border border-[var(--line)] bg-[var(--surface)] p-3" style={{paddingBottom:"max(0.75rem, env(safe-area-inset-bottom))"}}>
 <button className="button button-secondary" disabled={!pdf||page<=1||busy} onClick={()=>goTo(page-1)}>{t.previous}</button>
 <span className="self-center tabular-nums" aria-live="polite">{page} / {pdf?.numPages??"…"}</span>
 <button className="button button-secondary" disabled={!pdf||page>=pdf.numPages||busy} onClick={()=>goTo(page+1)}>{t.next}</button>
 <form className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();goTo(Number(jump));setJump("");}}>
 <label className="w-24"><span className="field-label">{t.page}</span><input className="field" aria-label={t.pageNumber} type="number" min={1} max={pdf?.numPages??1} placeholder={String(page)} value={jump} disabled={!pdf} onChange={event=>setJump(event.target.value)}/></label>
 <button className="button button-secondary" disabled={!pdf}>{v.jump}</button></form>
 <div className="flex items-center gap-2"><button className="button button-secondary" aria-label={v.zoomOut} disabled={!pdf||zoom<=0.5} onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))}>−</button><span className="text-sm tabular-nums">{Math.round(zoom*100)}%</span><button className="button button-secondary" aria-label={v.zoomIn} disabled={!pdf||zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+0.25))}>+</button></div>
 <button className="button button-secondary" disabled={!pdf} aria-pressed={fit==="width"&&zoom===1} onClick={()=>{setFit("width");setZoom(1);}}>{v.fitWidth}</button>
 <button className="button button-secondary" disabled={!pdf} aria-pressed={fit==="page"&&zoom===1} onClick={()=>{setFit("page");setZoom(1);}}>{v.fitPage}</button>
 <button className="button" disabled={!pdf||busy||pending} aria-pressed={bookmarks.includes(page)} onClick={toggleBookmark}>{pending?t.saving:bookmarks.includes(page)?t.removeBookmark:t.addBookmark}</button>
 </div>}
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
  </section>;
}
