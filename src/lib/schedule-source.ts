import { z } from "zod";
import type { Lesson } from "./database.types";
import { dateSchema, uuid } from "./validation";
export type ScheduleEntry = Pick<Lesson, "class_id" | "date" | "lesson_number" | "subject_id" | "teacher" | "room">;
export interface ScheduleSource { getDay(classId: string, date: string): Promise<ScheduleEntry[]> }
export const SCHEDULE_IMPORT_BYTES = 256 * 1024;
export const SCHEDULE_IMPORT_LIMIT = 500;
const text = (max: number) => z.string().trim().max(max).nullish().transform(value => value || null);
const entrySchema = z.object({
  class_id: uuid.transform(value => value.toLowerCase()), date: dateSchema,
  lesson_number: z.number().int().min(1).max(20), subject_id: uuid.transform(value => value.toLowerCase()),
  teacher: text(100), room: text(40),
}).strict();
const importSchema = z.object({ version: z.literal(1), lessons: z.array(entrySchema).min(1).max(SCHEDULE_IMPORT_LIMIT) }).strict()
  .superRefine((value, context) => {
    const keys = value.lessons.map(row => `${row.class_id}/${row.date}/${row.lesson_number}`);
    if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Duplicate lesson slot" });
  });
export function parseScheduleImport(raw: string): ScheduleEntry[] {
  if (raw.length > SCHEDULE_IMPORT_BYTES || new TextEncoder().encode(raw).length > SCHEDULE_IMPORT_BYTES) throw new Error("Import too large");
  return importSchema.parse(JSON.parse(raw)).lessons;
}
export class ManualScheduleSource implements ScheduleSource {
  readonly entries: ScheduleEntry[];
  constructor(raw: string) { this.entries = parseScheduleImport(raw); }
  async getDay(classId: string, date: string) {
    const id = uuid.parse(classId).toLowerCase(); dateSchema.parse(date);
    return this.entries.filter(row => row.class_id === id && row.date === date).sort((a, b) => a.lesson_number - b.lesson_number);
  }
}
