import type { WeeklyLesson } from "./database.types";

/** Stable defaults; selecting another lesson never depends on displayed labels. */
export function defaultLesson(rows: WeeklyLesson[], date: string, today: string, time: string) {
  if (date !== today) return rows[0];
  return rows.find(row => row.start_time && row.end_time && row.start_time.slice(0, 5) <= time && time < row.end_time.slice(0, 5))
    ?? rows.find(row => row.start_time && row.start_time.slice(0, 5) >= time)
    ?? rows[0];
}

/** Carry grounded-study intent through the existing catalog/edition flow. */
export function studyHref(material: string) {
  const url = new URL(material, "https://nis.invalid");
  if (/^\/books\/[^/]+(?:\/read)?$/.test(url.pathname)) {
    if (!url.pathname.endsWith("/read")) url.pathname += "/read";
    url.hash = "ai-study";
  } else {
    url.searchParams.set("study", "1");
  }
  return url.pathname + url.search + url.hash;
}
