import ExcelJS from "exceljs";
import type { ClassRow, SubjectRow } from "./database.types";
import { classGrade } from "./book-model";
import { dateSchema } from "./validation";

import {
  ASSESSMENT_BYTES,
  ASSESSMENT_LIMIT,
  type AssessmentInput,
  type AssessmentIssue,
  type AssessmentPreview,
  type AssessmentPeriod,
} from "./assessment-contract";
const norm = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const months = [
  ["январ", "қаңтар", "january", "jan"],
  ["феврал", "ақпан", "february", "feb"],
  ["март", "наурыз", "march", "mar"],
  ["апрел", "сәуір", "april", "apr"],
  ["мая", "май", "мамыр", "may"],
  ["июн", "маусым", "june", "jun"],
  ["июл", "шілде", "july", "jul"],
  ["август", "тамыз", "august", "aug"],
  ["сентябр", "қыркүйек", "september", "sep"],
  ["октябр", "қазан", "october", "oct"],
  ["ноябр", "қараша", "november", "nov"],
  ["декабр", "желтоқсан", "december", "dec"],
];
export function assessmentDate(
  value: string | Date,
  year: number | null,
  academic = false,
) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    const date = value.toISOString().slice(0, 10);
    return dateSchema.safeParse(date).success ? date : null;
  }
  const text = norm(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  if (iso) return dateSchema.safeParse(iso[1]).success ? iso[1] : null;
  const numeric = text.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?:\s|$)/);
  const named = text.match(/^(\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4}))?/u);
  if (!numeric && !named) return null;
  const day = Number((numeric ?? named)![1]);
  const month = numeric
    ? Number(numeric[2])
    : months.findIndex((names) =>
        names.some((name) => named![2].startsWith(name)),
      ) + 1;
  const explicitYear = (numeric ?? named)![3];
  const actualYear = explicitYear
    ? Number(explicitYear)
    : year === null
      ? null
      : year + (academic && month < 9 ? 1 : 0);
  if (!actualYear || month < 1 || month > 12) return null;
  const date = `${actualYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dateSchema.safeParse(date).success ? date : null;
}
function subjectKey(value: string) {
  return norm(value)
    .replace(/я\s*[12]\s*(?:\/\s*я\s*[12])?/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function subjectId(label: string, subjects: SubjectRow[]) {
  // A choice with several subjects remains a choice, never a guessed catalog ID.
  const choice = label.match(/предмет\s+по\s+выбору\s*\(([^)]+)\)/i);
  if (choice && /[,/]/.test(choice[1])) return null;
  const key = subjectKey(
    choice ? choice[1] : label.replace(/^предмет\s+по\s+выбору\s*/i, ""),
  );
  const aliases: Record<string, string[]> = {
    [subjectKey("Русский язык и литература")]: [
      "Русский язык",
      "Русская литература",
    ],
    [subjectKey("Казахский язык и литература")]: [
      "Казахский язык",
      "Казахская литература",
    ],
  };
  const match = (keys: string[]) =>
    subjects.filter((s) =>
      [s.name, s.name_ru, s.name_kz, s.name_en, s.short_name].some(
        (n) => n && keys.includes(subjectKey(n)),
      ),
    );
  const exact = match([key]);
  if (exact.length) return exact.length === 1 ? exact[0].id : null;
  const matches = match((aliases[key] ?? []).map(subjectKey));
  return matches.length === 1 ? matches[0].id : null;
}
function classKey(value: string) {
  return norm(value)
    .replace(/[\s"'«»]/g, "")
    .replace(
      /[авсенкмортху]/g,
      (c) =>
        ({
          а: "a",
          в: "b",
          с: "c",
          е: "e",
          н: "h",
          к: "k",
          м: "m",
          о: "o",
          р: "p",
          т: "t",
          х: "x",
          у: "y",
        })[c] ?? c,
    );
}

export async function parseAssessmentWorkbook(
  buffer: ArrayBuffer,
  classes: ClassRow[],
  subjects: SubjectRow[],
  yearOverride?: number,
  periodOverride: Partial<AssessmentPeriod> = {},
): Promise<AssessmentPreview> {
  const result: AssessmentPreview = {
    lessons: [],
    days: [],
    issues: [],
    period: null,
  };
  const fail = (sheet: string, row: number, code: AssessmentIssue["code"]) =>
    result.issues.push({ sheet, row, code });
  if (buffer.byteLength > ASSESSMENT_BYTES) {
    fail("", 0, "limit");
    return result;
  }
  if (
    yearOverride !== undefined &&
    (!Number.isInteger(yearOverride) ||
      yearOverride < 2000 ||
      yearOverride > 2100)
  ) {
    fail("", 0, "date");
    return result;
  }
  const book = new ExcelJS.Workbook();
  if (
    (periodOverride.academic_year !== undefined &&
      (!Number.isInteger(periodOverride.academic_year) ||
        periodOverride.academic_year < 2000 ||
        periodOverride.academic_year > 2100)) ||
    (periodOverride.quarter !== undefined &&
      (!Number.isInteger(periodOverride.quarter) ||
        periodOverride.quarter < 1 ||
        periodOverride.quarter > 4))
  ) {
    fail("", 0, "period");
    return result;
  }
  try {
    await book.xlsx.load(buffer);
  } catch {
    fail("", 0, "format");
    return result;
  }
  if (book.worksheets.length > 20) {
    fail("", 0, "limit");
    return result;
  }
  const dayKeys = new Set<string>();
  let totalRows = 0,
    foundHeader = false;
  for (const sheet of book.worksheets) {
    if (sheet.state !== "visible") continue;
    totalRows += sheet.rowCount;
    if (totalRows > 1000 || sheet.columnCount > 100) {
      fail(sheet.name, 0, "limit");
      return result;
    }
    const title = Array.from(
      { length: Math.min(sheet.rowCount, 10) },
      (_, i) => sheet.getRow(i + 1).values,
    )
      .flat()
      .map(String)
      .join(" ");
    const years = title.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2})\b/);
    const single = title.match(/\b(20\d{2})\b/);
    const quarterMatch = (sheet.name + " " + title).match(
      /([1-4])\s*(?:[-–]?\s*(?:я|ая|st|nd|rd|th))?\s*(?:четверт|тоқсан|quarter)|quarter\s*([1-4])/i,
    );
    const academicYear =
      periodOverride.academic_year ??
      (years ? Number(years[1]) : single ? Number(single[1]) : null);
    const quarter =
      periodOverride.quarter ??
      (quarterMatch ? Number(quarterMatch[1] ?? quarterMatch[2]) : null);
    if (
      years &&
      periodOverride.academic_year !== undefined &&
      Number(years[1]) !== periodOverride.academic_year
    ) {
      fail(sheet.name, 0, "period");
      return result;
    }
    const year = yearOverride ?? academicYear;
    const academic =
      yearOverride === undefined &&
      (!!years || periodOverride.academic_year !== undefined);
    const firstDayIndex = result.days.length;
    let columns: { column: number; date: string | null }[] = [],
      classColumn = 0,
      timeColumn = 0,
      targets: ClassRow[] = [];
    for (let number = 1; number <= sheet.rowCount; number++) {
      const row = sheet.getRow(number),
        values = Array.from({ length: sheet.columnCount }, (_, i) =>
          norm(row.getCell(i + 1).text),
        );
      const classIndex = values.findIndex((v) =>
        ["класс", "сынып", "class", "grade"].includes(v),
      );
      const timeIndex = values.findIndex((v) =>
        ["время", "уақыт", "time", "уроки", "сабақтар", "lessons"].includes(v),
      );
      if (classIndex >= 0 && timeIndex >= 0) {
        foundHeader = true;
        classColumn = classIndex + 1;
        timeColumn = timeIndex + 1;
        targets = [];
        columns = values.flatMap((v, i) =>
          i !== classIndex && i !== timeIndex && v
            ? [
                {
                  column: i + 1,
                  date: assessmentDate(
                    row.getCell(i + 1).value instanceof Date
                      ? (row.getCell(i + 1).value as Date)
                      : row.getCell(i + 1).text,
                    year,
                    academic,
                  ),
                },
              ]
            : [],
        );
        if (!columns.length) fail(sheet.name, number, "format");
        if (
          columns.some(
            (c) =>
              !c.date ||
              ![1, 2, 3, 4, 5].includes(
                new Date(c.date + "T12:00:00Z").getUTCDay(),
              ),
          )
        )
          fail(sheet.name, number, "date");
        continue;
      }
      if (!classColumn || !values.some(Boolean)) continue;
      const classValue = row.getCell(classColumn).text.trim();
      if (classValue) {
        if (/^\d{1,2}$/.test(classValue))
          targets = classes.filter((c) => classGrade(c) === Number(classValue));
        else
          targets = classes.filter(
            (c) => classKey(c.name) === classKey(classValue),
          );
      }
      const hasSubjects = columns.some((c) =>
        row.getCell(c.column).text.trim(),
      );
      const time = row.getCell(timeColumn).text.trim();
      // Ignore footer notes, but reject any populated timetable row we cannot map.
      if (!hasSubjects && !time) continue;
      if (!targets.length) {
        fail(sheet.name, number, "class");
        continue;
      }
      const slot = norm(time).match(
        /^(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?(?:\s*(?:урок[аиов]*|сабақ(?:тар)?|lessons?))?$/,
      );
      if (
        !slot ||
        Number(slot[1]) < 1 ||
        Number(slot[2] ?? slot[1]) < Number(slot[1]) ||
        Number(slot[2] ?? slot[1]) > 20
      ) {
        fail(sheet.name, number, "values");
        continue;
      }
      for (const { column, date } of columns) {
        if (!date) continue;
        for (const target of targets) {
          const key = target.id + "/" + date;
          if (!dayKeys.has(key)) {
            dayKeys.add(key);
            result.days.push({ class_id: target.id, date });
          }
        }
        const text = row.getCell(column).text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        const duration = text.match(
          /\(\s*(\d+)\s*(?:мин(?:ут)?\.?|min(?:utes)?\.?|минут)\s*\)/i,
        );
        const label = text
          .replace(
            /\(\s*\d+\s*(?:мин(?:ут)?\.?|min(?:utes)?\.?|минут)\s*\)/gi,
            "",
          )
          .trim();
        const minutes = duration ? Number(duration[1]) : null;
        if (
          !label ||
          label.length > 300 ||
          (minutes !== null && (minutes < 1 || minutes > 240))
        ) {
          fail(sheet.name, number, "values");
          continue;
        }
        for (const target of targets) {
          const lesson: AssessmentInput = {
            class_id: target.id,
            date,
            lesson_start: Number(slot[1]),
            lesson_end: Number(slot[2] ?? slot[1]),
            subject_id: subjectId(label, subjects),
            subject_label: label,
            duration_minutes: minutes,
          };
          if (
            result.lessons.some(
              (l) =>
                l.class_id === lesson.class_id &&
                l.date === date &&
                l.lesson_start <= lesson.lesson_end &&
                lesson.lesson_start <= l.lesson_end,
            )
          )
            fail(sheet.name, number, "conflict");
          result.lessons.push(lesson);
        }
        if (
          result.lessons.length > ASSESSMENT_LIMIT ||
          result.days.length > ASSESSMENT_LIMIT
        ) {
          fail(sheet.name, number, "limit");
          return result;
        }
      }
    }
    const firstDate = result.days[firstDayIndex]?.date;
    const resolvedYear =
      years || periodOverride.academic_year !== undefined
        ? academicYear
        : firstDate
          ? Number(firstDate.slice(0, 4)) -
            (Number(firstDate.slice(5, 7)) < 9 ? 1 : 0)
          : academicYear;
    if (resolvedYear && quarter) {
      if (
        result.period &&
        (result.period.academic_year !== resolvedYear ||
          result.period.quarter !== quarter)
      ) {
        fail(sheet.name, 0, "period");
        return result;
      }
      result.period = { academic_year: resolvedYear, quarter };
    }
  }
  if (!foundHeader || !result.lessons.length) fail("", 0, "format");
  if (!result.period) fail("", 0, "period");
  else if (
    result.days.some(
      (day) =>
        day.date < `${result.period!.academic_year}-09-01` ||
        day.date > `${result.period!.academic_year + 1}-08-31`,
    )
  )
    fail("", 0, "period");
  return result;
}
