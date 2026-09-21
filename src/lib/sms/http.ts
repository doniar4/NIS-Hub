import "server-only";
import { SmsError } from "./errors";
import type { SmsConfig } from "./config";
import type { SmsCookie } from "./types";
export function safeSmsUrl(value: string, origin: string, base = origin): URL {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new SmsError("sms_changed"); }
  if (url.origin !== origin || url.protocol !== "https:" || url.username || url.password || url.hash) throw new SmsError("sms_changed");
  return url;
}
export class SmsHttp {
  readonly cookies: SmsCookie[];
  private calls = 0;
  constructor(readonly config: SmsConfig, cookies: SmsCookie[] = [], private transport: typeof fetch = fetch) { this.cookies = cookies.map(c => ({...c})); }
  private receive(headers: Headers, url: URL) {
    for (const header of headers.getSetCookie()) {
      const [pair, ...parts] = header.split(";"), at = pair.indexOf("=");
      if (at < 1) continue;
      const name = pair.slice(0, at).trim(), value = pair.slice(at + 1).trim();
      if (!name || value.length > 12000) throw new SmsError("sms_changed");
      let path = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1) || "/", expires: number | undefined, maxAge: number | undefined;
      for (const part of parts) {
        const split = part.indexOf("="), key = (split < 0 ? part : part.slice(0, split)).trim().toLowerCase(), val = split < 0 ? "" : part.slice(split + 1).trim();
        if (key === "domain") { const d = val.replace(/^\./, "").toLowerCase(); if (d !== url.hostname && !url.hostname.endsWith("." + d)) throw new SmsError("sms_changed"); }
        if (key === "path" && val.startsWith("/") && !/[\x00-\x20\x7f;]/.test(val)) path = val;
        if (key === "expires" && Number.isFinite(Date.parse(val))) expires = Date.parse(val);
        if (key === "max-age" && /^-?\d+$/.test(val)) maxAge = Number(val);
      }
      if (maxAge !== undefined) expires = Date.now() + maxAge * 1000;
      const index = this.cookies.findIndex(c => c.name === name && c.path === path);
      if (index >= 0) this.cookies.splice(index, 1);
      if (expires === undefined || expires > Date.now()) this.cookies.push({name, value, path, expires});
      if (this.cookies.length > 40 || JSON.stringify(this.cookies).length > 24000) throw new SmsError("sms_changed");
    }
  }
  async request(path: string, form?: URLSearchParams, kind: "html" | "script" | "login" | "json" = "html", referer?: string): Promise<{body: string; url: URL; type: string}> {
    let url = safeSmsUrl(path, this.config.origin), method = form ? "POST" : "GET";
    const safeReferer = referer ? safeSmsUrl(referer, this.config.origin).href : new URL(this.config.loginPath,this.config.origin).href;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      for (let redirect = 0; redirect <= 5; redirect++) {
        if (++this.calls > 24) throw new SmsError("sms_changed");
        const cookie = this.cookies.filter(c => (c.expires === undefined || c.expires > Date.now()) && (url.pathname === c.path || url.pathname.startsWith(c.path.endsWith("/") ? c.path : c.path + "/"))).sort((a,b) => b.path.length-a.path.length).map(c => c.name + "=" + c.value).join("; ");
        const response = await this.transport(url, { method, cache: "no-store", redirect: "manual", signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0", Accept: kind === "script" ? "text/javascript, application/javascript" : kind === "json" ? "application/json, text/json" : "text/html, application/json", "Accept-Language": "ru-RU",
            ...(cookie ? {Cookie: cookie} : {}), ...(method === "POST" ? {"Content-Type":"application/x-www-form-urlencoded",Origin:this.config.origin,Referer:safeReferer} : {}) },
          body: method === "POST" ? form : undefined });
        this.receive(response.headers, url);
        if ([301,302,303,307,308].includes(response.status)) {
          await response.body?.cancel();
          const location = response.headers.get("location");
          if (!location || redirect === 5) throw new SmsError("sms_changed");
          url = safeSmsUrl(location, this.config.origin, url.href);
          // Never replay credentials after a redirect, even to the same host.
          if (method === "POST" && [307,308].includes(response.status)) throw new SmsError("sms_changed");
          method = "GET"; continue;
        }
        if ([401,403].includes(response.status)) throw new SmsError("session_expired");
        if (!response.ok) throw new SmsError("sms_unavailable");
        const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const permitted = kind === "script" ? ["application/javascript","text/javascript"] : kind === "json" ? ["application/json","text/json"] : kind === "login" ? ["text/html","application/json","text/json"] : ["text/html","application/xhtml+xml"];
        if (!permitted.includes(type)) throw new SmsError("sms_changed");
        const length = Number(response.headers.get("content-length") || 0);
        if (length > this.config.maxBytes) { await response.body?.cancel(); throw new SmsError("sms_changed"); }
        const reader = response.body?.getReader();
        if (!reader) throw new SmsError("sms_unavailable");
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > this.config.maxBytes) { await reader.cancel(); throw new SmsError("sms_changed"); }
          chunks.push(value);
        }
        return {body: Buffer.concat(chunks).toString("utf8"), url, type};
      }
      throw new SmsError("sms_changed");
    } catch (error) {
      if (controller.signal.aborted) throw new SmsError("timeout");
      if (error instanceof SmsError) throw error;
      throw new SmsError("sms_unavailable");
    } finally { clearTimeout(timeout); }
  }
}
