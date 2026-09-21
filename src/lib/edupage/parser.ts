import { classAudience, type SourceGroup } from "./groups";
import { normalizeRoom } from "../catalog";
import { parseWeekday } from "../timetable-import";
import { EduPageError } from "./errors";
import { jsonResult, object } from "./discover";
import type { EduPagePublication, EduPageSnapshot, SourceLesson, SourceReference } from "./types";
type Row = Record<string, unknown>;
const fail = (): never => { throw new EduPageError("source_changed"); };
function text(value: unknown, max = 200, empty = false) {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value)) return fail();
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!empty && !normalized) return fail();
  return normalized;
}
function id(value: unknown) {
  const result = text(value, 100);
  if (!/^[a-zA-Z0-9_*:.+-]+$/.test(result)) return fail();
  return result;
}
function ids(value: unknown, max = 200): string[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  const result = value.map(id);
  if (new Set(result).size !== result.length) return fail();
  return result;
}
function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return fail();
  return value;
}
function periodNumber(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return fail();
  return integer(Number(value), 1, 20);
}
function time(value: unknown) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return fail();
  return value;
}
function references(rows: Row[]): SourceReference[] {
  return rows.map(row => ({ id: id(row.id), name: text(row.name ?? row.short, 200), short: text(row.short ?? row.name, 200) }));
}
export function parseEduPage(raw: string, publication: EduPagePublication): EduPageSnapshot {
  const result = jsonResult(raw), access = object(result.dbiAccessorRes);
  if (access.type !== "ttuidocdbi" || !Array.isArray(access.tables) || access.tables.length > 64) return fail();
  const tables = new Map<string, Row[]>();
  for (const entry of access.tables) {
    const table = object(entry), key = id(table.id);
    if (tables.has(key) || !Array.isArray(table.data_rows) || table.data_rows.length > 10000) return fail();
    const rows = table.data_rows.map(object), keys = rows.map(row => id(row.id));
    if (new Set(keys).size !== keys.length) return fail();
    tables.set(key, rows);
  }
  const table = (key: string, max: number) => {
    const rows = tables.get(key);
    if (!rows || rows.length > max) return fail();
    return rows;
  };
  const days = table("days", 5), weeks = table("weeks", 10), terms = table("terms", 10);
  if (days.length !== 5 || days.some((row, i) => row.id !== String(i) || parseWeekday(text(row.name)) !== i + 1) ||
      weeks.length !== 1 || weeks[0].id !== "0" || terms.length !== 1 || terms[0].id !== "0") throw new EduPageError("unsupported");
  const classRows = table("classes", 200), subjectRows = table("subjects", 1000);
  const classes = references(classRows), subjects = references(subjectRows);
  const classById = new Map(classRows.map(row => [id(row.id), row]));
  const subjectById = new Map(subjects.map(row => [row.id, row]));
  const rooms = new Map(table("classrooms", 500).map(row => [id(row.id), text(row.name ?? row.short, 200)]));
  const teachers = new Map(table("teachers", 1000).map(row => [id(row.id), text(row.short, 200, true)]));
  const groups = new Map(table("groups", 3000).map(row => [id(row.id), row]));
  const groupDefinitions: SourceGroup[] = [...groups.values()].map(row => {
    if (typeof row.entireclass !== "boolean") return fail();
    return { id: id(row.id), classId: id(row.classid), name: text(row.name,100),
      division: text(row.ascttdivision,100,true), entire: row.entireclass };
  });
  const bells = new Map(table("bells", 200).map(row => [id(row.id), object(row.perioddata)]));
  const periods = new Map(table("periods", 20).map(row => {
    const key = periodNumber(row.period);
    if (row.id !== String(key)) return fail();
    return [key, row] as const;
  }));
  function periodTime(number: number, classRow: Row) {
    const row = periods.get(number); if (!row) return fail();
    const bell = text(classRow.bell, 100, true);
    const overrides = bell && bell !== "0" ? bells.get(bell) : undefined;
    if (bell && bell !== "0" && !overrides) return fail();
    const override = overrides?.[String(number)] === undefined ? {} : object(overrides[String(number)]);
    // The verified source has no weekday-specific time overrides. Never silently
    // flatten a future override until its date/day semantics are verified.
    if (Object.keys(object(row.daydata)).length || override.daydata && Object.keys(object(override.daydata)).length)
      throw new EduPageError("unsupported");
    const start = time(override.starttime || row.starttime), end = time(override.endtime || row.endtime);
    if (start >= end) return fail();
    return { start, end };
  }
  const lessonRows = table("lessons", 5000), cards = table("cards", 10000);
  const definitions = new Map(lessonRows.map(row => [id(row.id), row]));
  const lessons: SourceLesson[] = []; let nonClassCards = 0;
  const seen = new Set<string>();
  for (const card of cards) {
    const definition = definitions.get(id(card.lessonid)); if (!definition) return fail();
    const sourceClasses = ids(definition.classids);
    if (!sourceClasses.length) { nonClassCards++; continue; }
    const subject = subjectById.get(id(definition.subjectid)); if (!subject) return fail();
    if (card.weeks !== "1" || definition.terms !== "1") throw new EduPageError("unsupported");
    const mask = text(card.days, 5);
    if (!/^[01]{5}$/.test(mask) || !mask.includes("1")) return fail();
    const start = periodNumber(card.period), duration = integer(definition.durationperiods, 1, 20), end = start + duration - 1;
    if (end > 20) return fail();
    const roomNames = ids(Array.isArray(card.classroomids) ? card.classroomids.filter(value => value !== "") : card.classroomids).map(key => { const name = rooms.get(key); if (name === undefined) return fail(); return normalizeRoom(name); });
    const teacherNames = ids(definition.teacherids).map(key => { const name = teachers.get(key); if (name === undefined) return fail(); return name; }).filter(Boolean);
    const sourceGroups = ids(definition.groupids).map(key => { const group = groups.get(key); if (!group) return fail(); return group; });
    if (definition.bell) throw new EduPageError("unsupported");
    for (const classId of sourceClasses) {
      const classRow = classById.get(classId); if (!classRow) return fail();
      const ownGroups = sourceGroups.filter(group => group.classid === classId);
      if (!ownGroups.length || ownGroups.some(group => typeof group.entireclass !== "boolean")) return fail();
      const ownNames = ownGroups.filter(group => !group.entireclass).map(group => text(group.name, 100));
      for (let day = 0; day < 5; day++) if (mask[day] === "1") {
        const key = [card.id, classId, day].join("/");
        if (seen.has(key)) return fail(); seen.add(key);
        for (let period = start; period <= end; period++) periodTime(period, classRow);
        const first = periodTime(start, classRow), last = periodTime(end, classRow);
        if (first.start >= last.end) return fail();
        lessons.push({ sourceClass: classId, sourceSubject: subject.id, weekday: day + 1,
          lesson_start: start, lesson_end: end, start_time: first.start, end_time: last.end,
          rooms: [...new Set(roomNames)].sort(), teachers: [...new Set(teacherNames)].sort(),
          groups: ownNames, entireClass: ownGroups.some(group => group.entireclass === true),
          ...classAudience(groupDefinitions.filter(g => g.classId === classId), ownGroups.map(g => id(g.id))) });
        if (lessons.length > 10000) throw new EduPageError("unsupported");
      }
    }
  }
  if (!classes.length || !lessons.length) return fail();
  return { publication, classes, subjects, lessons,
    counts: { classes: classes.length, subjectDefinitions: subjects.length, lessonDefinitions: lessonRows.length,
      cards: cards.length, classLessons: lessons.length, nonClassCards } };
}
