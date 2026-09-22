"use client";

import { PdfThumbnails } from "./pdf-thumbnails";
import { designCopy } from "@/lib/design-copy";
import { saveReading } from "@/app/actions/reading";
import { useI18n } from "@/components/locale-provider";
import { BookmarkIcon } from "@/components/icons";
import { ReloadButton } from "@/components/reload-button";
import { extractPageText } from "@/lib/pdf-page-text";
import {
  isRenderCancellation,
  reportPdfError,
} from "@/lib/pdf-reader-errors";
import { readerKeyDelta, readerScale } from "@/lib/reader-controls";
import { v051Copy } from "@/lib/v051-copy";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";

function PdfPage({
  pdf,
  number,
  width,
  height,
  fit,
  zoom,
  root,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  height: number;
  fit: "width" | "page";
  zoom: number;
  root: HTMLDivElement | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();

  const [nearby, setNearby] = useState(number === 1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!element.current || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) return;

        setNearby(true);


      },
      {
        root,
        rootMargin: "900px 0px",
        threshold: [0, 0.5],
      },
    );

    observer.observe(element.current);

    return () => observer.disconnect();
  }, [number, root]);

  useEffect(() => {
    if (!nearby) return;

    let cancelled = false;
    let task: RenderTask | undefined;
    let canvas: HTMLCanvasElement | undefined;

    async function render() {
      try {
        setLoading(true);
        setFailed(false);

        const source = await pdf.getPage(number);

        if (cancelled) return;

        const base = source.getViewport({
          scale: 1,
        });

        const viewport = source.getViewport({
          scale: readerScale(
            width,
            height,
            base.width,
            base.height,
            fit,
            zoom,
          ),
        });

        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        canvas = document.createElement("canvas");

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);

        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        canvas.setAttribute("aria-hidden", "true");

        task = source.render({
          canvas,
          viewport,
          transform:
            ratio === 1
              ? undefined
              : [ratio, 0, 0, ratio, 0, 0],
        });

        await task.promise;

        if (!cancelled) {
          canvasHost.current?.replaceChildren(canvas);
        }
      } catch (reason) {
        if (!cancelled && !isRenderCancellation(reason)) {
          reportPdfError("render", reason, number);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      task?.cancel();

      if (canvas && !canvas.isConnected) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [fit, height, nearby, number, pdf, width, zoom]);

  return (
    <div
      ref={element}
      data-page={number}
      className="relative flex min-h-64 justify-center border-b border-[var(--line)] bg-[var(--surface)] py-3 last:border-b-0"
    >
      <div
        ref={canvasHost}
        className="w-fit self-start"
      />

      {nearby && loading && (
        <p className="absolute mt-8 text-sm text-[var(--muted)]">
          {locale === "kk"
            ? `${number}-бет жүктелуде…`
            : locale === "en"
            ? `Loading page ${number}…`
            : `Загрузка страницы ${number}…`}
        </p>
      )}

      {failed && (
        <p className="py-12 text-sm text-[var(--danger)]">
          {locale === "kk"
            ? `${number}-бетті көрсету мүмкін болмады.`
            : locale === "en"
            ? `Could not display page ${number}.`
            : `Не удалось отобразить страницу ${number}.`}
        </p>
      )}
    </div>
  );
}

export function PdfReader({
  bookId,
  variantId = bookId,
  initialPage,
  initialBookmarks,
}: {
  bookId: string;
  variantId?: string;
  initialPage: number;
  initialBookmarks: number[];
}) {
  const { t, locale } = useI18n();
  const v = v051Copy(locale);
  const c = designCopy(locale);
  const [thumbnails,setThumbnails]=useState(false);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"width" | "page">("width");

  const [height, setHeight] = useState(650);
  const [width, setWidth] = useState(600);

  const [jump, setJump] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [error, setError] = useState<{
    key: "loadPdfError" | "renderPdfError";
    detail: string;
  } | null>(null);

  const [busy, setBusy] = useState(true);

  const [text, setText] = useState("");
  const [textFailed, setTextFailed] = useState(false);

  const [message, setMessage] = useState("");

  const [bookmarks, setBookmarks] = useState(initialBookmarks);

  const [pending, startTransition] = useTransition();

  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] =
    useState<HTMLDivElement | null>(null);

  const positioned = useRef(false);
  const currentPage = useRef(initialPage);
  const navigationAnchor = useRef<number|null>(initialPage);
  useEffect(()=>{currentPage.current=page;},[page]);

  const savedPage = useRef<number | null>(null);

  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const messages = useRef(t);

  useEffect(() => {
    messages.current = t;
  }, [t]);

  const visiblePage = useCallback((next: number) => {
    if(currentPage.current===next)return;
    currentPage.current=next;
    setText("");
    setTextFailed(false);
    setPage(next);
  }, []);

  useEffect(() => {
    const resize = () => {
      setHeight(Math.max(300, window.innerHeight - 260));
    };

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(
        Math.max(
          180,
          Math.floor(entry.contentRect.width)-24,
        ),
      );
    });

    observer.observe(viewportRef.current);

    return () => observer.disconnect();
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (
        !pdf ||
        !Number.isInteger(next) ||
        next < 1 ||
        next > pdf.numPages
      ) {
        return;
      }

      setMessage("");
      if(currentPage.current!==next){setText("");setTextFailed(false);}
      currentPage.current=next;
      setPage(next);

      navigationAnchor.current=next;
      const target=scrollRoot?.querySelector<HTMLElement>(`[data-page="${next}"]`);
      if(scrollRoot&&target)scrollRoot.scrollTo({
        top:scrollRoot.scrollTop+target.getBoundingClientRect().top-scrollRoot.getBoundingClientRect().top-scrollRoot.clientTop,
        behavior:"instant",
      });
    },
    [pdf, scrollRoot],
  );

  useEffect(() => {
    if(!scrollRoot)return;
    let frame=0;
    const update=()=>{
      frame=0;
      if(navigationAnchor.current!==null)return;
      const bounds=scrollRoot.getBoundingClientRect(),marker=bounds.top+Math.min(80,bounds.height*.2);
      // Preload margins are never evidence of the current reading page.
      for(const element of scrollRoot.querySelectorAll<HTMLElement>("[data-page]")){
        const rect=element.getBoundingClientRect();
        if(rect.bottom>marker&&rect.top<bounds.bottom){visiblePage(Number(element.dataset.page));break;}
      }
    };
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const manual=()=>{navigationAnchor.current=null;};
    scrollRoot.addEventListener("scroll",onScroll,{passive:true});
    scrollRoot.addEventListener("wheel",manual,{passive:true});
    scrollRoot.addEventListener("touchstart",manual,{passive:true});
    scrollRoot.addEventListener("pointerdown",manual);
    return ()=>{scrollRoot.removeEventListener("scroll",onScroll);scrollRoot.removeEventListener("wheel",manual);scrollRoot.removeEventListener("touchstart",manual);scrollRoot.removeEventListener("pointerdown",manual);cancelAnimationFrame(frame);};
  },[scrollRoot,visiblePage]);

  useEffect(()=>{
    if(!scrollRoot||!pdf)return;
    let frame=0;
    const anchor=()=>{
      frame=0;
      const number=navigationAnchor.current;
      if(number===null)return;
      const element=scrollRoot.querySelector<HTMLElement>(`[data-page="${number}"]`);
      if(element)scrollRoot.scrollTo({top:scrollRoot.scrollTop+element.getBoundingClientRect().top-scrollRoot.getBoundingClientRect().top-scrollRoot.clientTop,behavior:"instant"});
    };
    const observer=new ResizeObserver(()=>{if(!frame)frame=requestAnimationFrame(anchor);});
    for(const element of scrollRoot.children)observer.observe(element);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[scrollRoot,pdf]);
  useEffect(()=>{navigationAnchor.current=currentPage.current;},[width,height,fit,zoom]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const delta = readerKeyDelta(event);

      if (!delta || !pdf || busy || error) return;

      event.preventDefault();

      goTo(
        Math.max(
          1,
          Math.min(pdf.numPages, page + delta),
        ),
      );
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, error, goTo, page, pdf]);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;

    const abort = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/books/${bookId}/access?variant=${variantId}`,
          {
            cache: "no-store",
            signal: abort.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Войдите снова, чтобы читать материал."
              : "PDF недоступен. Возможно, материал снят с публикации или файл ещё не загружен.",
          );
        }

        const { url } = (await response.json()) as {
          url: string;
        };

        const pdfjs = await import(
          "pdfjs-dist/legacy/build/pdf.mjs"
        );

        if (cancelled) return;

        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const file = await fetch(url, {
          signal: abort.signal,
          cache: "no-store",
          referrerPolicy: "no-referrer",
        });

        if (!file.ok) {
          throw new Error(
            locale === "kk"
              ? "PDF файлын алу мүмкін болмады. Қайта жүктеп көріңіз."
              : locale === "en"
              ? "Failed to fetch PDF. Please reload."
              : "Не удалось получить PDF. Повторите загрузку.",
          );
        }

        const bytes = await file.arrayBuffer();

        if (bytes.byteLength > 52428800) {
          throw new Error(
            locale === "kk"
              ? "PDF көлемі рұқсат етілген 50 МБ шегінен асады."
              : locale === "en"
              ? "PDF exceeds maximum allowed size of 50 MB."
              : "PDF превышает допустимый размер 50 МБ.",
          );
        }

        if (cancelled) return;

        task = pdfjs.getDocument({
          data: bytes,
          useSystemFonts: true,
          cMapUrl: "/pdfjs/cmaps/",
          standardFontDataUrl:
            "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
          iccUrl: "/pdfjs/iccs/",
        });

        const document = await task.promise;

        if (cancelled) return;

        positioned.current = false;

        setPage((current) =>
          Math.min(
            Math.max(1, current),
            document.numPages,
          ),
        );

        setPdf(document);
        setBusy(false);
      } catch (reason) {
        if (!cancelled) {
          const detail =
            reportPdfError("load", reason) || "";

          setError({
            key: "loadPdfError",
            detail,
          });

          setBusy(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      abort.abort();

      if (task) {
        void task
          .destroy()
          .catch((reason) =>
            reportPdfError("cleanup", reason),
          );
      }
    };
  }, [attempt, bookId, variantId, locale]);

  useEffect(() => {
    if (!pdf || !scrollRoot || positioned.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      goTo(page);
      positioned.current = true;
    });

    return () => {
      window.clearTimeout(timer);
    };
  }, [goTo, page, pdf, scrollRoot]);

  useEffect(() => {
    if (!pdf) return;

    const abort = new AbortController();

    void pdf
      .getPage(page)
      .then((source) =>
        extractPageText(
          source,
          abort.signal,
        ),
      )
      .then((value) => {
        if (!abort.signal.aborted) {
          setText(value);
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) {
          reportPdfError("text", reason, page);
          setTextFailed(true);
        }
      });

    return () => {
      abort.abort();
    };
  }, [page, pdf]);

  useEffect(() => {
    if (!pdf || savedPage.current === page) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .then(async () => {
          const result = await saveReading(
            bookId,
            page,
            "progress",
            variantId,
          );

          if (result.success) {
            savedPage.current = page;
          }

          setMessage(
            result.error ?? result.success ?? "",
          );
        })
        .catch(() => {
          setMessage(
            messages.current.saveError,
          );
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bookId, page, pdf, variantId]);

  function toggleBookmark() {
    const current = page;
    const removing = bookmarks.includes(current);

    startTransition(async () => {
      try {
        const result = await saveReading(
          bookId,
          current,
          removing ? "remove" : "bookmark",
          variantId,
        );

        setMessage(
          result.error ?? result.success ?? "",
        );

        if (result.success) {
          setBookmarks((values) =>
            removing
              ? values.filter(
                  (value) => value !== current,
                )
              : [
                  ...values,
                  current,
                ].sort(
                  (a, b) => a - b,
                ),
          );
        }
      } catch {
        setMessage(
          messages.current.saveError,
        );
      }
    });
  }

  return (
    <section
      aria-label={t.reader}
      className="pdf-reader"
    >
      {error ? (
        <div
          className="form-error"
          role="alert"
        >
          <p>
            {t[error.key]}{" "}
            {error.detail}
          </p>

          <ReloadButton
            className="mt-4"
            onClick={() => {
              setPdf(null);
              setError(null);
              setBusy(true);
              setAttempt(
                (value) => value + 1,
              );
            }}
          >
            {t.reloadPdf}
          </ReloadButton>
        </div>
      ) : (
        <p
          className="min-h-6 text-sm text-[var(--muted)]"
          role="status"
        >
          {busy
            ? t.loadingPage
            : message ||
              `${t.page} ${page} ${t.of} ${
                pdf?.numPages ?? "…"
              }`}
        </p>
      )}

      <div className="reader-stage" data-thumbnails={thumbnails}>
        {pdf&&thumbnails&&<PdfThumbnails pdf={pdf} page={page} onSelect={goTo}/>}
      <div
        ref={viewportRef}
        className="w-full min-w-0"
      >
        <div
          ref={setScrollRoot}
          className="pdf-scroll-viewport"
          aria-busy={busy}
          tabIndex={0}
          aria-label={t.reader}
        >
          {pdf &&
            Array.from(
              {
                length: pdf.numPages,
              },
              (_, index) => (
                <PdfPage
                  key={index + 1}
                  pdf={pdf}
                  number={index + 1}
                  width={width}
                  height={height}
                  fit={fit}
                  zoom={zoom}
                  root={scrollRoot}
                />
              ),
            )}
        </div>
      </div>

      </div>
      {!busy && !error && (
        <details className="border border-[var(--line)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {t.pageText} {page}
          </summary>

          <p className="mt-4 whitespace-pre-wrap leading-7">
            {textFailed
              ? t.textPdfError
              : text || t.noText}
          </p>
        </details>
      )}

      {bookmarks.length > 0 && (
        <nav
          aria-label={t.bookBookmarks}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-2 text-sm">
            {t.bookmarks}
          </span>

          {bookmarks.map((value) => (
            <button
              className="button button-secondary button-small"
              disabled={
                !pdf ||
                value > pdf.numPages
              }
              key={value}
              onClick={() => goTo(value)}
            >
              {t.page} {value}
            </button>
          ))}
        </nav>
      )}

      {!error && (
        <div
          className="reader-controls"
          style={{
            paddingBottom:
              "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <button type="button" className="button button-secondary thumbnail-toggle" disabled={!pdf} aria-pressed={thumbnails} onClick={()=>setThumbnails(value=>!value)} aria-label={c.thumbnails}>▤</button>
          <button
            className="button button-secondary"
            disabled={
              !pdf ||
              page <= 1
            }
            onClick={() =>
              goTo(page - 1)
            }
          >
            {t.previous}
          </button>

          <span
            className="self-center tabular-nums"
            aria-live="polite"
          >
            {page} /{" "}
            {pdf?.numPages ?? "…"}
          </span>

          <button
            className="button button-secondary"
            disabled={
              !pdf ||
              page >= pdf.numPages
            }
            onClick={() =>
              goTo(page + 1)
            }
          >
            {t.next}
          </button>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              goTo(Number(jump));
              setJump("");
            }}
          >
            <label className="w-24">
              <span className="field-label">
                {t.page}
              </span>

              <input
                className="field"
                aria-label={t.pageNumber}
                type="number"
                min={1}
                max={
                  pdf?.numPages ?? 1
                }
                placeholder={String(page)}
                value={jump}
                disabled={!pdf}
                onChange={(event) =>
                  setJump(
                    event.target.value,
                  )
                }
              />
            </label>

            <button
              className="button button-secondary"
              disabled={!pdf}
            >
              {v.jump}
            </button>
          </form>

          <div className="flex items-center gap-2">
            <button
              className="button button-secondary"
              aria-label={v.zoomOut}
              disabled={
                !pdf ||
                zoom <= 0.5
              }
              onClick={() =>
                setZoom(
                  (value) =>
                    Math.max(
                      0.5,
                      value - 0.25,
                    ),
                )
              }
            >
              −
            </button>

            <span className="text-sm tabular-nums">
              {Math.round(
                zoom * 100,
              )}
              %
            </span>

            <button
              className="button button-secondary"
              aria-label={v.zoomIn}
              disabled={
                !pdf ||
                zoom >= 3
              }
              onClick={() =>
                setZoom(
                  (value) =>
                    Math.min(
                      3,
                      value + 0.25,
                    ),
                )
              }
            >
              +
            </button>
          </div>

          <button
            className="button button-secondary"
            disabled={!pdf}
            aria-pressed={
              fit === "width" &&
              zoom === 1
            }
            onClick={() => {
              setFit("width");
              setZoom(1);
            }}
          >
            {v.fitWidth}
          </button>

          <button
            className="button button-secondary"
            disabled={!pdf}
            aria-pressed={
              fit === "page" &&
              zoom === 1
            }
            onClick={() => {
              setFit("page");
              setZoom(1);
            }}
          >
            {v.fitPage}
          </button>

          <button
            className="button bookmark-action"
            disabled={
              !pdf || pending
            }
            aria-pressed={bookmarks.includes(
              page,
            )}
            onClick={toggleBookmark}
          >
            <BookmarkIcon />

            <span>
              {pending
                ? t.saving
                : bookmarks.includes(
                      page,
                    )
                  ? t.removeBookmark
                  : t.addBookmark}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
