import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { smsConfig } from "./config";
import { openSession, sealSession, SMS_MAX_AGE_MS } from "./crypto";
import { SmsError } from "./errors";
import type { SmsCookie, SmsSession } from "./types";
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-nis-sms" : "nis-sms";
type Client = SupabaseClient<Database>;
// Called only from Server Actions, including expiration cleanup.
export async function clearSmsSession(client: Client) {
  (await cookies()).delete(COOKIE);
  const {error} = await client.from("sms_sessions").delete().not("user_id","is",null);
  if (error) throw new SmsError("sms_unavailable");
}
export async function hasSmsSession() { return !!(await cookies()).get(COOKIE)?.value; }
export async function readSmsSession(client: Client, userId: string): Promise<SmsSession> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) throw new SmsError("session_expired");
  let encrypted = value;
  if (value.startsWith("id.")) {
    const id = value.slice(3);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new SmsError("session_expired");
    const {data,error} = await client.from("sms_sessions").select("ciphertext").eq("id",id).eq("user_id",userId).gt("expires_at",new Date().toISOString()).maybeSingle();
    if (error) throw new SmsError("sms_unavailable");
    if (!data) throw new SmsError("session_expired");
    encrypted = data.ciphertext;
  }
  return openSession(encrypted, smsConfig().secret, userId);
}
export async function saveSmsSession(client: Client, userId: string, jar: SmsCookie[], deadline = Date.now() + SMS_MAX_AGE_MS) {
  const live = jar.filter(c => c.expires === undefined || c.expires > Date.now());
  if (!live.length) throw new SmsError("session_expired");
  const expires = Math.min(deadline, Date.now() + SMS_MAX_AGE_MS, ...live.flatMap(c => c.expires === undefined ? [] : [c.expires]));
  if (expires <= Date.now()) throw new SmsError("session_expired");
  const encrypted = sealSession({version:1, cookies:live, expires}, smsConfig().secret, userId);
  let value = encrypted;
  if (Buffer.byteLength(encrypted) > 3300) {
    const {data,error} = await client.rpc("save_sms_session", {p_ciphertext:encrypted,p_expires:new Date(expires).toISOString()});
    if (error || !data) throw new SmsError("sms_unavailable");
    value = "id." + data;
  } else {
    const {error} = await client.from("sms_sessions").delete().eq("user_id",userId);
    if (error) throw new SmsError("sms_unavailable");
  }
  (await cookies()).set(COOKIE, value, {httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/", expires:new Date(expires), maxAge:Math.max(0,Math.floor((expires-Date.now())/1000))});
}
