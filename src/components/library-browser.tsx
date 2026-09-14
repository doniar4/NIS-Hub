"use client";
import { subjectMap } from "@/lib/catalog";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "./locale-provider";
import { EmptyState, Notice } from "./ui";
import { subjectName } from "@/lib/i18n";
import { filterBooks, initialLibraryFilters, libraryFilterUrl, type LibraryBook, type LibraryFilters } from "@/lib/library";
import type { ClassRow, SubjectRow } from "@/lib/database.types";

export function LibraryBrowser({ books, classes, subjects, initial, truncated }: {
  books: LibraryBook[]; classes: ClassRow[]; subjects: SubjectRow[]; initial: LibraryFilters; truncated: boolean;
}) {
  const { t, locale } = useI18n();
  const subjectsById = useMemo(()=>subjectMap(subjects),[subjects]);
  const [q, setQ] = useState(initial.q);
  const [classId, setClassId] = useState(initial.classId);
  const [subject, setSubject] = useState(initial.subject);
  const [previousInitial, setPreviousInitial] = useState(initial);
  // A deliberate server navigation may supply a fresh object with identical
  // initial values. Reset then, but never on local filter-state updates.
  if (previousInitial !== initial) {
    setPreviousInitial(initial);
    setQ(initial.q); setClassId(initial.classId); setSubject(initial.subject);
  }
  const filteredBooks = useMemo(() => filterBooks(books, { q, classId, subject })
    .sort((a, b) => a.title.localeCompare(b.title, locale)), [books, q, classId, subject, locale]);
  useEffect(() => {
    const restore = () => {
      const values = initialLibraryFilters(Object.fromEntries(new URLSearchParams(window.location.search)));
      setQ(values.q); setClassId(values.classId); setSubject(values.subject);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function change(values: LibraryFilters) {
    setQ(values.q); setClassId(values.classId); setSubject(values.subject);
    window.history.replaceState(window.history.state, "", libraryFilterUrl(window.location.href, values));
  }
  return <section aria-label={t.library}>
    <div role="search" className="mt-8 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
      <label><span className="field-label">{t.title}</span><input className="field" type="search" maxLength={100}
        value={q} onChange={event => change({ q: event.target.value, classId, subject })}/></label>
      <label><span className="field-label">{t.class}</span><select className="field" value={classId}
        onChange={event => change({ q, classId: event.target.value, subject })}>
        <option value="">{t.allClasses}</option>
        {classId && !classes.some(item => item.id === classId) && <option value={classId}>{t.unavailableFilter}</option>}
        {classes.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>
      <label><span className="field-label">{t.subject}</span><select className="field" value={subject}
        onChange={event => change({ q, classId, subject: event.target.value })}>
        <option value="">{t.allSubjects}</option>
        {subject && !subjects.some(item => item.id === subject) && <option value={subject}>{t.unavailableFilter}</option>}
        {subjects.map(item => <option value={item.id} key={item.id}>{subjectName(item, locale)}</option>)}
      </select></label>
      <button className="button button-secondary" type="button" onClick={() => change({ q: "", classId: "", subject: "" })}>{t.resetFilters}</button>
    </div>
    {truncated && <div className="mt-6"><Notice>{t.catalogLimit} {books.length}. {t.catalogLimitHint}</Notice></div>}
    <p role="status" aria-live="polite" aria-atomic="true" className="my-5 text-sm text-[var(--muted)]">{t.results}: {filteredBooks.length}</p>
    {!filteredBooks.length ? <EmptyState title={t.noMaterials}>{t.noMaterialsHint}</EmptyState> :
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredBooks.map(book =>
        <li key={book.id} className="border border-[var(--line)] bg-[var(--surface)] p-6">
          <p className="field-label">{subjectName(subjectsById.get(book.subject_id), locale)}</p>
          <h2 className="text-xl font-semibold"><Link prefetch={false} className="underline-offset-4 hover:underline" href={"/books/" + book.id}>{book.title}</Link></h2>
          <p className="mt-3 text-sm text-[var(--muted)]">{[classes.find(item => item.id === book.class_id)?.name, book.language].filter(Boolean).join(" · ")}</p>
          <Link prefetch={false} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline" href={"/books/" + book.id}
            aria-label={t.openMaterial + ": " + book.title}>{t.openMaterial}</Link>
        </li>)}</ul>}
  </section>;
}
