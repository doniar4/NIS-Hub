// Compatibility adapter for older, unrelated visual fixtures. New Library tests
// exercise the paginated transport directly in library-reader-browser.smoke.ts.
import { LibraryBrowser as Browser } from "../../src/components/library-browser";
import { useEffect } from "react";
import { initialLibraryFilters } from "../../src/lib/library";
import {
  filterBooks,
  type LibraryBook,
  type LibraryFilters,
} from "../../src/lib/library";
import type { ClassRow, SubjectRow } from "../../src/lib/database.types";
export function LibraryBrowser(props: {
  books: LibraryBook[];
  initial: LibraryFilters;
  subjects: SubjectRow[];
  classes: ClassRow[];
  truncated: boolean;
  studyIntent?: boolean;
}) {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/library?")) {
        const p = new URL(url, location.origin).searchParams;
        const filtered = filterBooks(
          props.books,
          initialLibraryFilters(Object.fromEntries(p)),
        );
        const offset = Number(p.get("offset") ?? 0);
        return Response.json({
          books: filtered.slice(offset, offset + 24),
          total: filtered.length,
          nextOffset: offset + 24 < filtered.length ? offset + 24 : null,
          suggestions: [],
        });
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, [props.books]);
  const filtered = filterBooks(props.books, props.initial);
  return (
    <Browser
      mutateAction={async () => ({ ok: true })}
      initial={props.initial}
      subjects={props.subjects}
      studyIntent={props.studyIntent}
      page={{
        books: filtered.slice(0, 24),
        total: filtered.length,
        nextOffset: filtered.length > 24 ? 24 : null,
        suggestions: [],
      }}
      personal={{ history: [], recent: [] }}
    />
  );
}
