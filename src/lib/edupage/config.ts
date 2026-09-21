import "server-only";
import { EduPageError } from "./errors";
export const EDUPAGE_ORIGIN = "https://nisuralsk.edupage.org";
export const EDUPAGE_PATH = "/timetable/";
export type EduPageConfig = { origin: string; path: string; timeoutMs: number; maxBytes: number };
function bounded(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > max) throw new EduPageError("disabled");
  return parsed;
}
export function eduPageConfig(env: Readonly<Record<string, string | undefined>> = process.env): EduPageConfig {
  if (env.EDUPAGE_TIMETABLE_ENABLED !== "true" ||
      (env.EDUPAGE_BASE_URL || EDUPAGE_ORIGIN).replace(/\/$/, "") !== EDUPAGE_ORIGIN ||
      (env.EDUPAGE_TIMETABLE_PATH || EDUPAGE_PATH) !== EDUPAGE_PATH) throw new EduPageError("disabled");
  return { origin: EDUPAGE_ORIGIN, path: EDUPAGE_PATH,
    timeoutMs: bounded(env.EDUPAGE_REQUEST_TIMEOUT_MS, 15000, 30000),
    maxBytes: bounded(env.EDUPAGE_MAX_RESPONSE_BYTES, 3000000, 6000000) };
}
export function eduPageEnabled() { try { eduPageConfig(); return true; } catch { return false; } }
