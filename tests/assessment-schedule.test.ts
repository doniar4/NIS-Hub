import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessmentDate,
  parseAssessmentWorkbook,
} from "../src/lib/assessment-import";
import { assessmentOverlays } from "../src/lib/assessment-schedule";
import { weeklyDay } from "../src/lib/weekly-schedule";
import type {
  ClassRow,
  SubjectRow,
  WeeklyLesson,
  AssessmentLesson,
} from "../src/lib/database.types";
import { fixtureId as id } from "./helpers/database";
const classes: ClassRow[] = Array.from({ length: 6 }, (_, i) =>
  ["A", "B"].map((section, j) => ({
    id: id(100 + i * 2 + j),
    name: `${7 + i}${section}`,
    grade: 7 + i,
    section,
    created_at: "",
  })),
).flat();
const subjects: SubjectRow[] = [
  "Математика",
  "Биология",
  "Химия",
  "Физика",
  "Английский язык",
  "Информатика",
  "География",
  "История Казахстана",
  "Всемирная история",
  "Основы права",
  "Программирование",
  "Казахский язык и литература",
  "Русский язык и литература",
].map((name, i) => ({
  id: id(200 + i),
  name,
  name_kz: null,
  name_en: null,
  short_name: null,
  created_at: "",
}));
const file = () => {
  const b = readFileSync(
    new URL("../public/templates/quarter-assessments.xlsx", import.meta.url),
  );
  return b.buffer.slice(
    b.byteOffset,
    b.byteOffset + b.byteLength,
  ) as ArrayBuffer;
};
test("the synthetic quarter workbook expands merged grades and repeated headers to every class", async () => {
  const preview = await parseAssessmentWorkbook(file(), classes, subjects);
  assert.deepEqual(preview.issues, []);
  assert.deepEqual(preview.period, { academic_year: 2054, quarter: 1 });
  assert.equal(preview.lessons.length, 46); // 23 invented cells × two sections.
  assert.equal(preview.days.length, 24);
  assert.deepEqual(
    [...new Set(preview.lessons.map((l) => l.date))],
    [
      "2054-10-14",
      "2054-10-15",
    ],
  );
  for (const grade of [7, 8, 9, 10, 11, 12]) {
    const a = preview.lessons.filter(
      (l) => l.class_id === classes.find((c) => c.name === grade + "A")!.id,
    );
    const b = preview.lessons.filter(
      (l) => l.class_id === classes.find((c) => c.name === grade + "B")!.id,
    );
    assert.deepEqual(
      a.map((row) => ({ ...row, class_id: "" })),
      b.map((row) => ({ ...row, class_id: "" })),
    );
  }
  const kazakh = preview.lessons.find(
    (l) =>
      l.class_id === classes[0].id &&
      l.date === "2054-10-14" &&
      l.lesson_start === 3,
  )!;
  assert.equal(kazakh.duration_minutes, 80);
  assert.equal(kazakh.lesson_end, 4);
  assert.equal(
    kazakh.subject_id,
    subjects.find((s) => s.name === "Казахский язык и литература")!.id,
  );
  assert.equal(kazakh.subject_label, "Казахский язык и литература Я1/Я2");
  const optional = preview.lessons.find((l) =>
    l.subject_label.includes("Пән A, Пән B"),
  )!;
  assert.equal(optional.subject_id, null);
  assert.equal(optional.duration_minutes, 80);
  assert.equal(
    preview.lessons.find(
      (l) => l.subject_label === "Предмет по выбору (Биология)",
    )!.subject_id,
    subjects[1].id,
  );
});
test("quarter selection supports later quarters, validates the school year and rejects invalid periods", async () => {
  for (const quarter of [2, 3, 4]) {
    const preview = await parseAssessmentWorkbook(
      file(),
      classes,
      subjects,
      undefined,
      { academic_year: 2054, quarter },
    );
    assert.deepEqual(preview.issues, []);
    assert.deepEqual(preview.period, { academic_year: 2054, quarter });
  }
  assert.ok(
    (
      await parseAssessmentWorkbook(file(), classes, subjects, undefined, {
        academic_year: 2055,
        quarter: 1,
      })
    ).issues.some((i) => i.code === "period"),
  );
  assert.equal(
    (
      await parseAssessmentWorkbook(file(), classes, subjects, undefined, {
        quarter: 5,
      })
    ).issues[0].code,
    "period",
  );
});
test("assessment dates preserve explicit years and follow the academic year across January", () => {
  assert.equal(assessmentDate("14 октября (среда)", 2026, true), "2026-10-14");
  assert.equal(assessmentDate("15 января", 2026, true), "2027-01-15");
  assert.equal(assessmentDate("14 қазан", 2026), "2026-10-14");
  assert.equal(assessmentDate("14 October", 2026), "2026-10-14");
  assert.equal(assessmentDate("14.10.2026", null), "2026-10-14");
  assert.equal(assessmentDate("2026-10-14", null), "2026-10-14");
  assert.equal(
    assessmentDate(new Date("2026-10-14T00:00:00Z"), null),
    "2026-10-14",
  );
  assert.equal(assessmentDate("14 октября", null), null);
  assert.equal(assessmentDate("30 февраля 2026", null), null);
  assert.equal(assessmentDate("29 февраля 2028", null), "2028-02-29");
  assert.equal(assessmentDate(new Date(NaN), null), null);
});
test("invalid files, missing grades, overlaps and invalid years block import", async () => {
  assert.equal(
    (await parseAssessmentWorkbook(new ArrayBuffer(10), classes, subjects))
      .issues[0].code,
    "format",
  );
  assert.equal(
    (
      await parseAssessmentWorkbook(
        new ArrayBuffer(2 * 1024 * 1024 + 1),
        classes,
        subjects,
      )
    ).issues[0].code,
    "limit",
  );
  assert.equal(
    (await parseAssessmentWorkbook(file(), classes, subjects, NaN)).issues[0]
      .code,
    "date",
  );
  assert.ok(
    (
      await parseAssessmentWorkbook(
        file(),
        classes.filter((c) => c.grade !== 12),
        subjects,
      )
    ).issues.some((i) => i.code === "class"),
  );
  assert.ok(
    (
      await parseAssessmentWorkbook(file(), [...classes, classes[0]], subjects)
    ).issues.some((i) => i.code === "conflict"),
  );
});
function weekly(slot: number, end = slot): WeeklyLesson {
  return {
    id: id(300 + slot),
    class_id: classes[0].id,
    weekday: 3,
    lesson_start: slot,
    lesson_end: end,
    start_time: `${8 + slot}:00`,
    end_time: `${8 + end}:40`,
    subject_id: subjects[0].id,
    teacher: "Teacher",
    room: "305",
    effective_from: null,
    effective_to: null,
    created_at: "",
    updated_at: "",
  };
}
const exam: AssessmentLesson = {
  id: id(400),
  class_id: classes[0].id,
  date: "2026-10-14",
  lesson_start: 3,
  lesson_end: 4,
  subject_id: subjects[1].id,
  subject_label: "Биология",
  duration_minutes: 80,
  source_file: "test.xlsx",
  created_by: null,
  created_at: "",
};
test("dated assessment overlays replace both subgroup slots and preserve normal lessons outside the date", () => {
  const baseline = [
    weekly(1),
    weekly(2),
    weekly(3),
    { ...weekly(3), id: id(399), subgroup_key: "language" },
    weekly(4),
    weekly(5),
    weekly(6),
  ];
  const all = [...baseline, ...assessmentOverlays([exam], baseline)];
  assert.deepEqual(
    weeklyDay(all, classes[0].id, 3, exam.date).map((l) => [
      l.lesson_start,
      l.lesson_end,
      l.assessment_label,
    ]),
    [
      [1, 1, undefined],
      [2, 2, undefined],
      [3, 4, "Биология"],
      [5, 5, undefined],
      [6, 6, undefined],
    ],
  );
  assert.deepEqual(weeklyDay(all, classes[0].id, 3, "2026-10-07"), baseline);
  assert.deepEqual(weeklyDay(all, classes[0].id, 3, "2026-10-21"), baseline);
  assert.equal(weeklyDay(all, classes[1].id, 3, exam.date).length, 0);
  const overlay = all.at(-1)!;
  assert.equal(overlay.start_time, "11:00");
  assert.equal(overlay.end_time, "12:40");
  assert.equal(overlay.room, null);
});
test("an assessment in the middle of a normal multi-slot lesson preserves the remaining slots with distinct identities", () => {
  const baseline = [weekly(1, 6)];
  const all = [...baseline, ...assessmentOverlays([exam], baseline)];
  const day = weeklyDay(all, classes[0].id, 3, exam.date);
  assert.deepEqual(
    day.map((l) => [l.lesson_start, l.lesson_end]),
    [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
  );
  assert.equal(new Set(day.map((l) => l.id)).size, 3);
  assert.equal(day[0].start_time, null);
  assert.equal(day[2].end_time, null);
  assert.deepEqual(baseline, [weekly(1, 6)]);
});
