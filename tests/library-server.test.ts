import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { asUser, fixtureId } from "./helpers/database";
import {
  libraryQueryVariants,
  normalizeSearch,
  naturalTitleCompare,
} from "../src/lib/library-normalize";
import { parseHighlights, highlightSchema } from "../src/lib/pdf-highlights";
import type { LibraryPage } from "../src/lib/library";

test("search normalization supports Kazakh, accents, keyboard layout, transliteration and natural order", () => {
  assert.equal(
    normalizeSearch("  ҚАЗАҚСТАН · Әлемі ёлка Café  "),
    "казакстан алеми елка cafe",
  );
  assert.ok(libraryQueryVariants("abpbrf").includes("физика"));
  assert.ok(libraryQueryVariants("fizika").includes("физика"));
  assert.ok(libraryQueryVariants("qazaqstan").includes("казакстан"));
  assert.ok(libraryQueryVariants("физика").includes("fizika"));
  assert.deepEqual(["Book 10", "Book 2"].sort(naturalTitleCompare), [
    "Book 2",
    "Book 10",
  ]);
});
test("highlight validation rejects malformed and out-of-page data", () => {
  const valid = {
    id: fixtureId(1),
    page: 1,
    color: "yellow",
    x: 3,
    y: 4,
    w: 20,
    h: 3,
  };
  assert.equal(highlightSchema.safeParse(valid).success, true);
  assert.deepEqual(
    parseHighlights([
      valid,
      { ...valid, w: 120 },
      { ...valid, color: "red" },
      { ...valid, page: 0 },
      null,
    ]),
    [valid],
  );
});
test("real SQL catalog pages, ranked search, metadata, private collections and activity", async () => {
  const db = new PGlite({ extensions: { pg_trgm } }),
    owner = fixtureId(1),
    other = fixtureId(2),
    subject = fixtureId(3);
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated;
   create table public.subjects(id uuid primary key,name text,name_ru text,name_kz text,name_en text);
   create table public.books(id uuid primary key,title text,description text,tags text[],quarter integer,grade integer,subject_id uuid references subjects(id),author text,publisher text,publication_status text);
   create table public.book_variants(id uuid primary key,book_id uuid references books(id),language text,publication_status text);
   grant select on public.books,public.book_variants,public.subjects to authenticated;
  `);
    await db.query("insert into auth.users values($1),($2)", [owner, other]);
    await db.query(
      "insert into subjects values($1,'Science','Наука','Ғылым','Science')",
      [subject],
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261004140000_library_personal_catalog.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (let i = 0; i < 65; i++) {
      const title =
        i === 60
          ? "Физика"
          : i === 61
            ? "Қазақстан тарихы"
            : i === 62
              ? "Biology essentials"
              : i === 63
                ? "Ёлка"
                : i === 64
                  ? "Café"
                  : "Book " + (i + 1);
      await db.query(
        "insert into books values($1,$2,'Description',array['textbook'],2,9,$3,'Иван Петров','Publisher','published')",
        [fixtureId(100 + i), title, subject],
      );
      await db.query(
        "insert into book_variants values($1,$2,'ru','published')",
        [fixtureId(200 + i), fixtureId(100 + i)],
      );
    }
    await db.query(
      "insert into book_variants values($1,$2,'kz','published'),($3,$2,'en','draft')",
      [fixtureId(400), fixtureId(100), fixtureId(401)],
    );
    await asUser(db, owner);
    const page = async (
      q = "",
      offset = 0,
    ) =>
      (
        await db.query<{ value: LibraryPage }>(
          "select public.library_page($1::text[],null,null,$2) value",
          [libraryQueryVariants(q), offset],
        )
      ).rows[0].value;
    const first = await page();
    assert.equal(first.books.length, 24);
    assert.equal(first.total, 65);
    assert.equal(first.nextOffset, 24);
    assert.deepEqual(
      first.books.slice(0, 3).map((b) => b.title),
      ["Biology essentials", "Book 1", "Book 2"],
    );
    const all = [
      ...first.books,
      ...(await page("", 24)).books,
      ...(await page("", 48)).books,
    ];
    assert.equal(new Set(all.map((b) => b.id)).size, 65);
    const book = all.find((b) => b.id === fixtureId(100))!;
    assert.equal(book.author, "Иван Петров");
    assert.deepEqual(book.languages, ["kz", "ru"]);
    for (const q of ["Физика", "физка", "abpbrf", "fizika"])
      assert.equal((await page(q)).books[0]?.title, "Физика", q);
    assert.equal((await page("qazaqstan")).books[0]?.title, "Қазақстан тарихы");
    assert.equal((await page("елка")).books[0]?.title, "Ёлка");
    assert.equal((await page("cafe")).books[0]?.title, "Café");
    assert.equal((await page("Петров")).total, 65);
    assert.equal((await page("zzzxxyyqqq")).total, 0);
    assert.deepEqual((await page("zzzxxyyqqq")).suggestions, []);
    await db.query(
      "insert into library_search_history(user_id,query) values($1,'private search')",
      [owner],
    );
    await db.query(
      "insert into library_recent_books(user_id,book_id) values($1,$2)",
      [owner, fixtureId(100)],
    );
    await asUser(db, other);
    for (const table of [
      "library_search_history",
      "library_recent_books",
    ])
      assert.equal(
        (await db.query(`select * from ${table}`)).rows.length,
        0,
        table,
      );
    await assert.rejects(
      db.query("insert into library_recent_books(user_id,book_id) values($1,$2)", [
        owner,
        fixtureId(101),
      ]),
      /row-level security/,
    );
    await asUser(db, null);
    await assert.rejects(page(), /permission denied/);
  } finally {
    await db.close();
  }
});
