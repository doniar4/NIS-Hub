import type { ClassRow, SubjectRow, WeeklyLesson } from "./database.types";
import { normalizeRoom } from "./catalog";
import { dateSchema } from "./validation";
export const TIMETABLE_BYTES = 512 * 1024;
export const TIMETABLE_ROWS = 1000;
export const TIMETABLE_HEADERS = ["class","weekday","lesson_start","lesson_end","start_time","end_time","subject","teacher","room"] as const;
export type WeeklyInput = Omit<WeeklyLesson, "id" | "created_at" | "updated_at">;
export type ImportIssue = { row: number; code: "format" | "limit" | "class" | "subject" | "weekday" | "values" | "conflict" };
export type ImportPreview = { lessons: WeeklyInput[]; issues: ImportIssue[] };
const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase();
const weekdays = [
  ["1","mon","monday","пн","понедельник","дс","дүйсенбі"],
  ["2","tue","tues","tuesday","вт","вторник","сс","сейсенбі"],
  ["3","wed","wednesday","ср","среда","сәр","сәрсенбі"],
  ["4","thu","thur","thurs","thursday","чт","четверг","бс","бейсенбі"],
  ["5","fri","friday","пт","пятница","жм","жұма"],
];
export function parseWeekday(value: string) { return weekdays.findIndex(names => names.includes(normalize(value).replace(/\.$/, ""))) + 1; }
// Strict RFC-style quoting (including embedded separators/newlines and escaped quotes).
// The first header line determines comma vs tab; headers themselves cannot be quoted.
export function delimitedRows(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = text.slice(0, text.indexOf("\n") < 0 ? text.length : text.indexOf("\n")).includes("\t") ? "\t" : ",";
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const pushRow = () => { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += char;
    } else if (char === delimiter) { row.push(field.trim()); field = ""; closed = false; }
    else if (char === "\n") pushRow();
    else if (char === '"' && !field && !closed) quoted = true;
    else if (char === '"' || closed) throw new Error("Invalid quoting");
    else field += char;
  }
  if (quoted) throw new Error("Unclosed quote");
  if (field || row.length || closed) pushRow();
  return rows;
}
function resolveName(value: string, options: { id: string; names: (string | null)[] }[]) {
  const name = normalize(value);
  const matches = options.filter(option => option.names.some(candidate => candidate && normalize(candidate) === name));
  return matches.length === 1 ? matches[0].id : null;
}
const dateOverlap = (a: WeeklyInput, b: WeeklyInput) =>
  (a.effective_from || "0001-01-01") <= (b.effective_to || "9999-12-31") &&
  (b.effective_from || "0001-01-01") <= (a.effective_to || "9999-12-31");
export function parseTimetable(raw: string, classes: ClassRow[], subjects: SubjectRow[], existing: WeeklyLesson[] = []): ImportPreview {
  const result: ImportPreview = { lessons: [], issues: [] };
  if (new TextEncoder().encode(raw).length > TIMETABLE_BYTES) return { ...result, issues: [{ row: 0, code: "limit" }] };
  let rows: string[][];
  try { rows = delimitedRows(raw); } catch { return { ...result, issues: [{ row: 0, code: "format" }] }; }
  const headers = rows.shift()?.map(normalize) ?? [];
  if (!TIMETABLE_HEADERS.every(header => headers.includes(header)) ||
    headers.some(header => ![...TIMETABLE_HEADERS, "effective_from", "effective_to"].includes(header as typeof TIMETABLE_HEADERS[number])) ||
    new Set(headers).size !== headers.length) return { ...result, issues: [{ row: 1, code: "format" }] };
  if (!rows.length || rows.length > TIMETABLE_ROWS) return { ...result, issues: [{ row: 0, code: "limit" }] };
  const classOptions = classes.map(row => ({ id: row.id, names: [row.name] }));
  const subjectOptions = subjects.map(row => ({ id: row.id, names: [row.name, row.name_kz, row.name_en, row.short_name] }));
  const valid: { entry: WeeklyInput; row: number }[] = [];
  rows.forEach((fields, index) => {
    const number = index + 2; const fail = (code: ImportIssue["code"]) => result.issues.push({ row: number, code });
    if (fields.length !== headers.length) { fail("format"); return; }
    const r = Object.fromEntries(headers.map((header, i) => [header, fields[i]]));
    const class_id = resolveName(r.class, classOptions), subject_id = resolveName(r.subject, subjectOptions), weekday = parseWeekday(r.weekday);
    if (!class_id) fail("class"); if (!subject_id) fail("subject"); if (!weekday) fail("weekday");
    const lesson_start = Number(r.lesson_start), lesson_end = Number(r.lesson_end || r.lesson_start);
    const timesValid = (!r.start_time && !r.end_time) ||
      (/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start_time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.end_time) && r.end_time > r.start_time);
    const datesValid = (!r.effective_from || dateSchema.safeParse(r.effective_from).success) &&
      (!r.effective_to || dateSchema.safeParse(r.effective_to).success) &&
      (!r.effective_from || !r.effective_to || r.effective_from <= r.effective_to);
    if (!/^\d+$/.test(r.lesson_start) || (r.lesson_end && !/^\d+$/.test(r.lesson_end)) ||
      !Number.isInteger(lesson_start) || !Number.isInteger(lesson_end) || lesson_start < 1 || lesson_end < lesson_start || lesson_end > 20 ||
      !timesValid || !datesValid || r.teacher.length > 100 || r.room.length > 40) { fail("values"); return; }
    if (!class_id || !subject_id || !weekday) return;
    valid.push({ row: number, entry: { class_id, subject_id, weekday, lesson_start, lesson_end, start_time: r.start_time || null,
      end_time: r.end_time || null, teacher: r.teacher || null, room: normalizeRoom(r.room) || null,
      effective_from: r.effective_from || null, effective_to: r.effective_to || null } });
  });
  for (let i = 0; i < valid.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = valid[i].entry, b = valid[j].entry;
      if (a.class_id === b.class_id && a.weekday === b.weekday &&
        ((a.lesson_start === b.lesson_start && a.effective_from === b.effective_from) ||
        (dateOverlap(a,b) && ((a.lesson_start <= b.lesson_end && b.lesson_start <= a.lesson_end) ||
          (a.start_time && a.end_time && b.start_time && b.end_time && a.start_time < b.end_time && b.start_time < a.end_time))))) {
        for (const item of [valid[i],valid[j]]) if (!result.issues.some(issue => issue.row === item.row && issue.code === "conflict")) result.issues.push({ row: item.row, code: "conflict" });
      }
    }
  }
  const key = (r: WeeklyInput) => r.class_id+"/"+r.weekday+"/"+r.lesson_start+"/"+(r.effective_from || "");
  const replaced = new Set(valid.map(item=>key(item.entry)));
  for (const item of valid) {
    const a = item.entry;
    for (const b of existing) {
      if (replaced.has(key(b)) || a.class_id !== b.class_id || a.weekday !== b.weekday || !dateOverlap(a,b)) continue;
      if ((a.lesson_start <= b.lesson_end && b.lesson_start <= a.lesson_end) ||
        (a.start_time && a.end_time && b.start_time && b.end_time && a.start_time < b.end_time.slice(0,5) && b.start_time.slice(0,5) < a.end_time)) {
        if (!result.issues.some(i=>i.row===item.row && i.code==="conflict")) result.issues.push({row:item.row,code:"conflict"});
      }
    }
  }
  result.lessons = valid.map(item => item.entry);
  return result;
}
