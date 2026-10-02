"use client";

import { BOOK_GRADES } from "@/lib/book-model";

import { v051Copy } from "@/lib/v051-copy";

import { subjectMap } from "@/lib/catalog";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "./locale-provider";

import { EmptyState, Notice } from "./ui";

import { subjectName } from "@/lib/i18n";

import {
  initialLibraryFilters,
  libraryFilterUrl,
  type LibraryBook,
  type LibraryFilters,
} from "@/lib/library";

import type {
  ClassRow,
  SubjectRow,
} from "@/lib/database.types";

import { SubjectMotif } from "./subject-motif";
import { createLibrarySearchIndex, searchLibrary } from "@/lib/library-search";

function Highlight({ value, ranges }: { value: string; ranges: readonly [number, number][] }) {
  if (!ranges.length) return value;
  const merged = [...ranges].sort((a, b) => a[0] - b[0]).reduce<[number, number][]>((all, range) => {
    const last = all.at(-1);
    if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
    else all.push([range[0], range[1]]);
    return all;
  }, []);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push(value.slice(cursor, start));
    parts.push(<mark key={`${start}-${end}`}>{value.slice(start, end + 1)}</mark>);
    cursor = end + 1;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function LibraryBrowser({
  books,
  subjects,
  initial,
  truncated,
  studyIntent = false,
}: {
  books: LibraryBook[];
  classes: ClassRow[];
  subjects: SubjectRow[];
  initial: LibraryFilters;
  truncated: boolean;
  studyIntent?: boolean;
}) {
  const { t, locale } = useI18n();
  const p = v051Copy(locale);

  const subjectsById = useMemo(
    () => subjectMap(subjects),
    [subjects],
  );

  const [q, setQ] = useState(initial.q);
  const [grade, setGrade] = useState(initial.grade);
  const [subject, setSubject] = useState(initial.subject);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQ = useDebouncedValue(q, 275);

  const [previousInitial, setPreviousInitial] =
    useState(initial);

  // A deliberate server navigation may supply a fresh object with identical
  // initial values. Reset then, but never on local filter-state updates.
  if (previousInitial !== initial) {
    setPreviousInitial(initial);
    setQ(initial.q);
    setGrade(initial.grade);
    setSubject(initial.subject);
  }

  const searchIndex = useMemo(() => createLibrarySearchIndex(books.map(book => {
    const row = subjectsById.get(book.subject_id);
    const subjectLabel = subjectName(row, locale);
    const subjectNames = row ? [row.name, row.name_ru, row.name_kz, row.name_en, row.short_name].filter((value): value is string => !!value) : [];
    const quarter = book.quarter ? String(book.quarter) : "";
    return { ...book, description: book.description ?? null, tags: book.tags ?? [], quarter: book.quarter ?? null, subjectLabel, subjectNames, gradeLabel: book.grade ? `${book.grade} ${locale === "kk" ? "сынып" : locale === "en" ? "grade" : "класс"}` : "", quarterLabels: quarter ? [quarter, `${quarter} ${locale === "kk" ? "тоқсан" : locale === "en" ? "quarter" : "четверть"}`] : [] };
  })), [books, subjectsById, locale]);

  const { results: filteredBooks, suggestions } = useMemo(() => searchLibrary(searchIndex, debouncedQ, { grade, subject }, locale), [searchIndex, debouncedQ, grade, subject, locale]);

  useEffect(() => {
    const restore = () => {
      const values = initialLibraryFilters(
        Object.fromEntries(
          new URLSearchParams(
            window.location.search,
          ),
        ),
      );

      setQ(values.q);
      setGrade(values.grade);
      setSubject(values.subject);
    };

    window.addEventListener("popstate", restore);

    return () =>
      window.removeEventListener(
        "popstate",
        restore,
      );
  }, []);

  function change(values: LibraryFilters) {
    setQ(values.q);
    setGrade(values.grade);
    setSubject(values.subject);

    window.history.replaceState(
      window.history.state,
      "",
      libraryFilterUrl(
        window.location.href,
        values,
      ),
    );
  }

  return (
    <section aria-label={t.library}>
      <button
        type="button"
        className="button button-secondary library-filter-toggle"
        aria-controls="library-filter-fields"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((value) => !value)}
      >
        {locale === "ru" ? "Фильтры" : locale === "kk" ? "Сүзгілер" : "Filters"}
        <span aria-hidden="true">{[q, grade, subject].filter(Boolean).length || "⌄"}</span>
      </button>
      <div
        role="search"
        id="library-filter-fields"
        data-open={filtersOpen}
        className="library-filters mt-8 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,1.7fr)_minmax(6rem,.7fr)_minmax(10rem,1fr)_auto]"
      >
        <label>
          <span className="field-label">
            {t.title}
          </span>

          <input
            className="field"
            type="search"
            maxLength={100}
            value={q}
            onChange={(event) =>
              change({
                q: event.target.value,
                grade,
                subject,
              })
            }
          />
        </label>

        <label>
          <span className="field-label">
            {p.grade}
          </span>

          <select
            className="field"
            value={grade}
            onChange={(event) =>
              change({
                q,
                grade: event.target.value,
                subject,
              })
            }
          >
            <option value="">
              {p.allGrades}
            </option>

            {grade &&
              !BOOK_GRADES.some(
                (item) => String(item) === grade,
              ) && (
                <option value={grade}>
                  {t.unavailableFilter}
                </option>
              )}

            {BOOK_GRADES.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">
            {t.subject}
          </span>

          <select
            className="field"
            value={subject}
            onChange={(event) =>
              change({
                q,
                grade,
                subject: event.target.value,
              })
            }
          >
            <option value="">
              {t.allSubjects}
            </option>

            {subject &&
              !subjects.some(
                (item) => item.id === subject,
              ) && (
                <option value={subject}>
                  {t.unavailableFilter}
                </option>
              )}

            {subjects.map((item) => (
              <option
                value={item.id}
                key={item.id}
              >
                {subjectName(item, locale)}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button button-secondary"
          type="button"
          onClick={() =>
            change({
              q: "",
              grade: "",
              subject: "",
            })
          }
        >
          {t.resetFilters}
        </button>
      </div>

      {truncated && (
        <div className="mt-6">
          <Notice>
            {t.catalogLimit} {books.length}.{" "}
            {t.catalogLimitHint}
          </Notice>
        </div>
      )}

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="my-5 text-sm text-[var(--muted)]"
      >
        {t.results}: {filteredBooks.length}{q !== debouncedQ ? "…" : ""}
      </p>

      {!filteredBooks.length ? (
        <EmptyState title={t.noMaterials}>
          <p>{t.noMaterialsHint}</p>
          {!!suggestions.length && <div className="search-suggestions"><span>{locale === "kk" ? "Мүмкін, сіз мынаны іздедіңіз:" : locale === "en" ? "Did you mean:" : "Возможно, вы имели в виду:"}</span>{suggestions.map(value => <button type="button" key={value} onClick={() => change({ q: value, grade, subject })}>{value}</button>)}</div>}
        </EmptyState>
      ) : (
        <ul className="library-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBooks.map(({ item: book, titleMatches, subjectMatches, descriptionMatches, tagMatches }) => (
            <li
              key={book.id}
              className="min-w-0"
            >
              <Link prefetch={false} href={"/books/" + book.id + "/read" + (studyIntent ? "#ai-study" : "")} className="library-card p-6 h-full flex flex-col" aria-label={t.openMaterial + ": " + book.title}>
              <SubjectMotif subject={subjectsById.get(book.subject_id)} />

              <p className="field-label">
                <Highlight value={book.subjectLabel} ranges={subjectMatches} />
              </p>

              <h2 className="text-xl font-semibold">
                <Highlight value={book.title} ranges={titleMatches} />
              </h2>

              {book.description && <p className="library-description"><Highlight value={book.description} ranges={descriptionMatches} /></p>}

              {!!book.tags.length && <div className="library-tags" aria-label={locale === "kk" ? "Тегтер" : locale === "en" ? "Tags" : "Теги"}>{book.tags.map(tag => <span key={tag}><Highlight value={tag} ranges={tagMatches.get(tag) ?? []} /></span>)}</div>}

              <p className="mt-3 text-sm text-[var(--muted)]">
                {book.grade
                  ? p.grade + " " + book.grade
                  : ""}
                {book.quarter ? ` · ${book.quarter} ${locale === "kk" ? "тоқсан" : locale === "en" ? "quarter" : "четверть"}` : ""}
              </p>

              <span className="mt-auto pt-5 inline-flex min-h-11 items-center text-sm font-semibold underline">{t.openMaterial}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
