import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SmsError } from "./errors";
import type { SmsSession } from "./types";
export const SMS_MAX_AGE_MS = 30 * 60 * 1000;
export function sealSession(session: SmsSession, key: Buffer, userId: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("nis-sms-v1:" + userId));
  const data = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return "v1." + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function openSession(raw: string, key: Buffer, userId: string, now = Date.now()): SmsSession {
  try {
    if (!/^v1\.[A-Za-z0-9_-]+$/.test(raw) || raw.length > 40000) throw new Error();
    const data = Buffer.from(raw.slice(3), "base64url");
    if (data.length < 29) throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(0,12));
    cipher.setAuthTag(data.subarray(12,28)); cipher.setAAD(Buffer.from("nis-sms-v1:" + userId));
    const value = JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8")) as SmsSession;
    if (value.version !== 1 || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + SMS_MAX_AGE_MS || !Array.isArray(value.cookies) || value.cookies.length > 40) throw new Error();
    if (value.cookies.some(c => !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(c.name) || typeof c.value !== "string" || /[\x00-\x20\x7f;,]/.test(c.value) || !c.path?.startsWith("/") || (c.expires !== undefined && !Number.isFinite(c.expires)))) throw new Error();
    return value;
  } catch { throw new SmsError("session_expired"); }
}
