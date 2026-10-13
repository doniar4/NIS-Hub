import type { AssessmentLesson, WeeklyLesson } from "./database.types";
import { schoolWeek } from "./weekly-schedule";
export function assessmentOverlays(
  exams: AssessmentLesson[],
  weekly: WeeklyLesson[],
): WeeklyLesson[] {
  return exams.map((exam) => {
    const weekday = schoolWeek(exam.date).weekday;
    const base = weekly.filter(
      (l) =>
        l.class_id === exam.class_id &&
        l.weekday === weekday &&
        (!l.effective_from || l.effective_from <= exam.date) &&
        (!l.effective_to || l.effective_to >= exam.date),
    );
    const start =
      base.find((l) => l.lesson_start === exam.lesson_start)?.start_time ??
      null;
    const end =
      base.find((l) => l.lesson_end === exam.lesson_end)?.end_time ?? null;
    return {
      id: exam.id,
      class_id: exam.class_id,
      weekday,
      lesson_start: exam.lesson_start,
      lesson_end: exam.lesson_end,
      start_time: start,
      end_time: start && end && end > start ? end : null,
      subject_id: exam.subject_id ?? "",
      teacher: null,
      room: null,
      effective_from: exam.date,
      effective_to: exam.date,
      created_at: exam.created_at,
      updated_at: exam.created_at,
      assessment_date: exam.date,
      assessment_label: exam.subject_label,
      assessment_minutes: exam.duration_minutes,
    };
  });
}
