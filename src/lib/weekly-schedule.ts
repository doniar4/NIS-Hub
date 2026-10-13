import type { WeeklyLesson } from "./database.types";
import { schoolDate } from "./validation";
export function schoolWeek(date = schoolDate()) {
  const today = new Date(date + "T12:00:00Z");
  const weekday = today.getUTCDay();
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (weekday || 7) + 1);
  const dates = Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  return { weekday, dates };
}
export function weeklyDay<
  T extends Pick<
    WeeklyLesson,
    "class_id" | "weekday" | "lesson_start" | "effective_from" | "effective_to"
  > &
    Partial<
      Pick<
        WeeklyLesson,
        "id" | "lesson_end" | "assessment_date" | "start_time" | "end_time"
      >
    >,
>(lessons: T[], classId: string, weekday: number, date: string) {
  const day = lessons
    .filter(
      (row) =>
        row.class_id === classId &&
        row.weekday === weekday &&
        (!row.assessment_date || row.assessment_date === date) &&
        (!row.effective_from || row.effective_from <= date) &&
        (!row.effective_to || row.effective_to >= date),
    )
    .sort((a, b) => a.lesson_start - b.lesson_start);
  const assessments = day.filter((row) => row.assessment_date);
  // Replace only reserved assessment slots. Split a normal double lesson if
  // just one of its slots is occupied, preserving the other slot and subgroup.
  return day
    .flatMap((row) => {
      if (row.assessment_date || !assessments.length) return [row];
      const end = row.lesson_end ?? row.lesson_start,
        free: number[] = [];
      for (let slot = row.lesson_start; slot <= end; slot++)
        if (
          !assessments.some(
            (exam) =>
              exam.lesson_start <= slot &&
              (exam.lesson_end ?? exam.lesson_start) >= slot,
          )
        )
          free.push(slot);
      if (free.length === end - row.lesson_start + 1) return [row];
      const pieces: T[] = [];
      for (const slot of free) {
        const last = pieces.at(-1);
        if (last && last.lesson_end === slot - 1) last.lesson_end = slot;
        else
          pieces.push({
            ...row,
            ...(row.id ? { id: row.id + "-slot-" + slot } : {}),
            lesson_start: slot,
            lesson_end: slot,
            start_time: null,
            end_time: null,
          });
      }
      return pieces;
    })
    .sort((a, b) => a.lesson_start - b.lesson_start);
}
export const lessonRange = (
  row: Pick<WeeklyLesson, "lesson_start" | "lesson_end">,
) =>
  row.lesson_start === row.lesson_end
    ? String(row.lesson_start)
    : row.lesson_start + "–" + row.lesson_end;
