import "server-only";
import { requireViewer } from "./auth";
import { database } from "./queries";
import type { WeeklyLesson } from "./database.types";
import { getI18n } from "./i18n-server";
import { phase4Copy } from "./phase4-copy";
import { schoolWeek, weeklyDay } from "./weekly-schedule";
import type { WeeklyScheduleSource } from "./schedule-source";

export async function getWeeklySchedule(classId?: string) {
  await requireViewer("/schedule");
  const db = await database(); const { locale } = await getI18n();
  const rows: WeeklyLesson[] = [];
  for (let page = 0; page <= 20; page++) {
    let query = db.from("weekly_schedule").select("*").order("id").limit(500);
    if (rows.length) query = query.gt("id", rows[rows.length-1].id);
    if (classId) query = query.eq("class_id",classId);
    const { data, error } = await query;
    if (error) throw new Error(phase4Copy(locale).importError);
    if (page === 20 && data.length) throw new Error(phase4Copy(locale).scheduleLimit);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
  return rows;
}
export const weeklyDatabaseSchedule: WeeklyScheduleSource = {
  async getDay(classId, date) {
    const weekday = schoolWeek(date).weekday;
    if (weekday < 1 || weekday > 5) return [];
    return weeklyDay(await getWeeklySchedule(classId), classId, weekday, date);
  },
};
