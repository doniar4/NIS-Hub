import type { ClassRow, SubjectRow } from "./database.types";
export const subjectMap = (subjects: SubjectRow[]) => new Map(subjects.map(subject => [subject.id, subject]));
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function sortClasses<T extends Pick<ClassRow, "name" | "grade" | "section">>(classes: T[]): T[] {
  const grade = (row: T) => row.grade ?? Number(row.name.match(/^\s*(\d+)/)?.[1] ?? Infinity);
  const section = (row: T) => row.section?.trim() || row.name.replace(/^\s*\d+\s*/, "");
  return [...classes].sort((a, b) => grade(a) - grade(b) || collator.compare(section(a), section(b)) || collator.compare(a.name, b.name));
}
/** Strip only familiar classroom prefixes/suffixes. Named locations stay intact. */
export function normalizeRoom(value: string | null | undefined): string {
  const room = value?.normalize("NFKC").trim().replace(/\s+/g, " ") ?? "";
  return room.replace(/^(?:каб\.?|кабинет|room)\s*(?=\d)/iu, "")
    .replace(/(?<=\d)\s*(?:каб\.?|кабинет|room)$/iu, "").trim();
}
