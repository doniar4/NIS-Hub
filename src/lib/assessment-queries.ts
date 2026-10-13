import "server-only";
import { requireViewer } from "./auth";
import { database } from "./queries";
import type { AssessmentLesson, AssessmentPeriodRow } from "./database.types";

export async function getAssessmentPeriods() {
  await requireViewer("/schedule");
  const db = await database();
  const { data, error } = await db
    .from("assessment_periods")
    .select("*")
    .order("academic_year", { ascending: false })
    .order("quarter")
    .limit(500);
  if (error && (error.code === "42P01" || error.code === "PGRST205"))
    return { rows: [] as AssessmentPeriodRow[], available: false };
  if (error) throw new Error("Assessment periods unavailable");
  return { rows: data, available: true };
}

export async function getAssessmentSchedule(classId?: string) {
  await requireViewer("/schedule");
  const db = await database(),
    rows: AssessmentLesson[] = [];
  for (let page = 0; page <= 20; page++) {
    let query = db
      .from("assessment_schedule")
      .select("*")
      .order("id")
      .limit(500);
    if (classId) query = query.eq("class_id", classId);
    if (rows.length) query = query.gt("id", rows[rows.length - 1].id);
    const { data, error } = await query;
    // Keep the existing timetable usable before the deployment's migration.
    if (error && (error.code === "42P01" || error.code === "PGRST205"))
      return { rows: [], available: false };
    if (error || (page === 20 && data?.length))
      throw new Error("Assessment timetable unavailable");
    rows.push(...data);
    if (data.length < 500) return { rows, available: true };
  }
  return { rows, available: true };
}
