import { z } from "zod";

import { activityDate } from "./activity-date";
export const activityDaySchema = z.object({
  day: z.iso.date(),
  views: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ActivityDay = { date: string; count: number };
export type ProfileActivity = { days: ActivityDay[]; today: string };

export function parseProfileActivity(
  raw: unknown,
  today = activityDate(),
): ProfileActivity {
  const rows = z.array(activityDaySchema).max(371).parse(raw);
  return {
    today,
    days: rows.map((row) => ({ date: row.day, count: row.views })),
  };
}
