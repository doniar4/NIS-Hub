import type { Book } from "./database.types";
export type LibraryBook = Pick<Book, "id" | "title" | "class_id" | "subject_id" | "language">;
export type LibraryFilters = { q: string; classId: string; subject: string };
export const LIBRARY_PAGE_SIZE = 200;
export const LIBRARY_BOOK_LIMIT = 5000;
export function initialLibraryFilters(params: Record<string, string | string[] | undefined>, defaultClass = ""): LibraryFilters {
  return { q: typeof params.q === "string" ? params.q.slice(0, 100) : "",
    classId: typeof params.classId === "string" ? params.classId.slice(0, 128) : defaultClass,
    subject: typeof params.subject === "string" ? params.subject.slice(0, 128) : "" };
}
export function filterBooks(books: LibraryBook[], { q, classId, subject }: LibraryFilters): LibraryBook[] {
  const search = q.trim().toLocaleLowerCase();
  return books.filter(book => (!search || book.title.toLocaleLowerCase().includes(search))
    && (!classId || book.class_id === classId) && (!subject || book.subject_id === subject));
}
export function libraryFilterUrl(currentUrl: string, filters: LibraryFilters): string {
  const url = new URL(currentUrl);
  for (const key of ["q", "subject"] as const) {
    if (filters[key]) url.searchParams.set(key, filters[key]); else url.searchParams.delete(key);
  }
  // Empty explicitly means all classes, even after reload with a profile default.
  url.searchParams.set("classId", filters.classId);
  return url.pathname + url.search + url.hash;
}
// Server initialization only; callback returns unique ascending IDs.
export async function loadLibraryCatalog(fetchPage: (after: string | null, size: number) => Promise<LibraryBook[]>,
  ceiling = LIBRARY_BOOK_LIMIT): Promise<{ books: LibraryBook[]; truncated: boolean }> {
  if (!Number.isInteger(ceiling) || ceiling < 1 || ceiling > LIBRARY_BOOK_LIMIT) throw new Error("Invalid catalog ceiling");
  const books: LibraryBook[] = [];
  let after: string | null = null;
  while (books.length <= ceiling) {
    const size = Math.min(LIBRARY_PAGE_SIZE, ceiling + 1 - books.length);
    const rows = await fetchPage(after, size);
    if (rows.length > size || rows.some((row, index) => !row.id || (index ? row.id <= rows[index - 1].id : after !== null && row.id <= after))) throw new Error("Invalid catalog pagination");
    books.push(...rows);
    if (books.length > ceiling) return { books: books.slice(0, ceiling), truncated: true };
    if (rows.length < size) return { books, truncated: false };
    after = rows[rows.length - 1].id;
  }
  return { books, truncated: false };
}
