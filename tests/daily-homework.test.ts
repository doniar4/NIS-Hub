import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { homeworkBySubject } from "../src/lib/daily-homework";
import { InlineLessonHomework } from "../src/components/inline-lesson-homework";
import { LocaleProvider } from "../src/components/locale-provider";
import type { ClassHomework } from "../src/lib/database.types";

const assignment = (patch: Partial<ClassHomework> = {}): ClassHomework => ({
  id: "work-1", class_id: "class-1", subject_id: "subject-1", due_date: "2026-10-05", body: "§12, questions 1–4",
  created_by: "author", created_at: "", updated_at: "", deleted_at: null, moderation_status: "visible", ...patch,
});

test("Daily grouping matches canonical subject/date/class and excludes deleted/moderated work", () => {
  const rows = [assignment(), assignment({ id: "work-2", body: "Second assignment" }),
    assignment({ subject_id: "subject-2" }), assignment({ due_date: "2026-10-06" }),
    assignment({ class_id: "class-2" }), assignment({ deleted_at: "2026-10-04" }),
    assignment({ moderation_status: "hidden" })];
  const grouped = homeworkBySubject(rows, "2026-10-05", "class-1");
  assert.equal(grouped.get("subject-1")?.length, 2);
  assert.equal(grouped.get("subject-2")?.length, 1);
  assert.equal(grouped.has("no-homework-subject"), false);
  assert.equal(homeworkBySubject(rows, "2026-10-06", "class-1").get("subject-1")?.length, 1);
});

test("Inline homework renders nothing when empty and every full body in a localized native expansion", () => {
  assert.equal(renderToStaticMarkup(React.createElement(InlineLessonHomework, { rows: [], subject: "Biology" })), "");
  for (const locale of ["ru", "kk", "en"] as const) {
    const rows = [assignment({ body: "Long assignment ".repeat(60) }), assignment({ id: "work-2", body: "Second assignment" })];
    const html = renderToStaticMarkup(React.createElement(LocaleProvider, { locale } as Parameters<typeof LocaleProvider>[0],
      React.createElement(InlineLessonHomework, { rows, subject: "Biology" })));
    assert.match(html, /<details class="lesson-inline-homework"/);
    assert.match(html, /<summary aria-label="[^\"]*Biology/);
    assert.match(html, /lesson-homework-preview/);
    assert.match(html, /Second assignment/);
    assert.equal((html.match(/<li>/g) ?? []).length, 2);
    assert.ok(html.includes(rows[0].body));
    assert.doesNotMatch(html, /<button|<dialog|Нет ДЗ/);
  }
});

test("Actual homework action shares existing ownership/visibility query, loads a day once and never truncates at 20", async () => {
  let data = Array.from({ length: 25 }, (_, i) => assignment({ id: String(i) }));
  let profileClass: string | null = "class-1", requests = 0, contexts = 0, fail = false;
  const filters: Array<[string, unknown]> = [];
  const supabase = { from(table: string) {
    const conditions: Array<[string, unknown]> = [];
    const q = {
      select() { return q; }, eq(field: string, value: unknown) { conditions.push([field, value]); return q; },
      is(field: string, value: unknown) { conditions.push([field, value]); return q; }, order() { return q; },
      async single() { return { data: { class_id: profileClass }, error: null }; },
      async range(start: number, end: number) {
        assert.equal(table, "class_homework"); requests++; filters.push(...conditions);
        return { data: data.filter(row => conditions.every(([field, value]) => row[field as keyof ClassHomework] === value)).slice(start, end + 1), error: fail ? { code: "fixture" } : null };
      },
    };
    return q;
  } };
  const result = await build({ entryPoints: ["src/app/actions/homework.ts"], write: false, bundle: true,
    platform: "node", format: "cjs", logLevel: "silent", external: ["zod"],
    plugins: [{ name: "server-action-boundary", setup(api) {
      api.onResolve({ filter: /^@\/lib\/(auth|people)$|^next\/cache$/ }, args => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", contents:
        path.endsWith("auth") ? 'export const actionContext=()=>globalThis.context();'
          : path.endsWith("people") ? 'export const communityError=()=>({error:"failed"});' : 'export const revalidatePath=()=>{};' }));
    } }],
  });
  const mod = { exports: {} as typeof import("../src/app/actions/homework") };
  runInNewContext(result.outputFiles[0].text, { module: mod, exports: mod.exports, require,
    context: async () => { contexts++; return { user: { id: "fixture-user" }, supabase }; } });
  const day = await mod.exports.loadDailyHomework("2026-10-05");
  assert.ok("data" in day); assert.equal(day.data.length, 25); assert.equal(requests, 1); assert.equal(contexts, 1);
  assert.ok(filters.some(([key, value]) => key === "class_id" && value === "class-1"));
  assert.ok(filters.some(([key, value]) => key === "due_date" && value === "2026-10-05"));
  assert.ok(filters.some(([key, value]) => key === "moderation_status" && value === "visible"));
  assert.ok(filters.some(([key, value]) => key === "deleted_at" && value === null));
  const page = await mod.exports.loadHomework("2026-10-05");
  assert.ok("data" in page); assert.equal(page.data.length, 20);
  data = Array.from({ length: 1001 }, (_, i) => assignment({ id: String(i) })); requests = 0; contexts = 0;
  const large = await mod.exports.loadDailyHomework("2026-10-05");
  assert.ok("data" in large); assert.equal(large.data.length, 1001); assert.equal(requests, 2); assert.equal(contexts, 1);
  data = Array.from({ length: 10001 }, (_, i) => assignment({ id: String(i) }));
  assert.ok("error" in await mod.exports.loadDailyHomework("2026-10-05"), "explicit error rather than a silently partial day");
  requests = 0; profileClass = null;
  const noClass = await mod.exports.loadDailyHomework("2026-10-05");
  assert.ok("data" in noClass); assert.equal(noClass.data.length, 0); assert.equal(requests, 0);
  await mod.exports.loadDailyHomework("invalid-date"); assert.equal(requests, 0);
  profileClass = "class-1"; fail = true;
  assert.ok("error" in await mod.exports.loadDailyHomework("2026-10-05"));
});
