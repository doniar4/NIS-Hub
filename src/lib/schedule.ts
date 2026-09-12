import "server-only";
import { database } from "@/lib/queries";
import { requireViewer } from "@/lib/auth";
import { dateSchema, uuid } from "@/lib/validation";
import type { ScheduleSource } from "@/lib/schedule-source";

export const databaseSchedule: ScheduleSource = {
  async getDay(classId, date) {
    await requireViewer("/schedule");
    uuid.parse(classId); dateSchema.parse(date);
    const supabase = await database();
    const { data, error } = await supabase.from("schedule").select("*").eq("class_id", classId).eq("date", date).order("lesson_number");
    if (error) throw new Error("Не удалось загрузить расписание.");
    return data;
  },
};
