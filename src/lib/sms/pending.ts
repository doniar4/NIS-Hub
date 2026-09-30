import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { smsConfig } from "./config";
import { SmsError } from "./errors";
import type { SmsCookie } from "./types";

export const SMS_PENDING_MAX_AGE_MS = 5 * 60 * 1000;
export type PendingSmsLogin = {
  version: 1;
  expires: number;
  cookies: SmsCookie[];
  fields: [string, string][];
  challenge: { captcha: boolean; twoFactor: boolean; application2FA: boolean };
  attempts: number;
  iinHash: string;
  codeSentAt?: number;
};
type Client = SupabaseClient<Database>;
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-nis-sms-pending" : "nis-sms-pending";
// Retain the database's v1.% envelope contract, with distinct framing and AAD.
const PREFIX = "v1.pending.";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const forbiddenField = /(?:password|passwd|passcode|login|username|iin|captchaInput|twoFactorAuthCode|application2FACode|otp|verificationCode)/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

function validState(value: unknown, now: number): value is PendingSmsLogin {
  if (!record(value) || !exactKeys(value, ["version", "expires", "cookies", "fields", "challenge", "attempts", "iinHash", "codeSentAt"])) return false;
  if (value.version !== 1 || typeof value.expires !== "number" || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + SMS_PENDING_MAX_AGE_MS) return false;
  if (value.codeSentAt !== undefined && (typeof value.codeSentAt !== "number" || !Number.isSafeInteger(value.codeSentAt) || value.codeSentAt > now || value.codeSentAt < value.expires - SMS_PENDING_MAX_AGE_MS)) return false;
  if (typeof value.attempts !== "number" || !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > 5 || typeof value.iinHash !== "string" || !/^[a-f0-9]{64}$/.test(value.iinHash)) return false;
  if (!record(value.challenge) || !exactKeys(value.challenge, ["captcha", "twoFactor", "application2FA"]) || [value.challenge.captcha, value.challenge.twoFactor, value.challenge.application2FA].some(flag => typeof flag !== "boolean") || !Object.values(value.challenge).some(Boolean)) return false;
  if (!Array.isArray(value.cookies) || value.cookies.length > 40 || value.cookies.some(cookie => !record(cookie) || !exactKeys(cookie, ["name", "value", "path", "expires"]) || typeof cookie.name !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(cookie.name) || typeof cookie.value !== "string" || cookie.value.length > 16000 || /[\x00-\x20\x7f;,]/.test(cookie.value) || typeof cookie.path !== "string" || !cookie.path.startsWith("/") || cookie.path.length > 2048 || /[\x00-\x1f\x7f;]/.test(cookie.path) || (cookie.expires !== undefined && (typeof cookie.expires !== "number" || !Number.isSafeInteger(cookie.expires))))) return false;
  if (!Array.isArray(value.fields) || value.fields.length > 40 || value.fields.some(field => !Array.isArray(field) || field.length !== 2 || typeof field[0] !== "string" || !field[0] || field[0].length > 256 || forbiddenField.test(field[0].replace(/[^a-z0-9]/gi, "")) || typeof field[1] !== "string" || field[1].length > 16000)) return false;
  return true;
}

function seal(state: PendingSmsLogin, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", smsConfig().secret, iv);
  cipher.setAAD(Buffer.from("nis-sms-pending-v1:" + userId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function open(raw: string, userId: string): PendingSmsLogin {
  const key = smsConfig().secret;
  try {
    if (!raw.startsWith(PREFIX) || raw.length > 40000 || !/^[A-Za-z0-9_-]+$/.test(raw.slice(PREFIX.length))) throw new Error();
    const data = Buffer.from(raw.slice(PREFIX.length), "base64url");
    if (data.length < 29) throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    cipher.setAAD(Buffer.from("nis-sms-pending-v1:" + userId));
    const value: unknown = JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8"));
    if (!validState(value, Date.now())) throw new Error();
    return value;
  } catch { throw new SmsError("session_expired"); }
}

async function deleteOverflow(client: Client, userId: string, value?: string) {
  if (!value?.startsWith("id.") || !ID.test(value.slice(3))) return;
  const { error } = await client.from("sms_sessions").delete().eq("id", value.slice(3)).eq("user_id", userId).like("ciphertext", PREFIX + "%");
  if (error) throw new SmsError("sms_unavailable");
}

// Mutations must run inside a Server Action or Route Handler.
export async function clearPendingSmsLogin(client: Client, userId: string): Promise<void> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  await deleteOverflow(client, userId, value);
}

export async function readPendingSmsLogin(client: Client, userId: string): Promise<PendingSmsLogin> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) throw new SmsError("session_expired");
  let encrypted = value;
  if (value.startsWith("id.")) {
    if (!ID.test(value.slice(3))) throw new SmsError("session_expired");
    const { data, error } = await client.from("sms_sessions").select("ciphertext").eq("id", value.slice(3)).eq("user_id", userId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new SmsError("sms_unavailable");
    if (!data) throw new SmsError("session_expired");
    encrypted = data.ciphertext;
  }
  return open(encrypted, userId);
}

export async function savePendingSmsLogin(client: Client, userId: string, state: PendingSmsLogin): Promise<void> {
  if (!validState(state, Date.now())) throw new SmsError("session_expired");
  const encrypted = seal(state, userId);
  if (encrypted.length > 40000) throw new SmsError("sms_changed");
  const store = await cookies();
  let value = encrypted;
  if (Buffer.byteLength(encrypted) > 3300) {
    const { data, error } = await client.rpc("save_sms_session", { p_ciphertext: encrypted, p_expires: new Date(state.expires).toISOString() });
    if (error || typeof data !== "string" || !ID.test(data)) throw new SmsError("sms_unavailable");
    value = "id." + data;
  } else {
    await deleteOverflow(client, userId, store.get(COOKIE)?.value);
  }
  store.set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(state.expires), maxAge: Math.max(0, Math.floor((state.expires - Date.now()) / 1000)) });
}
