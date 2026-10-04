"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import { BOOK_GRADES } from "@/lib/book-model";
import { subjectName } from "@/lib/i18n";
import {
  initialLibraryFilters,
  libraryFilterUrl,
  type LibraryFilters,
  type LibraryPage,
} from "@/lib/library";
import type { SubjectRow } from "@/lib/database.types";
import { useI18n } from "./locale-provider";
import { SubjectMotif } from "./subject-motif";

type Personal = {
  history: { query: string; searched_at: string }[];
  recent: { id: string; title: string; opened_at: string }[];
};
export function LibraryBrowser({
  page,
  personal: seedPersonal,
  subjects,
  initial,
  studyIntent = false,
  mutateAction: changeLibrary,
}: {
  page: LibraryPage;
  personal: Personal;
  subjects: SubjectRow[];
  initial: LibraryFilters;
  studyIntent?: boolean;
  mutateAction: typeof import("@/app/actions/library").changeLibrary;
}) {
  const { t, locale } = useI18n();
  const label = (ru: string, kk: string, en: string) =>
    locale === "ru" ? ru : locale === "kk" ? kk : en;
  const [filters, setFilters] = useState(initial),
    [query, setQuery] = useState(initial.q);
  const [result, setResult] = useState(page),
    [personal, setPersonal] = useState(seedPersonal);
  const [tab, setTab] = useState("catalog");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0),
    initialRequest = useRef(true);
  const [revision, setRevision] = useState(0);
  const copy = {
    catalog: label("Каталог", "Каталог", "Catalog"),
    activity: label("Активность", "Белсенділік", "Activity"),
  };
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => (f.q === query ? f : { ...f, q: query })),
      300,
    );
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const restore = () => {
      const next = initialLibraryFilters(
        Object.fromEntries(new URLSearchParams(location.search)),
      );
      setFilters(next);
      setQuery(next.q);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    window.history.replaceState(
      window.history.state,
      "",
      libraryFilterUrl(window.location.href, filters),
    );
  }, [filters]);
  useEffect(() => {
    if (initialRequest.current) {
      initialRequest.current = false;
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++sequence.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      ...filters,
    });
    // Clear the previous query at the async request boundary; never append it
    // to a response for different filters.
    queueMicrotask(() => {
      if (!controller.signal.aborted && tab !== "activity")
        setResult({ books: [], total: 0, nextOffset: null, suggestions: [] });
    });
    fetch(
      tab === "activity" ? "/api/library?personal=1" : `/api/library?${params}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (version === sequence.current) {
          if (tab === "activity") setPersonal(data);
          else setResult(data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            label(
              "Не удалось загрузить библиотеку.",
              "Кітапхана жүктелмеді.",
              "Could not load the library.",
            ),
          );
      })
      .finally(() => {
        if (version === sequence.current) setLoading(false);
      });
    return () => controller.abort();
    // The response is language-neutral; locale changes only affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tab, revision]);
  useEffect(() => {
    if (!filters.q.trim()) return;
    const timer = setTimeout(
      () =>
        startTransition(async () => {
          await changeLibrary({ kind: "search", name: filters.q }).catch(()=>undefined);
        }),
      1200,
    );
    return () => clearTimeout(timer);
  }, [filters.q, changeLibrary]);
  async function more() {
    if (result.nextOffset === null || loading) return;
    const version = sequence.current;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      ...filters,
      offset: String(result.nextOffset),
    });
    try {
      const response = await fetch(`/api/library?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw Error();
      const data: LibraryPage = await response.json();
      if (version === sequence.current)
        setResult((prev) => ({
          ...data,
          books: [
            ...prev.books,
            ...data.books.filter(
              (b) => !prev.books.some((old) => old.id === b.id),
            ),
          ],
        }));
    } catch {
      if (!controller.signal.aborted)
        setError(
          label(
            "Не удалось загрузить следующую страницу.",
            "Келесі бет жүктелмеді.",
            "Could not load the next page.",
          ),
        );
    } finally {
      if (version === sequence.current) setLoading(false);
    }
  }
  function mutate(input: Parameters<typeof changeLibrary>[0]) {
    startTransition(async () => {
      const response = await changeLibrary(input).catch(()=>({ok:false as const,error:label("Не удалось сохранить. Повторите попытку.","Сақталмады. Қайталап көріңіз.","Could not save. Please retry.")}));
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setError("");
      if (input.kind === "clear") {
        try {
          const r = await fetch("/api/library?personal=1");
          if (!r.ok) throw Error();
          setPersonal(await r.json());
          setRevision((v) => v + 1);
        } catch {
          setError(
            label(
              "Изменение сохранено. Обновите страницу.",
              "Өзгеріс сақталды. Бетті жаңартыңыз.",
              "Saved. Please refresh the page.",
            ),
          );
        }
      }
    });
  }
  return (
    <section className="library-workspace" aria-label={t.library}>
      <nav
        className="library-tabs"
        aria-label={label(
          "Разделы библиотеки",
          "Кітапхана бөлімдері",
          "Library sections",
        )}
      >
        {Object.entries(copy).map(([id, title]) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "activity" ? (
        <div className="library-activity">
          <header>
            <h2>Library Activity</h2>
            <button
              type="button"
              className="button button-secondary"
              disabled={pending}
              onClick={() => mutate({ kind: "clear" })}
            >
              {label("Очистить историю", "Тарихты тазалау", "Clear history")}
            </button>
          </header>
          <div className="library-activity-columns">
            <section>
              <h3>
                {label("История поиска", "Іздеу тарихы", "Search history")}
              </h3>
              {personal.history.length ? (
                personal.history.map((h) => (
                  <button
                    className="library-history-row"
                    type="button"
                    key={h.query}
                    onClick={() => {
                      setQuery(h.query);
                      setFilters((f) => ({ ...f, q: h.query }));
                      setTab("catalog");
                    }}
                  >
                    {h.query}
                    <time>
                      {new Date(h.searched_at).toLocaleDateString(locale)}
                    </time>
                  </button>
                ))
              ) : (
                <p>
                  {label(
                    "Здесь появятся ваши поиски.",
                    "Іздеулеріңіз осында көрсетіледі.",
                    "Your searches will appear here.",
                  )}
                </p>
              )}
            </section>
            <section>
              <h3>
                {label(
                  "Недавние материалы",
                  "Соңғы материалдар",
                  "Recently opened",
                )}
              </h3>
              {personal.recent.length ? (
                personal.recent.map((b) => (
                  <Link
                    className="library-history-row"
                    href={`/books/${b.id}/read`}
                    key={b.id}
                  >
                    {b.title}
                    <ArrowUpRight size={16} />
                  </Link>
                ))
              ) : (
                <p>
                  {label(
                    "Здесь появятся открытые материалы.",
                    "Ашылған материалдар осында көрсетіледі.",
                    "Opened materials will appear here.",
                  )}
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="library-search-fields" role="search">
            <label>
              <span className="field-label">
                {label(
                  "Название, автор или предмет",
                  "Атауы, авторы немесе пәні",
                  "Title, author or subject",
                )}
              </span>
              <input
                type="search"
                className="field"
                maxLength={100}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">
                {label("Класс", "Сынып", "Grade")}
              </span>
              <select
                className="field"
                value={filters.grade}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, grade: e.target.value }))
                }
              >
                <option value="">
                  {label("Все классы", "Барлық сыныптар", "All grades")}
                </option>
                {BOOK_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">{t.subject}</span>
              <select
                className="field"
                value={filters.subject}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, subject: e.target.value }))
                }
              >
                <option value="">{t.allSubjects}</option>
                {subjects.map((s) => (
                  <option value={s.id} key={s.id}>
                    {subjectName(s, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setQuery("");
                setFilters({ q: "", grade: "", subject: "" });
              }}
            >
              {t.resetFilters}
            </button>
          </div>
          <p className="library-result-count" role="status" aria-live="polite">
            {loading
              ? label("Загрузка…", "Жүктелуде…", "Loading…")
              : `${t.results}: ${result.total} · ${label("Показано", "Көрсетілді", "Showing")} ${result.books.length}`}
          </p>
          {!loading && !result.books.length && (
            <div className="library-empty">
              <h2>{t.noMaterials}</h2>
              <p>{t.noMaterialsHint}</p>
              {!!result.suggestions.length && (
                <div className="search-suggestions">
                  {label(
                    "Возможно, вы имели в виду:",
                    "Мүмкін, сіз іздегеніңіз:",
                    "Did you mean:",
                  )}
                  {result.suggestions.map((s) => (
                    <button type="button" key={s} onClick={() => setQuery(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <ul className="library-grid library-catalog-grid">
            {result.books.map((book) => (
              <li className="library-catalog-card" key={book.id}>
                <Link
                  prefetch={false}
                  href={`/books/${book.id}/read${studyIntent ? "#ai-study" : ""}`}
                  className="library-material-link"
                  onClick={() =>
                    startTransition(async () => {
                      await changeLibrary({ kind: "recent", bookId: book.id }).catch(()=>undefined);
                    })
                  }
                >
                  <SubjectMotif
                    subject={subjects.find((s) => s.id === book.subject_id)}
                  />
                  <p className="library-card-subject">
                    {subjectName(
                      subjects.find((s) => s.id === book.subject_id),
                      locale,
                    )}
                  </p>
                  <h2>{book.title}</h2>
                  <p className="library-card-author">
                    {book.author ||
                      label(
                        "Автор не указан",
                        "Автор көрсетілмеген",
                        "Author not specified",
                      )}
                  </p>
                  {book.description && (
                    <p className="library-description">{book.description}</p>
                  )}
                  <div className="library-card-metadata">
                    {book.grade && (
                      <span>
                        {label("Класс", "Сынып", "Grade")} {book.grade}
                      </span>
                    )}
                    {book.quarter && (
                      <span>
                        {book.quarter} {label("четверть", "тоқсан", "quarter")}
                      </span>
                    )}
                    {(book.languages ?? []).map((l) => (
                      <span key={l} lang={l === "kz" ? "kk" : l}>
                        {(
                          {
                            ru: "Русский",
                            kz: "Қазақша",
                            en: "English",
                            und: label(
                              "Язык не указан",
                              "Тіл көрсетілмеген",
                              "Language unspecified",
                            ),
                          } as Record<string, string>
                        )[l] ?? l}
                      </span>
                    ))}
                  </div>
                  {!!book.tags?.length && (
                    <div className="library-tags">
                      {book.tags.slice(0, 4).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <span className="library-open-label">
                    {t.openMaterial}
                    <ArrowUpRight size={17} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {result.nextOffset !== null && (
            <button
              type="button"
              className="button button-secondary library-load-more"
              disabled={loading}
              onClick={() => void more()}
            >
              {loading
                ? label("Загрузка…", "Жүктелуде…", "Loading…")
                : label("Показать ещё", "Тағы көрсету", "Show more")}
            </button>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="library-error">
          {error}
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            {label("Повторить", "Қайталау", "Retry")}
          </button>
        </div>
      )}
    </section>
  );
}
