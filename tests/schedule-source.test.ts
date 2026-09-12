import test from "node:test";
import assert from "node:assert/strict";
import { ManualScheduleSource, parseScheduleImport, SCHEDULE_IMPORT_BYTES } from "../src/lib/schedule-source";
const row = { class_id: "00000000-0000-4000-8000-000000000010", subject_id: "00000000-0000-4000-8000-000000000020", date: "2026-09-14", lesson_number: 1 };
test("manual adapter normalizes optional fields and provides the dated schedule boundary", async () => {
  const source = new ManualScheduleSource(JSON.stringify({ version: 1, lessons: [{ ...row, lesson_number: 2, teacher: "  Teacher  " }, row] }));
  const result = await source.getDay(row.class_id, row.date);
  assert.deepEqual(result.map(item => item.lesson_number), [1, 2]);
  assert.equal(result[0].teacher, null); assert.equal(result[1].teacher, "Teacher");
  assert.equal((await source.getDay(row.class_id, "2026-09-15")).length, 0);
});
test("manual importer rejects malformed, unknown, oversized, duplicate and invalid data", () => {
  for (const input of [
    {}, { version: 2, lessons: [row] }, { version: 1, lessons: [] }, { version: 1, lessons: [row], credentials: "forbidden" },
    { version: 1, lessons: [row, row] }, { version: 1, lessons: Array(501).fill(row) },
    ...[{ date: "2026-02-30" }, { lesson_number: 1.5 }, { lesson_number: 0 }, { lesson_number: 21 }, { lesson_number: "1" },
      { class_id: "name" }, { student: "private" }, { room: "a".repeat(41) }, { teacher: "a".repeat(101) }].map(change => ({ version: 1, lessons: [{ ...row, ...change }] })),
  ]) assert.throws(() => parseScheduleImport(JSON.stringify(input)));
  assert.throws(() => parseScheduleImport("{broken"));
  assert.throws(() => parseScheduleImport(" ".repeat(SCHEDULE_IMPORT_BYTES + 1)));
});
