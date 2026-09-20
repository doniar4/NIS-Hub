import "server-only";
import { SmsHttp } from "./http";
import { SmsError } from "./errors";
import { serverState } from "./html";

/**
 * Live adapter boundary. An authorized run on 2026-09-20 verified the diary shell
 * through /JceDiary/GetJceDiary and its child /jce/Diary/Index page. That page
 * loads JSON subject summaries from /Jce/Diary/GetSubjects (Name, Score, Mark and
 * Evaluations), rather than the semantic HTML table handled by parser.ts.
 *
 * The structural probe deliberately retained no values, cookies or raw response,
 * so assessment meaning and individual grade rows remain unverified. Do not
 * invent selectors, query IDs or field semantics. Replace this explicit
 * unsupported state only after a sanitized authenticated JSON fixture and its
 * year/term request contract are verified.
 */
export async function fetchDiary(http: SmsHttp, initial?: {body:string;url:URL}): Promise<import("./types").SmsDiarySnapshot> {
  const page = initial ?? await http.request("/root");
  if (serverState(page.body)?.User?.IsAuthenticated !== true || /\/account\/login/i.test(page.url.pathname)) throw new SmsError("session_expired");
  throw new SmsError("sms_changed");
}
