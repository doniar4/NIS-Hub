import "server-only";
import { SmsError } from "./errors";
export const SMS_ORIGIN = "https://sms.ura.nis.edu.kz";
export type SmsConfig = { origin: string; loginPath: string; secret: Buffer; timeoutMs: number; maxBytes: number };
function bounded(raw: string | undefined, fallback: number, max: number) {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1000 || n > max) throw new SmsError("feature_disabled");
  return n;
}
export function smsConfig(env: Readonly<Record<string,string|undefined>> = process.env): SmsConfig {
  if (env.SMS_DIARY_ENABLED !== "true") throw new SmsError("feature_disabled");
  if ((env.SMS_BASE_URL || SMS_ORIGIN).replace(/\/$/, "") !== SMS_ORIGIN) throw new SmsError("feature_disabled");
  const key = env.SMS_SESSION_SECRET || "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(key)) throw new SmsError("feature_disabled");
  const secret = Buffer.from(key, "base64");
  if (secret.length !== 32 || secret.toString("base64") !== key) throw new SmsError("feature_disabled");
  const loginPath = env.SMS_LOGIN_PATH || "/Root/Account/Login?ReturnUrl=%2froot";
  const url = new URL(loginPath, SMS_ORIGIN);
  if (url.origin !== SMS_ORIGIN || url.username || url.password || url.pathname.toLowerCase() !== "/root/account/login") throw new SmsError("feature_disabled");
  return { origin: SMS_ORIGIN, loginPath: url.pathname + url.search, secret,
    timeoutMs: bounded(env.SMS_REQUEST_TIMEOUT_MS, 15000, 30000),
    maxBytes: bounded(env.SMS_MAX_HTML_BYTES, 2000000, 4000000) };
}
export function smsEnabled() { try { smsConfig(); return true; } catch { return false; } }
