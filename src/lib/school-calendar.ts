import type { NonSchoolDay } from "./database.types";
import type { Locale } from "./i18n";
import { v05Copy } from "./v05-copy";
export type CalendarDay = Pick<NonSchoolDay,"start_date"|"end_date"|"type"|"label">;
export function shiftDate(date: string, days: number): string {
  const value = new Date(date+"T12:00:00Z");
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
export function dayReasons(date: string, days: CalendarDay[], locale: Locale): string[] {
  const t = v05Copy(locale), weekday = new Date(date+"T12:00:00Z").getUTCDay();
  return [...new Set([...(weekday===0 || weekday===6 ? [t.weekend] : []),
    ...days.filter(row=>row.start_date<=date && row.end_date>=date).map(row=>t.dayTypes[row.type]+": "+row.label)])];
}
export function isSchoolDay(date: string, days: CalendarDay[]) {
  return dayReasons(date,days,"en").length===0;
}
export type SkippedInterval = { start: string; end: string; reasons: string[] };
export function schoolDayJump(date: string, direction: -1|1, days: CalendarDay[], locale: Locale) {
  const skipped: SkippedInterval[] = [];
  let candidate = shiftDate(date,direction);
  for (let count=0; count<366; count++,candidate=shiftDate(candidate,direction)) {
    const reasons = dayReasons(candidate,days,locale);
    if (!reasons.length) return {date:candidate,skipped};
    const previous = skipped.at(-1);
    if (previous && previous.reasons.join("\n")===reasons.join("\n")) {
      previous.start = candidate < previous.start ? candidate : previous.start;
      previous.end = candidate > previous.end ? candidate : previous.end;
    } else skipped.push({start:candidate,end:candidate,reasons});
  }
  return {date:null,skipped};
}
export function formatSchoolDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale==="kk"?"kk-KZ":locale==="ru"?"ru-RU":"en-GB",
    {day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
}
