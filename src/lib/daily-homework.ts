import type { ClassHomework } from "./database.types";

// Defense in depth for rendering; authorization remains in the server action/RLS.
export function homeworkBySubject(rows: ClassHomework[], date: string, classId?: string) {
  const grouped = new Map<string, ClassHomework[]>();
  for (const row of rows) {
    if (row.due_date !== date || row.deleted_at !== null || row.moderation_status !== "visible"
      || (classId !== undefined && row.class_id !== classId)) continue;
    const list = grouped.get(row.subject_id) ?? [];
    list.push(row);
    grouped.set(row.subject_id, list);
  }
  return grouped;
}
