import "server-only";
import { SmsHttp } from "./http";
import { SmsError } from "./errors";
import { serverState } from "./html";

/**
 * Live adapter boundary. Authentication was observed, but the owner reported the
 * school's grades screen unavailable on 2026-09-20. The observed EducationRoute
 * screen is NOT a grade source. Do not invent grade URLs, selectors or query IDs.
 *
 * parser.ts is tested infrastructure, not an activated mapping for the live
 * ExtJS portal. Replace the explicit unsupported state only after an authorized
 * authenticated grade fixture and year/term request contract are verified.
 */
export async function fetchDiary(http: SmsHttp, initial?: {body:string;url:URL}): Promise<import("./types").SmsDiarySnapshot> {
  const page = initial ?? await http.request("/root");
  if (serverState(page.body)?.User?.IsAuthenticated !== true || /\/account\/login/i.test(page.url.pathname)) throw new SmsError("session_expired");
  throw new SmsError("sms_changed");
}
