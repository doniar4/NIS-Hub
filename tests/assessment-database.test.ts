import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { v05Database } from "./helpers/v05-database";
import { asUser, fixtureId as id } from "./helpers/database";
test("assessment imports are admin-only, atomic, scoped and reversible without changing the weekly timetable", async () => {
  const db = await v05Database();
  try {
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610120001_quarter_assessments.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users(id) values ('${id(1)}'),('${id(2)}'); update public.profiles set role='admin' where id='${id(1)}';`,
    );
    await db.query(
      "insert into public.classes(id,name) values ($1,'7A'),($2,'8A')",
      [id(10), id(11)],
    );
    await db.query("insert into public.subjects(id,name) values ($1,'Math')", [
      id(20),
    ]);
    const lesson = {
      class_id: id(10),
      date: "2026-10-14",
      lesson_start: 3,
      lesson_end: 4,
      subject_id: id(20),
      subject_label: "Math",
      duration_minutes: 80,
    };
    const days = [{ class_id: id(10), date: "2026-10-14" }];
    const run = (rows: unknown, scope: unknown = days) =>
      db.query(
        "select public.import_assessment_schedule($1::jsonb,$2::jsonb,'quarter.xlsx')",
        [JSON.stringify(rows), JSON.stringify(scope)],
      );
    await asUser(db, id(2));
    await assert.rejects(run([lesson]), /Admin required/);
    await assert.rejects(
      db.query(
        "insert into public.assessment_schedule(class_id,date,lesson_start,lesson_end,subject_label,source_file) values ($1,'2026-10-14',1,2,'Math','x.xlsx')",
        [id(10)],
      ),
    );
    await asUser(db, id(1));
    await db.query("select public.import_weekly_schedule($1::jsonb)", [
      JSON.stringify([
        {
          class_id: id(10),
          subject_id: id(20),
          weekday: 3,
          lesson_start: 3,
          lesson_end: 4,
        },
      ]),
    ]);
    const weekly = (await db.query("select * from public.weekly_schedule"))
      .rows;
    await run([lesson, { ...lesson, lesson_start: 5, lesson_end: 6 }]);
    await run(
      [{ ...lesson, class_id: id(11), date: "2026-10-15" }],
      [{ class_id: id(11), date: "2026-10-15" }],
    );
    const before = (
      await db.query("select * from public.assessment_schedule order by id")
    ).rows;
    await assert.rejects(
      run([lesson, { ...lesson, lesson_start: 4, lesson_end: 5 }]),
      /exclusion/,
    );
    assert.deepEqual(
      (await db.query("select * from public.assessment_schedule order by id"))
        .rows,
      before,
    );
    await assert.rejects(
      run([{ ...lesson, class_id: id(11) }]),
      /Invalid assessment days/,
    );
    await assert.rejects(run([{ ...lesson, duration_minutes: 0 }]));
    await run([
      { ...lesson, subject_id: null, subject_label: "Предмет по выбору" },
    ]);
    assert.equal(
      (await db.query("select * from public.assessment_schedule")).rows.length,
      2,
      "corrected file removes the now-empty second block, preserving unrelated classes/dates",
    );
    assert.deepEqual(
      (await db.query("select * from public.weekly_schedule")).rows,
      weekly,
    );
    await asUser(db, id(2));
    assert.equal(
      (await db.query("select * from public.assessment_schedule")).rows.length,
      2,
    );
    await assert.rejects(
      db.query(
        "select public.clear_assessment_schedule(array['2026-10-14'::date])",
      ),
      /Admin required/,
    );
    await asUser(db, id(1));
    await db.query(
      "select public.clear_assessment_schedule(array['2026-10-14'::date])",
    );
    assert.equal(
      (await db.query("select * from public.assessment_schedule")).rows.length,
      1,
    );
    assert.deepEqual(
      (await db.query("select * from public.weekly_schedule")).rows,
      weekly,
    );
    await asUser(db, null);
    await assert.rejects(db.query("select * from public.assessment_schedule"));
  } finally {
    await db.close();
  }
});
