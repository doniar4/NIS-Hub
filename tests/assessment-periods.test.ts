import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { v05Database } from "./helpers/v05-database";
import { asUser, fixtureId as id } from "./helpers/database";

test("all four quarters coexist, moved dates replace a quarter, stale previews and invalid corrections roll back", async () => {
  const db = await v05Database();
  try {
    for (const name of [
      "202610120001_quarter_assessments.sql",
      "202610120002_assessment_periods.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `insert into auth.users(id) values ('${id(1)}'),('${id(2)}'); update public.profiles set role='admin' where id='${id(1)}';`,
    );
    await db.query(
      "insert into public.classes(id,name) values ($1,'7A'),($2,'7B')",
      [id(10), id(11)],
    );
    const row = (date: string, class_id = id(10)) => ({
      class_id,
      date,
      lesson_start: 3,
      lesson_end: 4,
      subject_id: null,
      subject_label: "Биология",
      duration_minutes: 80,
    });
    const revision = async (q: number, year = 2026) =>
      (
        await db.query<{ revision_id: string }>(
          "select revision_id from public.assessment_periods where academic_year=$1 and quarter=$2",
          [year, q],
        )
      ).rows[0]?.revision_id ?? null;
    const run = (
      q: number,
      rows: ReturnType<typeof row>[],
      expected: string | null = null,
      year = 2026,
    ) =>
      db.query(
        "select public.import_quarter_assessments($1::jsonb,$2::jsonb,'quarter.xlsx',$3,$4,$5)",
        [
          JSON.stringify(rows),
          JSON.stringify(
            rows.map((l) => ({ class_id: l.class_id, date: l.date })),
          ),
          year,
          q,
          expected,
        ],
      );
    await asUser(db, id(2));
    await assert.rejects(run(1, [row("2026-10-14")]), /Admin required/);
    await asUser(db, id(1));
    await run(1, [row("2026-10-14"), row("2026-10-14", id(11))]);
    await run(2, [row("2026-12-16")]);
    await run(3, [row("2027-03-17")]);
    await run(4, [row("2027-05-19")]);
    assert.equal(
      (await db.query("select * from public.assessment_schedule")).rows.length,
      5,
    );
    const first = await revision(1);
    assert.ok(first);
    await run(1, [row("2026-10-15")], first);
    assert.deepEqual(
      (
        await db.query<{ date: string }>(
          "select date::text from public.assessment_schedule where class_id=$1 order by date",
          [id(10)],
        )
      ).rows.map((r) => r.date),
      ["2026-10-15", "2026-12-16", "2027-03-17", "2027-05-19"],
    );
    assert.equal(
      (
        await db.query(
          "select * from public.assessment_schedule where class_id=$1 and date='2026-10-14'",
          [id(11)],
        )
      ).rows.length,
      1,
      "other classes in the quarter are preserved",
    );
    await assert.rejects(
      run(1, [row("2026-10-16")], first),
      /revision changed/,
    );
    const before = (
      await db.query("select * from public.assessment_schedule order by id")
    ).rows;
    const current = await revision(1);
    await assert.rejects(
      run(1, [row("2026-10-16"), row("2026-10-16")], current),
      /exclusion/,
    );
    assert.deepEqual(
      (await db.query("select * from public.assessment_schedule order by id"))
        .rows,
      before,
    );
    assert.equal(await revision(1), current);
    await assert.rejects(
      run(1, [row("2027-10-20")], current),
      /Invalid assessment days/,
    );
    await run(1, [row("2027-10-20")], null, 2027);
    assert.equal(
      (await db.query("select * from public.assessment_periods")).rows.length,
      5,
      "a later school year remains independent",
    );
    await db.query(
      "select public.clear_assessment_schedule(array['2026-10-15'::date])",
    );
    assert.notEqual(
      await revision(1),
      current,
      "date removal invalidates earlier previews",
    );
    await assert.rejects(
      run(1, [row("2026-10-16")], current),
      /revision changed/,
    );
    await assert.rejects(
      db.query(
        "select public.import_assessment_schedule('[]'::jsonb,'[]'::jsonb,'legacy.xlsx')",
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("migration preserves existing assessment imports and assigns their period", async () => {
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
      `insert into auth.users(id) values ('${id(1)}'); update public.profiles set role='admin' where id='${id(1)}';`,
    );
    await db.query("insert into public.classes(id,name) values ($1,'7A')", [
      id(10),
    ]);
    await asUser(db, id(1));
    const payload = [
      {
        class_id: id(10),
        date: "2026-10-14",
        lesson_start: 3,
        lesson_end: 4,
        subject_label: "Math",
      },
    ];
    await db.query(
      "select public.import_assessment_schedule($1::jsonb,$2::jsonb,'first.xlsx')",
      [
        JSON.stringify(payload),
        JSON.stringify([{ class_id: id(10), date: "2026-10-14" }]),
      ],
    );
    await db.exec("reset role");
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610120002_assessment_periods.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const result = (
      await db.query<{
        academic_year: number;
        quarter: number;
        subject_label: string;
      }>(
        "select p.academic_year,p.quarter,a.subject_label from public.assessment_schedule a join public.assessment_periods p on p.id=a.period_id",
      )
    ).rows;
    assert.deepEqual(result, [
      { academic_year: 2026, quarter: 1, subject_label: "Math" },
    ]);
  } finally {
    await db.close();
  }
});
