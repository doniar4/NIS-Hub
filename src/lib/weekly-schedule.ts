import type { WeeklyLesson } from "./database.types";
import { schoolDate } from "./validation";
export function schoolWeek(date = schoolDate()) {
  const today = new Date(date + "T12:00:00Z");
  const weekday = today.getUTCDay();
  const monday = new Date(today); monday.setUTCDate(today.getUTCDate() - (weekday || 7) + 1);
  const dates = Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday); day.setUTCDate(monday.getUTCDate() + index); return day.toISOString().slice(0, 10);
  });
  return { weekday, dates };
}
export function weeklyDay<T extends Pick<WeeklyLesson, "class_id" | "weekday" | "lesson_start" | "effective_from" | "effective_to">>(lessons: T[], classId: string, weekday: number, date: string) {
  return lessons.filter(row => row.class_id === classId && row.weekday === weekday &&
    (!row.effective_from || row.effective_from <= date) && (!row.effective_to || row.effective_to >= date))
    .sort((a, b) => a.lesson_start - b.lesson_start);
}
export const lessonRange = (row: Pick<WeeklyLesson, "lesson_start" | "lesson_end">) =>
  row.lesson_start === row.lesson_end ? String(row.lesson_start) : row.lesson_start + "–" + row.lesson_end;
