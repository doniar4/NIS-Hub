import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";

type BookRow = { id: string; title: string; subject_id: string; grade: number };
type TableCall = { table: string; select?: string; filters: Array<[string, unknown]>; limit?: number };

async function subjectMaterials(books: BookRow[], editions: Array<{ id: string; book_id: string }>) {
  const calls: TableCall[] = [];
  function table(name: string) {
    const call: TableCall = { table: name, filters: [] };
    calls.push(call);
    const query = {
      select(columns: string) { call.select = columns; return query; },
      eq(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      in(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      order() { return query; },
      limit(value: number) { call.limit = value; return query; },
      then(resolve: (value: unknown) => void) {
        const data = name === "books" ? books : name === "book_variants" ? editions : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  }
  const fixtures: Record<string, string> = {
    "server-only": "export {};",
    "./queries": "export async function database(){return globalThis.fixtureDb}",
    "./auth": 'export async function requireViewer(){return {user:{id:"fixture-user"}}}',
  };
  const built = await build({
    entryPoints: [resolve("src/lib/schedule-material-queries.ts")], write: false,
    bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "isolated-materials", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => Object.prototype.hasOwnProperty.call(fixtures, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtures[args.path], loader: "js" }));
    } }],
  });
  const mod = { exports: {} as { getTimetableMaterials: (subjects: string[], grades: (number | null)[]) => Promise<Record<string, string>> } };
  runInNewContext(built.outputFiles[0].text, {
    module: mod, exports: mod.exports, fixtureDb: { from: table }, URLSearchParams,
  });
  return { calls, result: await mod.exports.getTimetableMaterials(["fixture-subject"], [9]) };
}

test("timetable material lookup uses a bounded subject/grade query, not the full Library loader", async () => {
  const book = { id: "book-one", title: "Physics", subject_id: "fixture-subject", grade: 9 };
  const { calls, result } = await subjectMaterials([book], [{ id: "edition-one", book_id: book.id }]);
  assert.deepEqual(calls.map(call => call.table).sort(), ["book_variants", "books", "variant_reading_progress"]);
  const books = calls.find(call => call.table === "books")!;
  assert.equal(JSON.stringify(books.filters), JSON.stringify([["publication_status", "published"], ["subject_id", ["fixture-subject"]], ["grade", [9]]]));
  assert.equal(books.select, "id,title,subject_id,grade");
  assert.equal(books.limit, 1000);
  assert.equal(result["9:fixture-subject"], "/books/book-one/read?variant=edition-one");
});

test("missing editions and a capped result safely fall back to filtered Library", async () => {
  const single = { id: "book-one", title: "Physics", subject_id: "fixture-subject", grade: 9 };
  const missing = await subjectMaterials([single], []);
  assert.equal(missing.result["9:fixture-subject"], "/library?subject=fixture-subject&grade=9");
  const capped = await subjectMaterials(Array.from({ length: 1000 }, (_, index) => ({ ...single, id: `book-${index}` })),
    [{ id: "edition-one", book_id: single.id }]);
  assert.equal(capped.result["9:fixture-subject"], "/library?subject=fixture-subject&grade=9");
});
