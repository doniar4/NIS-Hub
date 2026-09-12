import test from "node:test";
import assert from "node:assert/strict";
import { filterBooks, initialLibraryFilters, libraryFilterUrl, loadLibraryCatalog, type LibraryBook } from "../src/lib/library";
const books: LibraryBook[] = Array.from({ length: 525 }, (_, i) => ({
  id: String(i).padStart(6, "0"), title: i % 2 ? "Алгебра " + i : "Physics " + i,
  class_id: i % 3 ? "class-a" : "class-b", subject_id: i % 2 ? "math" : "physics", language: "original",
}));
test("initial catalog loads beyond 100 in bounded pages; cap is explicit and failures propagate", async () => {
  const calls: number[] = [];
  const fetchPage = async (after: string | null, size: number) => { calls.push(size); return books.filter(book => after === null || book.id > after).slice(0, size); };
  assert.deepEqual(await loadLibraryCatalog(fetchPage), { books, truncated: false });
  assert.deepEqual(calls, [200, 200, 200]);
  assert.deepEqual(await loadLibraryCatalog(fetchPage, 200), { books: books.slice(0, 200), truncated: true });
  assert.equal((await loadLibraryCatalog(fetchPage, 525)).truncated, false);
  await assert.rejects(loadLibraryCatalog(async after => { if (after) throw new Error("Database failed"); return books.slice(0, 200); }), /Database failed/);
  await assert.rejects(loadLibraryCatalog(async () => [books[1], books[0]]), /pagination/);
});
test("filters are case-insensitive with exact IDs; reset restores every loaded book", () => {
  const result = filterBooks(books, { q: " АЛГЕБРА ", classId: "class-a", subject: "math" });
  assert.ok(result.length > 100); assert.ok(result.every(book => book.title.startsWith("Алгебра") && book.class_id === "class-a"));
  assert.equal(filterBooks(books, { q: "", classId: "class", subject: "" }).length, 0);
  assert.equal(filterBooks(books, { q: "", classId: "", subject: "" }).length, 525);
  assert.equal(filterBooks(books, { q: "%", classId: "", subject: "" }).length, 0);
});
test("query state restores; explicit reset overrides profile class and preserves unrelated URL data", () => {
  assert.deepEqual(initialLibraryFilters({}, "class-a"), { q: "", classId: "class-a", subject: "" });
  const state = { q: "Алгебра & test", classId: "", subject: "math" };
  const url = libraryFilterUrl("https://local.test/library?utm=test#books", state);
  assert.ok(url.includes("utm=test")); assert.ok(url.endsWith("#books"));
  assert.deepEqual(initialLibraryFilters(Object.fromEntries(new URL(url, "https://local.test").searchParams), "class-a"), state);
});
