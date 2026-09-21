import "server-only";
import { EduPageError } from "./errors";
import { EDUPAGE_ORIGIN, type EduPageConfig } from "./config";
export const VIEWER_RPC = "/timetable/server/ttviewer.js?__func=getTTViewerData";
export const REGULAR_RPC = "/timetable/server/regulartt.js?__func=regularttGetData";
const paths = new Set(["/timetable/", VIEWER_RPC, REGULAR_RPC]);
export function safeEduPageUrl(value: string) {
  let url: URL;
  try { url = new URL(value, EDUPAGE_ORIGIN); } catch { throw new EduPageError("source_changed"); }
  if (url.origin !== EDUPAGE_ORIGIN || url.username || url.password || url.hash ||
      !paths.has(url.pathname + url.search)) throw new EduPageError("source_changed");
  return url;
}
export class EduPageHttp {
  private calls = 0;
  private readonly deadline = Date.now() + 60000;
  constructor(readonly config: EduPageConfig, private transport: typeof fetch = fetch) {}
  async request(path: string, payload?: unknown) {
    let url = safeEduPageUrl(path);
    if (this.config.origin !== EDUPAGE_ORIGIN) throw new EduPageError("disabled");
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) throw new EduPageError("timeout");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, this.config.timeoutMs));
    try {
      for (let redirects = 0; redirects < 3; redirects++) {
        if (++this.calls > 6) throw new EduPageError("source_changed");
        const response = await this.transport(url, {
          method: payload === undefined ? "GET" : "POST", cache: "no-store", redirect: "manual",
          signal: controller.signal,
          headers: { Accept: payload === undefined ? "text/html" : "application/json",
            ...(payload === undefined ? {} : { "Content-Type": "application/json", Origin: EDUPAGE_ORIGIN, Referer: EDUPAGE_ORIGIN + "/timetable/" }) },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        });
        if ([401, 403].includes(response.status)) { await response.body?.cancel(); throw new EduPageError("login_required"); }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const location = response.headers.get("location");
          if (location && /login|auth/i.test(location)) throw new EduPageError("login_required");
          if (!location || payload !== undefined) throw new EduPageError("source_changed");
          url = safeEduPageUrl(new URL(location, url).href);
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new EduPageError("unavailable"); }
        const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const allowed = payload === undefined ? ["text/html", "application/xhtml+xml"] : ["application/json"];
        if (!allowed.includes(type)) { await response.body?.cancel(); throw new EduPageError("source_changed"); }
        if (Number(response.headers.get("content-length")) > this.config.maxBytes) {
          await response.body?.cancel(); throw new EduPageError("source_changed");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new EduPageError("unavailable");
        const parts: Uint8Array[] = []; let size = 0;
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > this.config.maxBytes) { await reader.cancel(); throw new EduPageError("source_changed"); }
          parts.push(part.value);
        }
        return Buffer.concat(parts).toString("utf8");
      }
      throw new EduPageError("source_changed");
    } catch (error) {
      if (controller.signal.aborted) throw new EduPageError("timeout");
      if (error instanceof EduPageError) throw error;
      throw new EduPageError("unavailable");
    } finally { clearTimeout(timer); }
  }
}
