import type { AssessmentLesson } from "./database.types";
export const ASSESSMENT_BYTES = 2 * 1024 * 1024;
export const ASSESSMENT_LIMIT = 10000;
export type AssessmentInput = Pick<
  AssessmentLesson,
  | "class_id"
  | "date"
  | "lesson_start"
  | "lesson_end"
  | "subject_id"
  | "subject_label"
  | "duration_minutes"
>;
export type AssessmentDay = { class_id: string; date: string };
export type AssessmentIssue = {
  sheet: string;
  row: number;
  code:
    "format" | "limit" | "date" | "class" | "values" | "conflict" | "period";
};
export type AssessmentPeriod = { academic_year: number; quarter: number };
export type AssessmentPreview = {
  period: AssessmentPeriod | null;
  lessons: AssessmentInput[];
  days: AssessmentDay[];
  issues: AssessmentIssue[];
};
