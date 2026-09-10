import test from "node:test";
import assert from "node:assert/strict";
import { parseSupabaseConfig } from "../src/lib/env";
import { bookSchema, canReadBook, credentialsSchema, dateSchema, pageSchema, pdfPathSchema, profileSchema, safeNext, schoolDate } from "../src/lib/validation";

const id = "00000000-0000-4000-8000-000000000001";
const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("missing config is safe; partial, privileged and non-origin configs fail closed", () => {
  assert.equal(parseSupabaseConfig(), null);
  assert.throws(() => parseSupabaseConfig("https://example.supabase.co"));
  assert.equal(parseSupabaseConfig("http://127.0.0.1:54321", "sb_publishable_test")?.url, "http://127.0.0.1:54321");
  assert.equal(parseSupabaseConfig("https://example.supabase.co", jwt("anon"))?.key, jwt("anon"));
  for (const key of [jwt("service_role"), jwt("authenticated"), "sb_secret_not_allowed", "junk"]) assert.throws(() => parseSupabaseConfig("https://example.supabase.co", key));
  for (const url of ["http://example.com", "https://a:b@example.com", "https://example.com/path", "https://example.com?secret=x", "javascript:alert(1)"]) assert.throws(() => parseSupabaseConfig(url, "sb_publishable_test"));
});
test("redirects use a closed local allowlist", () => {
  assert.equal(safeNext("/library"), "/library");
  assert.equal(safeNext(`/books/${id}/read`), `/books/${id}/read`);
  for (const input of ["//evil.com", "https://evil.com", "/\\evil.com", "/%2f%2fevil.com", "/admin?next=https://evil.com", ["/admin"], null]) assert.equal(safeNext(input), "/profile");
});
test("profile requires a nonblank name and at most four distinct subjects", () => {
  const profile = { display_name: "  Student  ", class_id: "", subjects: [id] };
  assert.equal(profileSchema.parse(profile).display_name, "Student");
  assert.equal(profileSchema.parse(profile).class_id, null);
  for (const subjects of [[id, id], Array(5).fill(id), ["wrong-id"]]) assert.equal(profileSchema.safeParse({ ...profile, subjects }).success, false);
  assert.equal(profileSchema.safeParse({ ...profile, display_name: " " }).success, false);
});
test("book paths, publication and page bounds reject invalid input", () => {
  assert.equal(pdfPathSchema.safeParse("books/own_notes-1.pdf").success, true);
  for (const path of ["../a.pdf", "/a.pdf", "https://example.com/a.pdf", "a.pdf?x=1", "a.exe", "a/../b.pdf"]) assert.equal(pdfPathSchema.safeParse(path).success, false);
  for (const page of [0, -1, 1.5, 100001, "NaN"]) assert.equal(pageSchema.safeParse(page).success, false);
  assert.equal(pageSchema.parse("12"), 12);
  assert.equal(canReadBook({ publication_status: "published", license_status: "pending_review" }), false);
  const book = { id: "", title: "Own test document", subject_id: id, class_id: "", author: "", publisher: "", publication_year: "", language: "", file_path: "own.pdf", page_count: "2", publication_status: "published", license_status: "approved", source: "Self-authored", permission_note: "Owner grants test usage" };
  assert.equal(bookSchema.safeParse(book).success, true);
  assert.equal(bookSchema.safeParse({ ...book, license_status: "restricted" }).success, false);
  assert.equal(bookSchema.safeParse({ ...book, permission_note: " " }).success, false);
});
test("calendar dates and school timezone are explicit", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(dateSchema.safeParse("2028-02-29").success, true);
  assert.equal(schoolDate(new Date("2026-09-10T20:00:00Z")), "2026-09-11");
  assert.equal(credentialsSchema.safeParse({ email: "bad", password: "short" }).success, false);
});
